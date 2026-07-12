import request from 'supertest';
import type { Core } from '@strapi/strapi';
import { setupStrapi, cleanupStrapi } from '../helpers/strapi';
import { createReadOnlyToken } from '../helpers/tokens';

describe('GET /api/obra/:slug', () => {
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

  function authGet(path: string) {
    return request(strapi.server.httpServer).get(path).set('Authorization', `Bearer ${token}`);
  }

  it('returns the obra fields and its relations for a valid slug', async () => {
    const autor = await strapi.documents('api::autor.autor').create({
      data: { nome: 'Machado de Assis', slug: 'machado-de-assis' },
    });
    await strapi.documents('api::autor.autor').publish({ documentId: autor.documentId });

    const colecao = await strapi.documents('api::colecao.colecao').create({
      data: { nome: 'Clássicos', slug: 'classicos' },
    });
    await strapi.documents('api::colecao.colecao').publish({ documentId: colecao.documentId });

    const genero = await strapi.documents('api::genero.genero').create({
      data: { nome: 'Romance', slug: 'romance' },
    });

    const descricao = [
      {
        type: 'paragraph' as const,
        children: [{ type: 'text' as const, text: 'Um clássico da literatura brasileira.' }],
      },
    ];

    const obra = await strapi.documents('api::obra.obra').create({
      data: {
        titulo: 'Dom Casmurro',
        slug: 'dom-casmurro',
        descricao,
        isbn: '9788535910662',
        formato: 'Livro',
        numeroDePaginas: 256,
        anoDePublicacao: 1899,
        autoria: [autor.documentId],
        colecao: [colecao.documentId],
        generos: [genero.documentId],
      },
    });
    await strapi.documents('api::obra.obra').publish({ documentId: obra.documentId });

    const res = await authGet('/api/obra/dom-casmurro').expect(200);

    expect(res.body.data.titulo).toBe('Dom Casmurro');
    expect(res.body.data.descricao).toEqual(descricao);
    expect(res.body.data.isbn).toBe('9788535910662');
    expect(res.body.data.anoDePublicacao).toBe(1899);
    expect(res.body.data.autoria[0]).toMatchObject({
      nome: 'Machado de Assis',
      slug: 'machado-de-assis',
    });
    expect(res.body.data.colecao[0]).toMatchObject({ nome: 'Clássicos', slug: 'classicos' });
    expect(res.body.data.generos[0]).toMatchObject({ nome: 'Romance', slug: 'romance' });
  });

  it('does not leak relation fields outside the requested scope', async () => {
    const autor = await strapi.documents('api::autor.autor').create({
      data: {
        nome: 'Machado de Assis',
        slug: 'machado-de-assis',
        descricao: [
          { type: 'paragraph' as const, children: [{ type: 'text' as const, text: 'bio' }] },
        ],
      },
    });
    await strapi.documents('api::autor.autor').publish({ documentId: autor.documentId });

    const obra = await strapi.documents('api::obra.obra').create({
      data: {
        titulo: 'Dom Casmurro',
        slug: 'dom-casmurro',
        autoria: [autor.documentId],
      },
    });
    await strapi.documents('api::obra.obra').publish({ documentId: obra.documentId });

    const res = await authGet('/api/obra/dom-casmurro').expect(200);

    const autorKeys = Object.keys(res.body.data.autoria[0]);
    expect(autorKeys).toEqual(expect.arrayContaining(['nome', 'slug']));
    expect(autorKeys).not.toContain('descricao');
  });

  it('returns 404 for a non-existent slug', async () => {
    const res = await authGet('/api/obra/nao-existe');
    expect(res.status).toBe(404);
  });

  it('does not return a draft-only obra', async () => {
    await strapi.documents('api::obra.obra').create({
      data: { titulo: 'Rascunho', slug: 'rascunho' },
    });

    const res = await authGet('/api/obra/rascunho');
    expect(res.status).toBe(404);
  });

  it('does not shadow the core GET /api/obras/:documentId findOne route', async () => {
    const obra = await strapi.documents('api::obra.obra').create({
      data: { titulo: 'Dom Casmurro', slug: 'dom-casmurro' },
    });
    await strapi.documents('api::obra.obra').publish({ documentId: obra.documentId });

    const res = await authGet(`/api/obras/${obra.documentId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.titulo).toBe('Dom Casmurro');
  });

  it('rejects requests without an API token', async () => {
    const obra = await strapi.documents('api::obra.obra').create({
      data: { titulo: 'Dom Casmurro', slug: 'dom-casmurro' },
    });
    await strapi.documents('api::obra.obra').publish({ documentId: obra.documentId });

    const res = await request(strapi.server.httpServer).get('/api/obra/dom-casmurro');
    expect([401, 403]).toContain(res.status);
  });
});
