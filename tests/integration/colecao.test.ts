import request from 'supertest';
import type { Core } from '@strapi/strapi';
import { setupStrapi, cleanupStrapi } from '../helpers/strapi';
import { grantPublicAccess } from '../helpers/permissions';

describe('Colecao public API', () => {
  let strapi: Core.Strapi;

  beforeAll(async () => {
    strapi = await setupStrapi();
    await grantPublicAccess(strapi, 'api::colecao.colecao', ['find', 'findOne']);
    await grantPublicAccess(strapi, 'api::obra.obra', ['find', 'findOne']);
  });

  afterAll(async () => {
    await cleanupStrapi();
  });

  afterEach(async () => {
    await strapi.db.query('api::colecao.colecao').deleteMany({});
    await strapi.db.query('api::obra.obra').deleteMany({});
  });

  it('should return an empty list when no colecoes exist', async () => {
    const res = await request(strapi.server.httpServer).get('/api/colecoes');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('should expose a created colecao via findOne', async () => {
    const created = await strapi.documents('api::colecao.colecao').create({
      data: {
        nome: 'Clássicos da Literatura Brasileira',
        slug: 'classicos-da-literatura-brasileira',
      },
      status: 'published',
    });

    const res = await request(strapi.server.httpServer).get(`/api/colecoes/${created.documentId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.nome).toBe('Clássicos da Literatura Brasileira');
  });

  it('should reject creation when nome is missing', async () => {
    await expect(
      strapi.documents('api::colecao.colecao').create({
        // @ts-expect-error — intentionally omitting required field
        data: { slug: 'sem-nome' },
        status: 'published',
      })
    ).rejects.toThrow();
  });

  it('should expose associated obras (manyToMany) when populated', async () => {
    const obra = await strapi.documents('api::obra.obra').create({
      data: { titulo: 'Dom Casmurro', slug: 'dom-casmurro' },
      status: 'published',
    });
    const colecao = await strapi.documents('api::colecao.colecao').create({
      data: {
        nome: 'Clássicos da Literatura Brasileira',
        slug: 'classicos-da-literatura-brasileira',
        obras: [obra.documentId],
      },
    });
    await strapi.documents('api::colecao.colecao').publish({ documentId: colecao.documentId });

    const res = await request(strapi.server.httpServer).get(
      `/api/colecoes/${colecao.documentId}?populate=obras`
    );
    expect(res.status).toBe(200);
    expect(res.body.data.obras).toHaveLength(1);
    expect(res.body.data.obras[0].titulo).toBe('Dom Casmurro');
  });

  it('should hide a draft colecao from the public find endpoint', async () => {
    await strapi.documents('api::colecao.colecao').create({
      data: { nome: 'Coleção Draft' },
    });

    const res = await request(strapi.server.httpServer).get('/api/colecoes');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});
