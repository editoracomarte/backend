import request from 'supertest';
import type { Core } from '@strapi/strapi';
import { setupStrapi, cleanupStrapi } from '../helpers/strapi';
import { createReadOnlyToken } from '../helpers/tokens';

describe('Instagram public API', () => {
  let strapi: Core.Strapi;
  let token: string;

  beforeAll(async () => {
    process.env.INSTAGRAM_USER_ID = '536626219';
    process.env.RAPIDAPI_KEY = 'test-key';
    strapi = await setupStrapi();
    token = await createReadOnlyToken(strapi);
  });

  afterAll(async () => {
    await cleanupStrapi();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await strapi.store({ type: 'plugin', name: 'instagram' }).delete({ key: 'feed' });
    await strapi.db.query('api::instagram.instagram').deleteMany({});
    await strapi.db.connection('components_midia_urls').delete();
  });

  const validPosts = [
    { url: 'https://instagram.com/p/1', label: 'Post 1' },
    { url: 'https://instagram.com/p/2', label: 'Post 2' },
    { url: 'https://instagram.com/p/3' },
  ];

  const mockFeed = (shortcodes: string[]) =>
    ({
      ok: true,
      status: 200,
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

  describe('RapidAPI feed', () => {
    it('should return the 3 latest posts from RapidAPI', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValue(mockFeed(['AAA', 'BBB', 'CCC']));

      const res = await request(strapi.server.httpServer)
        .get('/api/instagram')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.posts).toHaveLength(3);
      expect(res.body.data.posts[0].url).toBe('https://www.instagram.com/p/AAA/');
      expect(res.body.data.posts[0].label).toBeNull();
    });

    it('should serve from cache without hitting RapidAPI again', async () => {
      const fetchMock = jest
        .spyOn(global, 'fetch')
        .mockResolvedValue(mockFeed(['AAA', 'BBB', 'CCC']));

      await request(strapi.server.httpServer)
        .get('/api/instagram')
        .set('Authorization', `Bearer ${token}`);
      await request(strapi.server.httpServer)
        .get('/api/instagram')
        .set('Authorization', `Bearer ${token}`);

      // Conta só as chamadas à RapidAPI (o Strapi também usa fetch internamente).
      const rapidApiCalls = fetchMock.mock.calls.filter(([url]) =>
        String(url).includes('instagram-looter2')
      );
      expect(rapidApiCalls).toHaveLength(1);
    });
  });

  describe('fallback to manual posts', () => {
    it('should fall back to manual posts when RapidAPI returns 429', async () => {
      jest
        .spyOn(global, 'fetch')
        .mockResolvedValue({ ok: false, status: 429, json: async () => ({}) } as Response);

      await strapi.documents('api::instagram.instagram').create({
        data: { posts: validPosts },
        status: 'published',
      });

      const res = await request(strapi.server.httpServer)
        .get('/api/instagram')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.posts).toHaveLength(3);
      expect(res.body.data.posts[0].url).toBe('https://instagram.com/p/1');
    });

    it('should return 404 when RapidAPI fails and there is no manual entry', async () => {
      jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'));

      const res = await request(strapi.server.httpServer)
        .get('/api/instagram')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });

  describe('schema validation', () => {
    it('should reject publishing with fewer than 3 posts', async () => {
      await expect(
        strapi.documents('api::instagram.instagram').create({
          data: { posts: validPosts.slice(0, 2) },
          status: 'published',
        })
      ).rejects.toThrow();
    });

    it('should reject publishing with more than 3 posts', async () => {
      await expect(
        strapi.documents('api::instagram.instagram').create({
          data: {
            posts: [...validPosts, { url: 'https://instagram.com/p/4' }],
          },
          status: 'published',
        })
      ).rejects.toThrow();
    });

    it('should reject publishing when a post omits url', async () => {
      await expect(
        strapi.documents('api::instagram.instagram').create({
          data: {
            posts: [
              { url: 'https://instagram.com/p/1' },
              { url: 'https://instagram.com/p/2' },
              // @ts-expect-error — intentionally omitting required field
              { label: 'sem url' },
            ],
          },
          status: 'published',
        })
      ).rejects.toThrow();
    });

    it('should reject publishing when two posts share the same url', async () => {
      await expect(
        strapi.documents('api::instagram.instagram').create({
          data: {
            posts: [
              { url: 'https://instagram.com/p/dup' },
              { url: 'https://instagram.com/p/dup' },
              { url: 'https://instagram.com/p/3' },
            ],
          },
          status: 'published',
        })
      ).rejects.toThrow();
    });

    it('should accept posts without label (optional field)', async () => {
      const created = await strapi.documents('api::instagram.instagram').create({
        data: {
          posts: [
            { url: 'https://instagram.com/p/a' },
            { url: 'https://instagram.com/p/b' },
            { url: 'https://instagram.com/p/c' },
          ],
        },
      });
      expect(created).toBeDefined();
    });
  });
});
