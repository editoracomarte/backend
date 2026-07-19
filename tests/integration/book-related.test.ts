import request from 'supertest';
import type { Core } from '@strapi/strapi';
import { setupStrapi, cleanupStrapi } from '../helpers/strapi';
import { createReadOnlyToken } from '../helpers/tokens';
import { createUploadFile } from '../helpers/uploads';

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
  await strapi.db.query('api::book.book').deleteMany({});
  await strapi.db.query('api::author.author').deleteMany({});
  await strapi.db.query('api::collection.collection').deleteMany({});
  await strapi.db.query('api::genre.genre').deleteMany({});
});

const slugify = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

async function createAuthor(name: string) {
  const doc = await strapi.documents('api::author.author').create({
    data: { name, slug: slugify(name) },
  });
  await strapi.documents('api::author.author').publish({ documentId: doc.documentId });
  return doc.documentId;
}

async function createCollection(name: string) {
  const doc = await strapi.documents('api::collection.collection').create({
    data: { name, slug: slugify(name) },
  });
  await strapi.documents('api::collection.collection').publish({ documentId: doc.documentId });
  return doc.documentId;
}

async function createGenre(name: string) {
  const doc = await strapi.documents('api::genre.genre').create({
    data: { name, slug: slugify(name) },
  });
  return doc.documentId;
}

interface BookRels {
  authors?: string[];
  collections?: string[];
  genres?: string[];
  year?: number;
}

async function createBook(title: string, rels: BookRels = {}) {
  const doc = await strapi.documents('api::book.book').create({
    data: {
      title,
      slug: slugify(title),
      publishing_year: rels.year ?? 2000,
      authors: rels.authors ?? [],
      collections: rels.collections ?? [],
      genres: rels.genres ?? [],
      cover: coverId,
    },
  });
  await strapi.documents('api::book.book').publish({ documentId: doc.documentId });
  return doc;
}

const get = (slug: string) =>
  request(strapi.server.httpServer)
    .get(`/api/books/${slug}/related`)
    .set('Authorization', `Bearer ${token}`);

describe('GET /api/books/:slug/related', () => {
  it('returns 404 when the base book does not exist', async () => {
    await get('nao-existe').expect(404);
  });

  it('fills to 5 with recent books when the base shares nothing', async () => {
    const author = await createAuthor('Autor Solo');
    await createBook('Obra Isolada', { authors: [author] });
    for (let i = 0; i < 6; i++) {
      await createBook(`Recente ${i}`, { year: 2010 + i });
    }

    const res = await get('obra-isolada').expect(200);

    expect(res.body.data).toHaveLength(5);
    const slugs = res.body.data.map((o: { slug: string }) => o.slug);
    expect(slugs).not.toContain('obra-isolada');
    // Newest fillers first (2015..2011).
    expect(slugs.slice(0, 2)).toEqual(['recente-5', 'recente-4']);
  });

  it('ranks author > collection > genre, then tops up with recent books', async () => {
    const author = await createAuthor('Marcelo');
    const collection = await createCollection('Coleção Preta');
    const genre = await createGenre('HQ');

    await createBook('Base', { authors: [author], collections: [collection], genres: [genre] });
    const porGenero = await createBook('Por Gênero', { genres: [genre] });
    const porAutor = await createBook('Por Autor', { authors: [author] });
    const porColecao = await createBook('Por Coleção', { collections: [collection] });
    // Two extra unrelated books to top the list up to 5.
    await createBook('Avulsa A', { year: 2001 });
    await createBook('Avulsa B', { year: 2002 });

    const res = await get('base').expect(200);

    expect(res.body.data).toHaveLength(5);
    // The three genuinely-related books come first, in weighted order.
    expect(res.body.data.slice(0, 3).map((o: { slug: string }) => o.slug)).toEqual([
      porAutor.slug,
      porColecao.slug,
      porGenero.slug,
    ]);
  });

  it('excludes the base book itself and caps the list at 5', async () => {
    const genre = await createGenre('História');
    await createBook('Base', { genres: [genre] });
    for (let i = 0; i < 7; i++) {
      await createBook(`Vizinha ${i}`, { genres: [genre], year: 2000 + i });
    }

    const res = await get('base').expect(200);

    expect(res.body.data).toHaveLength(5);
    expect(res.body.data.map((o: { slug: string }) => o.slug)).not.toContain('base');
  });

  it('omits the score by default, exposing only the public fields', async () => {
    const author = await createAuthor('Ana');
    await createBook('Base', { authors: [author] });
    await createBook('Vizinha', { authors: [author], year: 2024 });

    const res = await get('base').expect(200);

    expect(res.body.data[0]).toEqual({
      id: expect.any(Number),
      documentId: expect.any(String),
      title: 'Vizinha',
      slug: 'vizinha',
      publishing_year: 2024,
    });
  });

  it('exposes the score with ?showScore, using 0 for fallback fillers', async () => {
    const author = await createAuthor('Ana');
    await createBook('Base', { authors: [author] });
    await createBook('Vizinha', { authors: [author], year: 2024 });
    await createBook('Filler', { year: 2023 });

    const res = await request(strapi.server.httpServer)
      .get('/api/books/base/related?showScore')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.data[0]).toMatchObject({ slug: 'vizinha', score: 3 }); // 3·1 author
    expect(res.body.data[1]).toMatchObject({ slug: 'filler', score: 0 }); // fallback
  });

  it('honors ?limit to change how many books are returned', async () => {
    const genre = await createGenre('História');
    await createBook('Base', { genres: [genre] });
    for (let i = 0; i < 6; i++) {
      await createBook(`Vizinha ${i}`, { genres: [genre], year: 2000 + i });
    }

    const res = await request(strapi.server.httpServer)
      .get('/api/books/base/related?limit=3')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.data).toHaveLength(3);
  });

  it('falls back to the default of 5 for an invalid ?limit', async () => {
    const genre = await createGenre('História');
    await createBook('Base', { genres: [genre] });
    for (let i = 0; i < 6; i++) {
      await createBook(`Vizinha ${i}`, { genres: [genre], year: 2000 + i });
    }

    const res = await request(strapi.server.httpServer)
      .get('/api/books/base/related?limit=abc')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.data).toHaveLength(5);
  });
});
