import request from 'supertest';
import type { Core } from '@strapi/strapi';
import { setupStrapi, cleanupStrapi } from '../helpers/strapi';
import { createReadOnlyToken } from '../helpers/tokens';

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
  await strapi.db.query('api::obra.obra').deleteMany({});
  await strapi.db.query('api::autor.autor').deleteMany({});
  await strapi.db.query('api::colecao.colecao').deleteMany({});
  await strapi.db.query('api::genero.genero').deleteMany({});
});

const slugify = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

async function createAutor(nome: string) {
  const doc = await strapi.documents('api::autor.autor').create({
    data: { nome, slug: slugify(nome) },
  });
  await strapi.documents('api::autor.autor').publish({ documentId: doc.documentId });
  return doc.documentId;
}

async function createColecao(nome: string) {
  const doc = await strapi.documents('api::colecao.colecao').create({
    data: { nome, slug: slugify(nome) },
  });
  await strapi.documents('api::colecao.colecao').publish({ documentId: doc.documentId });
  return doc.documentId;
}

async function createGenero(nome: string) {
  const doc = await strapi.documents('api::genero.genero').create({
    data: { nome, slug: slugify(nome) },
  });
  return doc.documentId;
}

interface ObraRels {
  autoria?: string[];
  colecao?: string[];
  generos?: string[];
  ano?: number;
}

async function createObra(titulo: string, rels: ObraRels = {}) {
  const doc = await strapi.documents('api::obra.obra').create({
    data: {
      titulo,
      slug: slugify(titulo),
      anoDePublicacao: rels.ano ?? 2000,
      autoria: rels.autoria ?? [],
      colecao: rels.colecao ?? [],
      generos: rels.generos ?? [],
    },
  });
  await strapi.documents('api::obra.obra').publish({ documentId: doc.documentId });
  return doc;
}

const get = (slug: string) =>
  request(strapi.server.httpServer)
    .get(`/api/obras/${slug}/related`)
    .set('Authorization', `Bearer ${token}`);

describe('GET /api/obras/:slug/related', () => {
  it('returns 404 when the base obra does not exist', async () => {
    await get('nao-existe').expect(404);
  });

  it('fills to 5 with recent obras when the base shares nothing', async () => {
    const autor = await createAutor('Autor Solo');
    await createObra('Obra Isolada', { autoria: [autor] });
    for (let i = 0; i < 6; i++) {
      await createObra(`Recente ${i}`, { ano: 2010 + i });
    }

    const res = await get('obra-isolada').expect(200);

    expect(res.body.data).toHaveLength(5);
    const slugs = res.body.data.map((o: { slug: string }) => o.slug);
    expect(slugs).not.toContain('obra-isolada');
    // Newest fillers first (2015..2011).
    expect(slugs.slice(0, 2)).toEqual(['recente-5', 'recente-4']);
  });

  it('ranks author > collection > genre, then tops up with recent obras', async () => {
    const autor = await createAutor('Marcelo');
    const colecao = await createColecao('Coleção Preta');
    const genero = await createGenero('HQ');

    await createObra('Base', { autoria: [autor], colecao: [colecao], generos: [genero] });
    const porGenero = await createObra('Por Gênero', { generos: [genero] });
    const porAutor = await createObra('Por Autor', { autoria: [autor] });
    const porColecao = await createObra('Por Coleção', { colecao: [colecao] });
    // Two extra unrelated obras to top the list up to 5.
    await createObra('Avulsa A', { ano: 2001 });
    await createObra('Avulsa B', { ano: 2002 });

    const res = await get('base').expect(200);

    expect(res.body.data).toHaveLength(5);
    // The three genuinely-related obras come first, in weighted order.
    expect(res.body.data.slice(0, 3).map((o: { slug: string }) => o.slug)).toEqual([
      porAutor.slug,
      porColecao.slug,
      porGenero.slug,
    ]);
  });

  it('excludes the base obra itself and caps the list at 5', async () => {
    const genero = await createGenero('História');
    await createObra('Base', { generos: [genero] });
    for (let i = 0; i < 7; i++) {
      await createObra(`Vizinha ${i}`, { generos: [genero], ano: 2000 + i });
    }

    const res = await get('base').expect(200);

    expect(res.body.data).toHaveLength(5);
    expect(res.body.data.map((o: { slug: string }) => o.slug)).not.toContain('base');
  });

  it('omits the score by default, exposing only the public fields', async () => {
    const autor = await createAutor('Ana');
    await createObra('Base', { autoria: [autor] });
    await createObra('Vizinha', { autoria: [autor], ano: 2024 });

    const res = await get('base').expect(200);

    expect(res.body.data[0]).toEqual({
      id: expect.any(Number),
      documentId: expect.any(String),
      titulo: 'Vizinha',
      slug: 'vizinha',
      anoDePublicacao: 2024,
    });
  });

  it('exposes the score with ?showScore, using 0 for fallback fillers', async () => {
    const autor = await createAutor('Ana');
    await createObra('Base', { autoria: [autor] });
    await createObra('Vizinha', { autoria: [autor], ano: 2024 });
    await createObra('Filler', { ano: 2023 });

    const res = await request(strapi.server.httpServer)
      .get('/api/obras/base/related?showScore')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.data[0]).toMatchObject({ slug: 'vizinha', score: 3 }); // 3·1 autor
    expect(res.body.data[1]).toMatchObject({ slug: 'filler', score: 0 }); // fallback
  });

  it('honors ?limit to change how many obras are returned', async () => {
    const genero = await createGenero('História');
    await createObra('Base', { generos: [genero] });
    for (let i = 0; i < 6; i++) {
      await createObra(`Vizinha ${i}`, { generos: [genero], ano: 2000 + i });
    }

    const res = await request(strapi.server.httpServer)
      .get('/api/obras/base/related?limit=3')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.data).toHaveLength(3);
  });

  it('falls back to the default of 5 for an invalid ?limit', async () => {
    const genero = await createGenero('História');
    await createObra('Base', { generos: [genero] });
    for (let i = 0; i < 6; i++) {
      await createObra(`Vizinha ${i}`, { generos: [genero], ano: 2000 + i });
    }

    const res = await request(strapi.server.httpServer)
      .get('/api/obras/base/related?limit=abc')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.data).toHaveLength(5);
  });
});
