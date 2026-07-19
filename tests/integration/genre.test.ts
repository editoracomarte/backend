import request from 'supertest';
import type { Core } from '@strapi/strapi';
import { setupStrapi, cleanupStrapi } from '../helpers/strapi';
import { createReadOnlyToken } from '../helpers/tokens';

describe('Genre public API', () => {
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
    await strapi.db.query('api::genre.genre').deleteMany({});
    await strapi.db.query('api::book.book').deleteMany({});
  });

  it('should return an empty list when no genres exist', async () => {
    const res = await request(strapi.server.httpServer)
      .get('/api/genres')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('should expose a created genre via findOne', async () => {
    const created = await strapi.documents('api::genre.genre').create({
      data: { name: 'Romance', slug: 'romance' },
    });

    const res = await request(strapi.server.httpServer)
      .get(`/api/genres/${created.documentId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Romance');
  });

  it('should reject creation when name is missing', async () => {
    await expect(
      strapi.documents('api::genre.genre').create({
        // @ts-expect-error — intentionally omitting required field
        data: { slug: 'sem-nome' },
      })
    ).rejects.toThrow();
  });

  it('should reject creation when name is already used by another genre', async () => {
    await strapi.documents('api::genre.genre').create({
      data: { name: 'Romance', slug: 'romance' },
    });
    await expect(
      strapi.documents('api::genre.genre').create({
        data: { name: 'Romance', slug: 'romance-2' },
      })
    ).rejects.toThrow();
  });

  it('should always expose genres publicly (draftAndPublish: false)', async () => {
    await strapi.documents('api::genre.genre').create({
      data: { name: 'Poesia', slug: 'poesia' },
    });

    const res = await request(strapi.server.httpServer)
      .get('/api/genres')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Poesia');
  });

  it('should expose associated books (manyToMany) when populated', async () => {
    const book = await strapi.documents('api::book.book').create({
      data: { title: 'Dom Casmurro', slug: 'dom-casmurro' },
      status: 'published',
    });
    const genre = await strapi.documents('api::genre.genre').create({
      data: {
        name: 'Romance',
        slug: 'romance',
        books: [book.documentId],
      },
    });

    const res = await request(strapi.server.httpServer)
      .get(`/api/genres/${genre.documentId}?populate=books`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.books).toHaveLength(1);
    expect(res.body.data.books[0].title).toBe('Dom Casmurro');
  });
});
