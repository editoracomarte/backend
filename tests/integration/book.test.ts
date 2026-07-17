import request from 'supertest';
import type { Core } from '@strapi/strapi';
import { setupStrapi, cleanupStrapi } from '../helpers/strapi';
import { createReadOnlyToken } from '../helpers/tokens';

describe('Book public API', () => {
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
  });

  it('should return an empty list when no books exist', async () => {
    const res = await request(strapi.server.httpServer)
      .get('/api/books')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('should expose a created book via findOne', async () => {
    const created = await strapi.documents('api::book.book').create({
      data: {
        title: 'Dom Casmurro',
        slug: 'dom-casmurro',
        isbn: '978-85-254-3296-4',
        publishing_year: 1899,
        page_num: 256,
      },
      status: 'published',
    });

    const res = await request(strapi.server.httpServer)
      .get(`/api/books/${created.documentId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Dom Casmurro');
  });

  it('should reject creation when title is missing', async () => {
    await expect(
      strapi.documents('api::book.book').create({
        // @ts-expect-error — intentionally omitting required field
        data: { slug: 'sem-titulo' },
        status: 'published',
      })
    ).rejects.toThrow();
  });

  it('should reject creation when slug is missing', async () => {
    await expect(
      strapi.documents('api::book.book').create({
        // @ts-expect-error — intentionally omitting required field
        data: { title: 'Sem Slug' },
        status: 'published',
      })
    ).rejects.toThrow();
  });

  it('should reject creation when ISBN format is invalid', async () => {
    await expect(
      strapi.documents('api::book.book').create({
        data: {
          title: 'Memórias Póstumas de Brás Cubas',
          slug: 'memorias-postumas-de-bras-cubas',
          isbn: 'not-a-real-isbn',
        },
        status: 'published',
      })
    ).rejects.toThrow();
  });

  it('should reject creation when ISSN format is invalid', async () => {
    await expect(
      strapi.documents('api::book.book').create({
        data: {
          title: 'Revista Inválida',
          slug: 'revista-invalida',
          issn: 'not-an-issn',
        },
        status: 'published',
      })
    ).rejects.toThrow();
  });

  it('should reject creation when ISBN is already used by another book', async () => {
    await strapi.documents('api::book.book').create({
      data: {
        title: 'O Cortiço',
        slug: 'o-cortico',
        isbn: '978-85-254-3296-4',
      },
      status: 'published',
    });
    await expect(
      strapi.documents('api::book.book').create({
        data: {
          title: 'Iracema',
          slug: 'iracema',
          isbn: '978-85-254-3296-4',
        },
        status: 'published',
      })
    ).rejects.toThrow();
  });

  it('should reject creation when ISSN is already used by another book', async () => {
    await strapi.documents('api::book.book').create({
      data: {
        title: 'Revista A',
        slug: 'revista-a',
        issn: '1234-5678',
      },
      status: 'published',
    });
    await expect(
      strapi.documents('api::book.book').create({
        data: {
          title: 'Revista B',
          slug: 'revista-b',
          issn: '1234-5678',
        },
        status: 'published',
      })
    ).rejects.toThrow();
  });

  it('should expose associated authors (manyToMany) when populated', async () => {
    const author = await strapi.documents('api::author.author').create({
      data: { name: 'Machado de Assis', slug: 'machado-de-assis' },
      status: 'published',
    });
    const book = await strapi.documents('api::book.book').create({
      data: {
        title: 'Dom Casmurro',
        slug: 'dom-casmurro',
        authors: [author.documentId],
      },
    });
    await strapi.documents('api::book.book').publish({ documentId: book.documentId });

    const res = await request(strapi.server.httpServer)
      .get(`/api/books/${book.documentId}?populate=authors`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.authors).toHaveLength(1);
    expect(res.body.data.authors[0].name).toBe('Machado de Assis');
  });

  it('should expose associated collections (manyToMany) when populated', async () => {
    const collection = await strapi.documents('api::collection.collection').create({
      data: {
        name: 'Clássicos da Literatura Brasileira',
        slug: 'classicos-da-literatura-brasileira',
      },
      status: 'published',
    });
    const book = await strapi.documents('api::book.book').create({
      data: {
        title: 'Dom Casmurro',
        slug: 'dom-casmurro',
        collections: [collection.documentId],
      },
    });
    await strapi.documents('api::book.book').publish({ documentId: book.documentId });

    const res = await request(strapi.server.httpServer)
      .get(`/api/books/${book.documentId}?populate=collections`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.collections).toHaveLength(1);
    expect(res.body.data.collections[0].name).toBe('Clássicos da Literatura Brasileira');
  });

  it('should expose associated genres (manyToMany) when populated', async () => {
    const genre = await strapi.documents('api::genre.genre').create({
      data: { name: 'Romance', slug: 'romance' },
    });
    const book = await strapi.documents('api::book.book').create({
      data: {
        title: 'Dom Casmurro',
        slug: 'dom-casmurro',
        genres: [genre.documentId],
      },
    });
    await strapi.documents('api::book.book').publish({ documentId: book.documentId });

    const res = await request(strapi.server.httpServer)
      .get(`/api/books/${book.documentId}?populate=genres`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.genres).toHaveLength(1);
    expect(res.body.data.genres[0].name).toBe('Romance');
  });

  it('should hide a draft book from the public find endpoint', async () => {
    await strapi.documents('api::book.book').create({
      data: { title: 'Capitu (draft)', slug: 'capitu-draft' },
    });

    const res = await request(strapi.server.httpServer)
      .get('/api/books')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('should expose a book in the public find endpoint after publish', async () => {
    const created = await strapi.documents('api::book.book').create({
      data: { title: 'Memórias de um Sargento de Milícias', slug: 'memorias-sargento-milicias' },
    });

    let res = await request(strapi.server.httpServer)
      .get('/api/books')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.data).toEqual([]);

    await strapi.documents('api::book.book').publish({ documentId: created.documentId });

    res = await request(strapi.server.httpServer)
      .get('/api/books')
      .set('Authorization', `Bearer ${token}`);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe('Memórias de um Sargento de Milícias');
  });
});
