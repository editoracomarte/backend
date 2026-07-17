import request from 'supertest';
import type { Core } from '@strapi/strapi';
import { setupStrapi, cleanupStrapi } from '../helpers/strapi';
import { createReadOnlyToken } from '../helpers/tokens';

describe('GET /api/author/:slug', () => {
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

  function authGet(path: string) {
    return request(strapi.server.httpServer).get(path).set('Authorization', `Bearer ${token}`);
  }

  async function createPublishedBook(title: string, slug: string) {
    const doc = await strapi.documents('api::book.book').create({
      data: { title, slug },
    });
    await strapi.documents('api::book.book').publish({ documentId: doc.documentId });
    return doc;
  }

  it('returns name, description and books[{ title, slug }] for a valid slug', async () => {
    const book = await createPublishedBook('Dom Casmurro', 'dom-casmurro');
    const description = 'Escritor brasileiro.';
    const author = await strapi.documents('api::author.author').create({
      data: {
        name: 'Machado de Assis',
        slug: 'machado-de-assis',
        description,
        books: [book.documentId],
      },
    });
    await strapi.documents('api::author.author').publish({ documentId: author.documentId });

    const res = await authGet('/api/author/machado-de-assis').expect(200);

    expect(res.body.data.name).toBe('Machado de Assis');
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
      },
    });
    await strapi.documents('api::book.book').publish({ documentId: book.documentId });

    const author = await strapi.documents('api::author.author').create({
      data: {
        name: 'Machado de Assis',
        slug: 'machado-de-assis',
        books: [book.documentId],
      },
    });
    await strapi.documents('api::author.author').publish({ documentId: author.documentId });

    const res = await authGet('/api/author/machado-de-assis').expect(200);

    const bookKeys = Object.keys(res.body.data.books[0]);
    expect(bookKeys).toEqual(expect.arrayContaining(['title', 'slug']));
    expect(bookKeys).not.toContain('isbn');
    expect(bookKeys).not.toContain('format');
    expect(bookKeys).not.toContain('publishing_year');
  });

  it('returns 404 for a non-existent slug', async () => {
    const res = await authGet('/api/author/nao-existe');
    expect(res.status).toBe(404);
  });

  it('does not return a draft-only author', async () => {
    await strapi.documents('api::author.author').create({
      data: { name: 'Rascunho', slug: 'rascunho' },
    });

    const res = await authGet('/api/author/rascunho');
    expect(res.status).toBe(404);
  });

  it('rejects requests without an API token', async () => {
    const author = await strapi.documents('api::author.author').create({
      data: { name: 'Machado de Assis', slug: 'machado-de-assis' },
    });
    await strapi.documents('api::author.author').publish({ documentId: author.documentId });

    const res = await request(strapi.server.httpServer).get('/api/author/machado-de-assis');
    expect([401, 403]).toContain(res.status);
  });
});
