import type { Core } from '@strapi/strapi';
import {
  getPosts,
  fetchFromRapidApi,
  getManualPosts,
} from '../../../src/api/instagram/services/feed';

type StoreValue = { posts: Array<{ url: string }>; fetchedAt: string };

function mockStrapi(opts: { cache?: StoreValue | null; manual?: Array<{ url: string }> } = {}) {
  const store = {
    get: jest.fn(async () => opts.cache ?? null),
    set: jest.fn(async () => undefined),
  };
  const findFirst = jest.fn(async () => (opts.manual ? { posts: opts.manual } : null));
  const strapi = {
    store: jest.fn(() => store),
    documents: jest.fn(() => ({ findFirst })),
    log: { warn: jest.fn() },
  } as unknown as Core.Strapi;

  return { strapi, store, findFirst };
}

const mockFeedResponse = (shortcodes: string[], status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({
      data: {
        user: {
          edge_owner_to_timeline_media: {
            edges: shortcodes.map((shortcode) => ({ node: { shortcode } })),
          },
        },
      },
    }),
  }) as Response;

describe('instagram feed service', () => {
  beforeEach(() => {
    process.env.INSTAGRAM_USER_ID = '536626219';
    process.env.RAPIDAPI_KEY = 'test-key';
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.INSTAGRAM_USER_ID;
    delete process.env.RAPIDAPI_KEY;
  });

  describe('fetchFromRapidApi', () => {
    it('throws when INSTAGRAM_USER_ID or RAPIDAPI_KEY is missing', async () => {
      delete process.env.RAPIDAPI_KEY;
      await expect(fetchFromRapidApi()).rejects.toThrow(/Missing/);
    });

    it('maps shortcodes to instagram post URLs', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue(mockFeedResponse(['AAA', 'BBB']));

      const posts = await fetchFromRapidApi();

      expect(posts).toEqual([
        { url: 'https://www.instagram.com/p/AAA/' },
        { url: 'https://www.instagram.com/p/BBB/' },
      ]);
    });

    it('calls RapidAPI with the id and auth headers', async () => {
      const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(mockFeedResponse(['AAA']));

      await fetchFromRapidApi();

      const [url, init] = fetchMock.mock.calls[0];
      expect(String(url)).toContain('instagram-looter2.p.rapidapi.com');
      expect(String(url)).toContain('id=536626219');
      expect((init?.headers as Record<string, string>)['x-rapidapi-key']).toBe('test-key');
    });

    it('throws on a non-ok response (e.g. 429 quota exceeded)', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue(mockFeedResponse([], 429));
      await expect(fetchFromRapidApi()).rejects.toThrow('RapidAPI returned 429');
    });

    it('throws when the response shape is unexpected', async () => {
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValue({ ok: true, status: 200, json: async () => ({}) } as Response);
      await expect(fetchFromRapidApi()).rejects.toThrow(/Unexpected/);
    });

    it('skips edges without a string shortcode', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            user: {
              edge_owner_to_timeline_media: {
                edges: [{ node: { shortcode: 'AAA' } }, { node: {} }, {}],
              },
            },
          },
        }),
      } as Response);

      const posts = await fetchFromRapidApi();
      expect(posts).toEqual([{ url: 'https://www.instagram.com/p/AAA/' }]);
    });
  });

  describe('getManualPosts', () => {
    it('maps the single type posts to { url }', async () => {
      const { strapi } = mockStrapi({
        manual: [{ url: 'https://instagram.com/p/1' }, { url: 'https://instagram.com/p/2' }],
      });

      await expect(getManualPosts(strapi)).resolves.toEqual([
        { url: 'https://instagram.com/p/1' },
        { url: 'https://instagram.com/p/2' },
      ]);
    });

    it('returns an empty list when there is no entry', async () => {
      const { strapi } = mockStrapi();
      await expect(getManualPosts(strapi)).resolves.toEqual([]);
    });
  });

  describe('getPosts', () => {
    it('returns fresh cache without calling RapidAPI', async () => {
      const cache = { posts: [{ url: 'https://cached/1' }], fetchedAt: new Date().toISOString() };
      const { strapi } = mockStrapi({ cache });
      const fetchMock = jest.spyOn(global, 'fetch');

      await expect(getPosts(strapi)).resolves.toEqual(cache.posts);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('ignores stale cache, fetches from RapidAPI and refreshes the cache', async () => {
      const stale = {
        posts: [{ url: 'https://old/1' }],
        fetchedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 24h atrás
      };
      const { strapi, store } = mockStrapi({ cache: stale });
      jest.spyOn(global, 'fetch').mockResolvedValue(mockFeedResponse(['AAA']));

      const posts = await getPosts(strapi);

      expect(posts).toEqual([{ url: 'https://www.instagram.com/p/AAA/' }]);
      expect(store.set).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'feed', value: expect.objectContaining({ posts }) })
      );
    });

    it('falls back to manual posts when RapidAPI fails', async () => {
      const { strapi, store } = mockStrapi({
        manual: [{ url: 'https://instagram.com/p/manual' }],
      });
      jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'));

      await expect(getPosts(strapi)).resolves.toEqual([{ url: 'https://instagram.com/p/manual' }]);
      expect(store.set).not.toHaveBeenCalled();
    });

    it('falls back to manual posts when RapidAPI returns no posts', async () => {
      const { strapi } = mockStrapi({ manual: [{ url: 'https://instagram.com/p/manual' }] });
      jest.spyOn(global, 'fetch').mockResolvedValue(mockFeedResponse([]));

      await expect(getPosts(strapi)).resolves.toEqual([{ url: 'https://instagram.com/p/manual' }]);
    });

    it('returns an empty list when RapidAPI fails and there is no manual entry', async () => {
      const { strapi } = mockStrapi();
      jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'));

      await expect(getPosts(strapi)).resolves.toEqual([]);
    });
  });
});
