/**
 * instagram service
 */

import { factories } from '@strapi/strapi';

const RAPIDAPI_HOST = 'instagram-looter2.p.rapidapi.com';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const FETCH_TIMEOUT_MS = 5000;

type Post = { url: string; label: string | null };
type CacheValue = { posts: Post[]; fetchedAt: string };

type RapidApiFeed = {
  data?: {
    user?: {
      edge_owner_to_timeline_media?: {
        edges?: Array<{ node?: { shortcode?: string } }>;
      };
    };
  };
};

export default factories.createCoreService('api::instagram.instagram', ({ strapi }) => ({
  async getPosts(): Promise<Post[]> {
    const store = strapi.store({ type: 'plugin', name: 'instagram' });

    // 1. Cache fresco (<24h)?
    const cached = (await store.get({ key: 'feed' })) as CacheValue | null;
    if (cached && Date.now() - new Date(cached.fetchedAt).getTime() < CACHE_TTL_MS) {
      return cached.posts;
    }

    // 2. Tenta a API externa
    try {
      const posts = await this.fetchFromRapidApi();
      if (posts.length > 0) {
        await store.set({
          key: 'feed',
          value: { posts, fetchedAt: new Date().toISOString() },
        });
        return posts;
      }
    } catch (error) {
      strapi.log.warn(
        `[instagram] RapidAPI fetch failed, falling back to manual posts: ${error}`
      );
    }

    // 3. Fallback: posts manuais do single type
    return this.getManualPosts();
  },

  async fetchFromRapidApi(): Promise<Post[]> {
    const id = process.env.INSTAGRAM_USER_ID;
    const key = process.env.RAPIDAPI_KEY;
    if (!id || !key) {
      throw new Error('Missing INSTAGRAM_USER_ID or RAPIDAPI_KEY');
    }

    const url =
      `https://${RAPIDAPI_HOST}/user-feeds2?id=${id}&count=3` +
      `&fields=data.user.edge_owner_to_timeline_media.edges%5B%5D.node.shortcode`;

    const response = await fetch(url, {
      method: 'GET',
      headers: { 'x-rapidapi-key': key, 'x-rapidapi-host': RAPIDAPI_HOST },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    // fetch NÃO lança em 4xx/5xx (ex.: 429 = cota estourada) → checar manualmente
    if (!response.ok) {
      throw new Error(`RapidAPI returned ${response.status}`);
    }

    const body = (await response.json()) as RapidApiFeed;
    const edges = body?.data?.user?.edge_owner_to_timeline_media?.edges;
    if (!Array.isArray(edges)) {
      throw new Error('Unexpected RapidAPI response shape');
    }

    return edges
      .map((edge) => edge?.node?.shortcode)
      .filter((shortcode): shortcode is string => typeof shortcode === 'string')
      .map((shortcode) => ({
        url: `https://www.instagram.com/p/${shortcode}/`,
        label: null,
      }));
  },

  async getManualPosts(): Promise<Post[]> {
    const entry = await strapi
      .documents('api::instagram.instagram')
      .findFirst({ populate: ['posts'] });

    const posts = (entry?.posts ?? []) as Array<{ url: string; label?: string | null }>;
    return posts.map((p) => ({ url: p.url, label: p.label ?? null }));
  },
}));
