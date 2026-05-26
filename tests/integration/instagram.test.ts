import request from 'supertest';
import type { Core } from '@strapi/strapi';
import { setupStrapi, cleanupStrapi } from '../helpers/strapi';
import { grantPublicAccess } from '../helpers/permissions';

describe('Instagram public API', () => {
  let strapi: Core.Strapi;

  beforeAll(async () => {
    strapi = await setupStrapi();
    await grantPublicAccess(strapi, 'api::instagram.instagram', ['find']);
  });

  afterAll(async () => {
    await cleanupStrapi();
  });

  afterEach(async () => {
    await strapi.db.query('api::instagram.instagram').deleteMany({});
    await strapi.db.connection('components_midia_urls').delete();
  });

  const validPostagens = [
    { url: 'https://instagram.com/p/1', rotulo: 'Post 1' },
    { url: 'https://instagram.com/p/2', rotulo: 'Post 2' },
    { url: 'https://instagram.com/p/3' },
  ];

  it('should return 404 when the singleType has no published entry', async () => {
    const res = await request(strapi.server.httpServer).get('/api/instagram');
    expect(res.status).toBe(404);
  });

  it('should expose the singleType with its 3 postagens once published', async () => {
    await strapi.documents('api::instagram.instagram').create({
      data: { Postagem: validPostagens },
      status: 'published',
    });

    const res = await request(strapi.server.httpServer).get('/api/instagram?populate=Postagem');
    expect(res.status).toBe(200);
    expect(res.body.data.Postagem).toHaveLength(3);
    expect(res.body.data.Postagem[0].url).toBe('https://instagram.com/p/1');
  });

  it('should reject publishing with fewer than 3 postagens', async () => {
    await expect(
      strapi.documents('api::instagram.instagram').create({
        data: { Postagem: validPostagens.slice(0, 2) },
        status: 'published',
      })
    ).rejects.toThrow();
  });

  it('should reject publishing with more than 3 postagens', async () => {
    await expect(
      strapi.documents('api::instagram.instagram').create({
        data: {
          Postagem: [...validPostagens, { url: 'https://instagram.com/p/4' }],
        },
        status: 'published',
      })
    ).rejects.toThrow();
  });

  it('should reject publishing when a postagem omits url', async () => {
    await expect(
      strapi.documents('api::instagram.instagram').create({
        data: {
          Postagem: [
            { url: 'https://instagram.com/p/1' },
            { url: 'https://instagram.com/p/2' },
            // @ts-expect-error — intentionally omitting required field
            { rotulo: 'sem url' },
          ],
        },
        status: 'published',
      })
    ).rejects.toThrow();
  });

  it('should reject publishing when two postagens share the same url', async () => {
    await expect(
      strapi.documents('api::instagram.instagram').create({
        data: {
          Postagem: [
            { url: 'https://instagram.com/p/dup' },
            { url: 'https://instagram.com/p/dup' },
            { url: 'https://instagram.com/p/3' },
          ],
        },
        status: 'published',
      })
    ).rejects.toThrow();
  });

  it('should accept postagens without rotulo (optional field)', async () => {
    const created = await strapi.documents('api::instagram.instagram').create({
      data: {
        Postagem: [
          { url: 'https://instagram.com/p/a' },
          { url: 'https://instagram.com/p/b' },
          { url: 'https://instagram.com/p/c' },
        ],
      },
    });
    expect(created).toBeDefined();
  });
});
