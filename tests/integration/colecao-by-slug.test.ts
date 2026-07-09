import request from 'supertest';
import type { Core } from '@strapi/strapi';
import { setupStrapi, cleanupStrapi } from '../helpers/strapi';
import { createReadOnlyToken } from '../helpers/tokens';

describe('GET /api/collection/:slug', () => {
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
    await strapi.db.query('api::colecao.colecao').deleteMany({});
    await strapi.db.query('api::obra.obra').deleteMany({});
  });

  function authGet(path: string) {
    return request(strapi.server.httpServer).get(path).set('Authorization', `Bearer ${token}`);
  }

  async function createPublishedObra(titulo: string, slug: string) {
    const doc = await strapi.documents('api::obra.obra').create({
      data: { titulo, slug },
    });
    await strapi.documents('api::obra.obra').publish({ documentId: doc.documentId });
    return doc;
  }

  it('returns nome, descricao and obras[{ titulo, slug }] for a valid slug', async () => {
    const obra = await createPublishedObra('Dom Casmurro', 'dom-casmurro');
    const descricao = [
      {
        type: 'paragraph' as const,
        children: [{ type: 'text' as const, text: 'Clássicos da literatura brasileira.' }],
      },
    ];
    const colecao = await strapi.documents('api::colecao.colecao').create({
      data: {
        nome: 'Clássicos Brasileiros',
        slug: 'classicos-brasileiros',
        descricao,
        obras: [obra.documentId],
      },
    });
    await strapi.documents('api::colecao.colecao').publish({ documentId: colecao.documentId });

    const res = await authGet('/api/collection/classicos-brasileiros').expect(200);

    expect(res.body.data.nome).toBe('Clássicos Brasileiros');
    expect(res.body.data.descricao).toEqual(descricao);
    expect(res.body.data.obras).toHaveLength(1);
    expect(res.body.data.obras[0]).toMatchObject({
      titulo: 'Dom Casmurro',
      slug: 'dom-casmurro',
    });
  });

  it('does not leak obra fields outside the requested scope', async () => {
    const obra = await strapi.documents('api::obra.obra').create({
      data: {
        titulo: 'Memórias Póstumas',
        slug: 'memorias-postumas',
        isbn: '9788535910662',
        formato: 'Livro',
        anoDePublicacao: 1881,
      },
    });
    await strapi.documents('api::obra.obra').publish({ documentId: obra.documentId });

    const colecao = await strapi.documents('api::colecao.colecao').create({
      data: {
        nome: 'Clássicos Brasileiros',
        slug: 'classicos-brasileiros',
        obras: [obra.documentId],
      },
    });
    await strapi.documents('api::colecao.colecao').publish({ documentId: colecao.documentId });

    const res = await authGet('/api/collection/classicos-brasileiros').expect(200);

    const obraKeys = Object.keys(res.body.data.obras[0]);
    expect(obraKeys).toEqual(expect.arrayContaining(['titulo', 'slug']));
    expect(obraKeys).not.toContain('isbn');
    expect(obraKeys).not.toContain('formato');
    expect(obraKeys).not.toContain('anoDePublicacao');
  });

  it('returns 404 for a non-existent slug', async () => {
    const res = await authGet('/api/collection/nao-existe');
    expect(res.status).toBe(404);
  });

  it('does not return a draft-only colecao', async () => {
    await strapi.documents('api::colecao.colecao').create({
      data: { nome: 'Rascunho', slug: 'rascunho' },
    });

    const res = await authGet('/api/collection/rascunho');
    expect(res.status).toBe(404);
  });

  it('rejects requests without an API token', async () => {
    const colecao = await strapi.documents('api::colecao.colecao').create({
      data: { nome: 'Clássicos Brasileiros', slug: 'classicos-brasileiros' },
    });
    await strapi.documents('api::colecao.colecao').publish({ documentId: colecao.documentId });

    const res = await request(strapi.server.httpServer).get('/api/collection/classicos-brasileiros');
    expect([401, 403]).toContain(res.status);
  });
});
