import request from 'supertest';
import type { Core } from '@strapi/strapi';
import { setupStrapi, cleanupStrapi } from '../helpers/strapi';
import { grantPublicAccess } from '../helpers/permissions';

describe('Autor public API', () => {
  let strapi: Core.Strapi;

  beforeAll(async () => {
    strapi = await setupStrapi();
    await grantPublicAccess(strapi, 'api::autor.autor', ['find', 'findOne']);
    await grantPublicAccess(strapi, 'api::obra.obra', ['find', 'findOne']);
  });

  afterAll(async () => {
    await cleanupStrapi();
  });

  afterEach(async () => {
    await strapi.db.query('api::autor.autor').deleteMany({});
    await strapi.db.query('api::obra.obra').deleteMany({});
  });

  it('should return an empty list when no autores exist', async () => {
    const res = await request(strapi.server.httpServer).get('/api/autores');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('should expose a created autor via findOne', async () => {
    const created = await strapi.documents('api::autor.autor').create({
      data: { nome: 'Machado de Assis', slug: 'machado-de-assis' },
      status: 'published',
    });

    const res = await request(strapi.server.httpServer).get(`/api/autores/${created.documentId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.nome).toBe('Machado de Assis');
  });

  it('should reject creation when nome is missing', async () => {
    await expect(
      strapi.documents('api::autor.autor').create({
        // @ts-expect-error — intentionally omitting required field
        data: { slug: 'sem-nome' },
        status: 'published',
      })
    ).rejects.toThrow();
  });

  it('should reject creation when slug is missing', async () => {
    await expect(
      strapi.documents('api::autor.autor').create({
        // @ts-expect-error — intentionally omitting required field
        data: { nome: 'Sem Slug' },
        status: 'published',
      })
    ).rejects.toThrow();
  });

  it('should expose associated obras (manyToMany) when populated', async () => {
    const obra = await strapi.documents('api::obra.obra').create({
      data: { titulo: 'Dom Casmurro', slug: 'dom-casmurro' },
      status: 'published',
    });
    const autor = await strapi.documents('api::autor.autor').create({
      data: {
        nome: 'Machado de Assis',
        slug: 'machado-de-assis',
        obras: [obra.documentId],
      },
    });
    await strapi.documents('api::autor.autor').publish({ documentId: autor.documentId });

    const res = await request(strapi.server.httpServer).get(
      `/api/autores/${autor.documentId}?populate=obras`
    );
    expect(res.status).toBe(200);
    expect(res.body.data.obras).toHaveLength(1);
    expect(res.body.data.obras[0].titulo).toBe('Dom Casmurro');
  });

  it('should hide a draft autor from the public find endpoint', async () => {
    await strapi.documents('api::autor.autor').create({
      data: { nome: 'Carlos Drummond (draft)', slug: 'carlos-drummond-draft' },
    });

    const res = await request(strapi.server.httpServer).get('/api/autores');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});
