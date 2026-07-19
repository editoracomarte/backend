import request from 'supertest';
import type { Core } from '@strapi/strapi';
import { setupStrapi, cleanupStrapi } from '../helpers/strapi';
import { createReadOnlyToken } from '../helpers/tokens';
import { createUploadFile } from '../helpers/uploads';

describe('Collection public API', () => {
  let strapi: Core.Strapi;
  let token: string;
  let coverId: number;

  beforeAll(async () => {
    strapi = await setupStrapi();
    token = await createReadOnlyToken(strapi);
    coverId = await createUploadFile(strapi);
  });

  afterAll(async () => {
    await cleanupStrapi();
  });

  afterEach(async () => {
    await strapi.db.query('api::collection.collection').deleteMany({});
    await strapi.db.query('api::book.book').deleteMany({});
  });

  it('should return an empty list when no collections exist', async () => {
    const res = await request(strapi.server.httpServer)
      .get('/api/collections')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('should expose a created collection via findOne', async () => {
    const created = await strapi.documents('api::collection.collection').create({
      data: {
        name: 'Clássicos da Literatura Brasileira',
        slug: 'classicos-da-literatura-brasileira',
      },
      status: 'published',
    });

    const res = await request(strapi.server.httpServer)
      .get(`/api/collections/${created.documentId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Clássicos da Literatura Brasileira');
  });

  it('should reject creation when name is missing', async () => {
    await expect(
      strapi.documents('api::collection.collection').create({
        // @ts-expect-error — intentionally omitting required field
        data: { slug: 'sem-nome' },
        status: 'published',
      })
    ).rejects.toThrow();
  });

  it('should expose associated books (manyToMany) when populated', async () => {
    const book = await strapi.documents('api::book.book').create({
      data: { title: 'Dom Casmurro', slug: 'dom-casmurro', cover: coverId },
      status: 'published',
    });
    const collection = await strapi.documents('api::collection.collection').create({
      data: {
        name: 'Clássicos da Literatura Brasileira',
        slug: 'classicos-da-literatura-brasileira',
        books: [book.documentId],
      },
    });
    await strapi
      .documents('api::collection.collection')
      .publish({ documentId: collection.documentId });

    const res = await request(strapi.server.httpServer)
      .get(`/api/collections/${collection.documentId}?populate=books`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.books).toHaveLength(1);
    expect(res.body.data.books[0].title).toBe('Dom Casmurro');
  });

  it('should hide a draft collection from the public find endpoint', async () => {
    await strapi.documents('api::collection.collection').create({
      data: { name: 'Coleção Draft', slug: 'colecao-draft' },
    });

    const res = await request(strapi.server.httpServer)
      .get('/api/collections')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});
