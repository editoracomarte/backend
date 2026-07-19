import request from 'supertest';
import type { Core } from '@strapi/strapi';
import { setupStrapi, cleanupStrapi } from '../helpers/strapi';
import { createReadOnlyToken } from '../helpers/tokens';

describe('Author public API', () => {
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
    await strapi.db.query('api::author.author').deleteMany({});
    await strapi.db.query('api::book.book').deleteMany({});
  });

  it('should return an empty list when no authors exist', async () => {
    const res = await request(strapi.server.httpServer)
      .get('/api/authors')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('should expose a created author via findOne', async () => {
    const created = await strapi.documents('api::author.author').create({
      data: { name: 'Machado de Assis', slug: 'machado-de-assis' },
      status: 'published',
    });

    const res = await request(strapi.server.httpServer)
      .get(`/api/authors/${created.documentId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Machado de Assis');
  });

  it('should reject creation when name is missing', async () => {
    await expect(
      strapi.documents('api::author.author').create({
        // @ts-expect-error — intentionally omitting required field
        data: { slug: 'sem-nome' },
        status: 'published',
      })
    ).rejects.toThrow();
  });

  it('should reject creation when slug is missing', async () => {
    await expect(
      strapi.documents('api::author.author').create({
        // @ts-expect-error — intentionally omitting required field
        data: { name: 'Sem Slug' },
        status: 'published',
      })
    ).rejects.toThrow();
  });

  it('should expose associated books (manyToMany) when populated', async () => {
    const book = await strapi.documents('api::book.book').create({
      data: { title: 'Dom Casmurro', slug: 'dom-casmurro' },
      status: 'published',
    });
    const author = await strapi.documents('api::author.author').create({
      data: {
        name: 'Machado de Assis',
        slug: 'machado-de-assis',
        books: [book.documentId],
      },
    });
    await strapi.documents('api::author.author').publish({ documentId: author.documentId });

    const res = await request(strapi.server.httpServer)
      .get(`/api/authors/${author.documentId}?populate=books`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.books).toHaveLength(1);
    expect(res.body.data.books[0].title).toBe('Dom Casmurro');
  });

  it('should hide a draft author from the public find endpoint', async () => {
    await strapi.documents('api::author.author').create({
      data: { name: 'Carlos Drummond (draft)', slug: 'carlos-drummond-draft' },
    });

    const res = await request(strapi.server.httpServer)
      .get('/api/authors')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});
