import request from 'supertest';
import type { Core } from '@strapi/strapi';
import { setupStrapi, cleanupStrapi } from '../helpers/strapi';
import { createReadOnlyToken } from '../helpers/tokens';

describe('Instagram public API', () => {
  let strapi: Core.Strapi;
  let token: string;

  beforeAll(async () => {
    strapi = await setupStrapi();
    token = await createReadOnlyToken(strapi);
  });

  afterAll(async () => {
    await cleanupStrapi();
  });

  afterEach(async () => {
    await strapi.db.query('api::instagram.instagram').deleteMany({});
    await strapi.db.connection('components_midia_urls').delete();
  });

  const validPosts = [
    { url: 'https://instagram.com/p/1', label: 'Post 1' },
    { url: 'https://instagram.com/p/2', label: 'Post 2' },
    { url: 'https://instagram.com/p/3' },
  ];

  it('should return 404 when the singleType has no published entry', async () => {
    const res = await request(strapi.server.httpServer)
      .get('/api/instagram')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('should expose the singleType with its 3 posts once published', async () => {
    await strapi.documents('api::instagram.instagram').create({
      data: { posts: validPosts },
      status: 'published',
    });

    const res = await request(strapi.server.httpServer)
      .get('/api/instagram?populate=posts')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.posts).toHaveLength(3);
    expect(res.body.data.posts[0].url).toBe('https://instagram.com/p/1');
  });

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
