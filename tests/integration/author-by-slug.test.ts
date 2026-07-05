import request from 'supertest';
import type { Core } from '@strapi/strapi';
import { setupStrapi, cleanupStrapi } from '../helpers/strapi';
import { createScopedToken } from '../helpers/api-token';
import { grantPublicAccess } from '../helpers/permissions';

describe('GET /api/author/:slug', () => {
  let strapi: Core.Strapi;
  let token: string;

  beforeAll(async () => {
    strapi = await setupStrapi();
    // Grant Public read access to autor/obra to prove the route stays private:
    // it is gated by its own `findOneBySlug` scope, which Public never has, even
    // when the catalog's `find`/`findOne` are public.
    await grantPublicAccess(strapi, 'api::autor.autor', ['find', 'findOne']);
    await grantPublicAccess(strapi, 'api::obra.obra', ['find', 'findOne']);
    // Least-privilege custom token: the route action plus obra read access so the
    // populated `obras` relation survives sanitizeOutput.
    token = await createScopedToken(strapi, [
      'api::autor.autor.findOneBySlug',
      'api::obra.obra.find',
      'api::obra.obra.findOne',
    ]);
  });

  afterAll(async () => {
    await cleanupStrapi();
  });

  afterEach(async () => {
    await strapi.db.query('api::autor.autor').deleteMany({});
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
        children: [{ type: 'text' as const, text: 'Escritor brasileiro.' }],
      },
    ];
    const autor = await strapi.documents('api::autor.autor').create({
      data: {
        nome: 'Machado de Assis',
        slug: 'machado-de-assis',
        descricao,
        obras: [obra.documentId],
      },
    });
    await strapi.documents('api::autor.autor').publish({ documentId: autor.documentId });

    const res = await authGet('/api/author/machado-de-assis').expect(200);

    expect(res.body.data.nome).toBe('Machado de Assis');
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

    const autor = await strapi.documents('api::autor.autor').create({
      data: {
        nome: 'Machado de Assis',
        slug: 'machado-de-assis',
        obras: [obra.documentId],
      },
    });
    await strapi.documents('api::autor.autor').publish({ documentId: autor.documentId });

    const res = await authGet('/api/author/machado-de-assis').expect(200);

    const obraKeys = Object.keys(res.body.data.obras[0]);
    expect(obraKeys).toEqual(expect.arrayContaining(['titulo', 'slug']));
    expect(obraKeys).not.toContain('isbn');
    expect(obraKeys).not.toContain('formato');
    expect(obraKeys).not.toContain('anoDePublicacao');
  });

  it('returns 404 for a non-existent slug', async () => {
    const res = await authGet('/api/author/nao-existe');
    expect(res.status).toBe(404);
  });

  it('does not return a draft-only autor', async () => {
    await strapi.documents('api::autor.autor').create({
      data: { nome: 'Rascunho', slug: 'rascunho' },
    });

    const res = await authGet('/api/author/rascunho');
    expect(res.status).toBe(404);
  });

  it('rejects requests without an API token', async () => {
    const autor = await strapi.documents('api::autor.autor').create({
      data: { nome: 'Machado de Assis', slug: 'machado-de-assis' },
    });
    await strapi.documents('api::autor.autor').publish({ documentId: autor.documentId });

    const res = await request(strapi.server.httpServer).get('/api/author/machado-de-assis');
    expect([401, 403]).toContain(res.status);
  });
});
