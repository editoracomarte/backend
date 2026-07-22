import request from 'supertest';
import type { Core } from '@strapi/strapi';
import { setupStrapi, cleanupStrapi } from '../helpers/strapi';
import { createReadOnlyToken } from '../helpers/tokens';

describe('GET /api/book/:slug', () => {
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
    await strapi.db.query('api::book.book').deleteMany({});
    await strapi.db.query('api::author.author').deleteMany({});
    await strapi.db.query('api::collection.collection').deleteMany({});
    await strapi.db.query('api::genre.genre').deleteMany({});
    await strapi.db.query('plugin::upload.file').deleteMany({});
  });

  function authGet(path: string) {
    return request(strapi.server.httpServer).get(path).set('Authorization', `Bearer ${token}`);
  }

  let uploadSeq = 0;
  async function createUpload(overrides: Record<string, unknown> = {}) {
    uploadSeq += 1;
    return strapi.db.query('plugin::upload.file').create({
      data: {
        name: 'cover.jpg',
        hash: `cover_hash_${uploadSeq}`,
        ext: '.jpg',
        mime: 'image/jpeg',
        size: 10,
        url: `/uploads/cover_hash_${uploadSeq}.jpg`,
        provider: 'local',
        ...overrides,
      },
    });
  }

  it('returns the book fields and its relations for a valid slug', async () => {
    const author = await strapi.documents('api::author.author').create({
      data: { name: 'Machado de Assis', slug: 'machado-de-assis' },
    });
    await strapi.documents('api::author.author').publish({ documentId: author.documentId });

    const collection = await strapi.documents('api::collection.collection').create({
      data: { name: 'Clássicos', slug: 'classicos' },
    });
    await strapi
      .documents('api::collection.collection')
      .publish({ documentId: collection.documentId });

    const genre = await strapi.documents('api::genre.genre').create({
      data: { name: 'Romance', slug: 'romance' },
    });

    const description = [
      {
        type: 'paragraph' as const,
        children: [{ type: 'text' as const, text: 'Um clássico da literatura brasileira.' }],
      },
    ];

    const cover = await createUpload();

    const book = await strapi.documents('api::book.book').create({
      data: {
        title: 'Dom Casmurro',
        slug: 'dom-casmurro',
        description,
        isbn: '9788535910662',
        format: 'Livro',
        page_num: 256,
        publishing_year: 1899,
        store_url: 'https://loja.example.com/dom-casmurro',
        cover: cover.id,
        authors: [author.documentId],
        collections: [collection.documentId],
        genres: [genre.documentId],
      },
    });
    await strapi.documents('api::book.book').publish({ documentId: book.documentId });

    const res = await authGet('/api/book/dom-casmurro').expect(200);

    expect(res.body.data.title).toBe('Dom Casmurro');
    expect(res.body.data.description).toEqual(description);
    expect(res.body.data.isbn).toBe('9788535910662');
    expect(res.body.data.publishing_year).toBe(1899);
    expect(res.body.data.store_url).toBe('https://loja.example.com/dom-casmurro');
    expect(res.body.data.authors[0]).toMatchObject({
      name: 'Machado de Assis',
      slug: 'machado-de-assis',
    });
    expect(res.body.data.collections[0]).toMatchObject({ name: 'Clássicos', slug: 'classicos' });
    expect(res.body.data.genres[0]).toMatchObject({ name: 'Romance', slug: 'romance' });
  });

  it('returns the url of the cover and sample media', async () => {
    const cover = await createUpload({
      name: 'cover.jpg',
      hash: 'cover_hash',
      ext: '.jpg',
      mime: 'image/jpeg',
      url: '/uploads/cover_hash.jpg',
    });

    const sample = await createUpload({
      name: 'sample.pdf',
      hash: 'sample_hash',
      ext: '.pdf',
      mime: 'application/pdf',
      size: 20,
      url: '/uploads/sample_hash.pdf',
    });

    const book = await strapi.documents('api::book.book').create({
      data: {
        title: 'Dom Casmurro',
        slug: 'dom-casmurro',
        cover: cover.id,
        sample: sample.id,
      },
    });
    await strapi.documents('api::book.book').publish({ documentId: book.documentId });

    const res = await authGet('/api/book/dom-casmurro').expect(200);

    expect(res.body.data.cover.url).toBe('/uploads/cover_hash.jpg');
    expect(res.body.data.sample.url).toBe('/uploads/sample_hash.pdf');
  });

  it('does not leak relation fields outside the requested scope', async () => {
    const author = await strapi.documents('api::author.author').create({
      data: {
        name: 'Machado de Assis',
        slug: 'machado-de-assis',
        description: [
          { type: 'paragraph' as const, children: [{ type: 'text' as const, text: 'bio' }] },
        ],
      },
    });
    await strapi.documents('api::author.author').publish({ documentId: author.documentId });

    const cover = await createUpload();

    const book = await strapi.documents('api::book.book').create({
      data: {
        title: 'Dom Casmurro',
        slug: 'dom-casmurro',
        cover: cover.id,
        authors: [author.documentId],
      },
    });
    await strapi.documents('api::book.book').publish({ documentId: book.documentId });

    const res = await authGet('/api/book/dom-casmurro').expect(200);

    const authorKeys = Object.keys(res.body.data.authors[0]);
    expect(authorKeys).toEqual(expect.arrayContaining(['name', 'slug']));
    expect(authorKeys).not.toContain('description');
  });

  it('returns 404 for a non-existent slug', async () => {
    const res = await authGet('/api/book/nao-existe');
    expect(res.status).toBe(404);
  });

  it('does not return a draft-only book', async () => {
    const cover = await createUpload();
    await strapi.documents('api::book.book').create({
      data: { title: 'Rascunho', slug: 'rascunho', cover: cover.id },
    });

    const res = await authGet('/api/book/rascunho');
    expect(res.status).toBe(404);
  });

  it('does not shadow the core GET /api/books/:documentId findOne route', async () => {
    const cover = await createUpload();
    const book = await strapi.documents('api::book.book').create({
      data: { title: 'Dom Casmurro', slug: 'dom-casmurro', cover: cover.id },
    });
    await strapi.documents('api::book.book').publish({ documentId: book.documentId });

    const res = await authGet(`/api/books/${book.documentId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Dom Casmurro');
  });

  it('rejects requests without an API token', async () => {
    const cover = await createUpload();
    const book = await strapi.documents('api::book.book').create({
      data: { title: 'Dom Casmurro', slug: 'dom-casmurro', cover: cover.id },
    });
    await strapi.documents('api::book.book').publish({ documentId: book.documentId });

    const res = await request(strapi.server.httpServer).get('/api/book/dom-casmurro');
    expect([401, 403]).toContain(res.status);
  });
});
