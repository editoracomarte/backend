import request from 'supertest';
import type { Core } from '@strapi/strapi';
import { setupStrapi, cleanupStrapi } from '../helpers/strapi';
import { createReadOnlyToken } from '../helpers/tokens';

describe('Genero public API', () => {
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
    await strapi.db.query('api::genero.genero').deleteMany({});
    await strapi.db.query('api::obra.obra').deleteMany({});
  });

  it('should return an empty list when no generos exist', async () => {
    const res = await request(strapi.server.httpServer)
      .get('/api/generos')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('should expose a created genero via findOne', async () => {
    const created = await strapi.documents('api::genero.genero').create({
      data: { nome: 'Romance', slug: 'romance' },
    });

    const res = await request(strapi.server.httpServer)
      .get(`/api/generos/${created.documentId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.nome).toBe('Romance');
  });

  it('should reject creation when nome is missing', async () => {
    await expect(
      strapi.documents('api::genero.genero').create({
        // @ts-expect-error — intentionally omitting required field
        data: { slug: 'sem-nome' },
      })
    ).rejects.toThrow();
  });

  it('should reject creation when nome is already used by another genero', async () => {
    await strapi.documents('api::genero.genero').create({
      data: { nome: 'Romance', slug: 'romance' },
    });
    await expect(
      strapi.documents('api::genero.genero').create({
        data: { nome: 'Romance', slug: 'romance-2' },
      })
    ).rejects.toThrow();
  });

  it('should always expose generos publicly (draftAndPublish: false)', async () => {
    await strapi.documents('api::genero.genero').create({
      data: { nome: 'Poesia', slug: 'poesia' },
    });

    const res = await request(strapi.server.httpServer)
      .get('/api/generos')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].nome).toBe('Poesia');
  });

  it('should expose associated obras (manyToMany) when populated', async () => {
    const obra = await strapi.documents('api::obra.obra').create({
      data: { titulo: 'Dom Casmurro', slug: 'dom-casmurro' },
      status: 'published',
    });
    const genero = await strapi.documents('api::genero.genero').create({
      data: {
        nome: 'Romance',
        slug: 'romance',
        obras: [obra.documentId],
      },
    });

    const res = await request(strapi.server.httpServer)
      .get(`/api/generos/${genero.documentId}?populate=obras`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.obras).toHaveLength(1);
    expect(res.body.data.obras[0].titulo).toBe('Dom Casmurro');
  });
});
