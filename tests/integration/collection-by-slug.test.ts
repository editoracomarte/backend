import request from 'supertest';
import type { Core } from '@strapi/strapi';
import { setupStrapi, cleanupStrapi } from '../helpers/strapi';
import { createReadOnlyToken } from '../helpers/tokens';
import { createUploadFile } from '../helpers/uploads';

describe('GET /api/collection/:slug', () => {
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

  function authGet(path: string) {
    return request(strapi.server.httpServer).get(path).set('Authorization', `Bearer ${token}`);
  }

  async function createPublishedBook(title: string, slug: string) {
    const doc = await strapi.documents('api::book.book').create({
      data: { title, slug, cover: coverId },
    });
    await strapi.documents('api::book.book').publish({ documentId: doc.documentId });
    return doc;
  }

  it('returns name, description and books[{ title, slug }] for a valid slug', async () => {
    const book = await createPublishedBook('Dom Casmurro', 'dom-casmurro');
    const description = [
      {
        type: 'paragraph' as const,
        children: [{ type: 'text' as const, text: 'Clássicos da literatura brasileira.' }],
      },
    ];
    const collection = await strapi.documents('api::collection.collection').create({
      data: {
        name: 'Clássicos Brasileiros',
        slug: 'classicos-brasileiros',
        description,
        books: [book.documentId],
      },
    });
    await strapi
      .documents('api::collection.collection')
      .publish({ documentId: collection.documentId });

    const res = await authGet('/api/collection/classicos-brasileiros').expect(200);

    expect(res.body.data.name).toBe('Clássicos Brasileiros');
    expect(res.body.data.description).toEqual(description);
    expect(res.body.data.books).toHaveLength(1);
    expect(res.body.data.books[0]).toMatchObject({
      title: 'Dom Casmurro',
      slug: 'dom-casmurro',
    });
  });

  it('does not leak book fields outside the requested scope', async () => {
    const book = await strapi.documents('api::book.book').create({
      data: {
        title: 'Memórias Póstumas',
        slug: 'memorias-postumas',
        isbn: '9788535910662',
        format: 'Livro',
        publishing_year: 1881,
        cover: coverId,
      },
    });
    await strapi.documents('api::book.book').publish({ documentId: book.documentId });

    const collection = await strapi.documents('api::collection.collection').create({
      data: {
        name: 'Clássicos Brasileiros',
        slug: 'classicos-brasileiros',
        books: [book.documentId],
      },
    });
    await strapi
      .documents('api::collection.collection')
      .publish({ documentId: collection.documentId });

    const res = await authGet('/api/collection/classicos-brasileiros').expect(200);

    const bookKeys = Object.keys(res.body.data.books[0]);
    expect(bookKeys).toEqual(expect.arrayContaining(['title', 'slug']));
    expect(bookKeys).not.toContain('isbn');
    expect(bookKeys).not.toContain('format');
    expect(bookKeys).not.toContain('publishing_year');
  });

  it('returns 404 for a non-existent slug', async () => {
    const res = await authGet('/api/collection/nao-existe');
    expect(res.status).toBe(404);
  });

  it('does not return a draft-only collection', async () => {
    await strapi.documents('api::collection.collection').create({
      data: { name: 'Rascunho', slug: 'rascunho' },
    });

    const res = await authGet('/api/collection/rascunho');
    expect(res.status).toBe(404);
  });

  it('rejects requests without an API token', async () => {
    const collection = await strapi.documents('api::collection.collection').create({
      data: { name: 'Clássicos Brasileiros', slug: 'classicos-brasileiros' },
    });
    await strapi
      .documents('api::collection.collection')
      .publish({ documentId: collection.documentId });

    const res = await request(strapi.server.httpServer).get(
      '/api/collection/classicos-brasileiros'
    );
    expect([401, 403]).toContain(res.status);
  });
});
