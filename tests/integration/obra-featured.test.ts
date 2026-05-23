import request from 'supertest';
import type { Core } from '@strapi/strapi';
import { setupStrapi, cleanupStrapi } from '../helpers/strapi';
import { grantPublicAccess } from '../helpers/permissions';

let strapi: Core.Strapi;

beforeAll(async () => {
  strapi = await setupStrapi();
  await grantPublicAccess(strapi, 'api::obra.obra', ['findFeatured']);
});

afterAll(async () => {
  await strapi.db.query('api::obra.obra').deleteMany({});
  await cleanupStrapi();
});

afterEach(async () => {
  await strapi.db.query('api::obra.obra').deleteMany({});
});

async function createAndPublishObra(titulo: string, anoDePublicacao: number) {
  const doc = await strapi.documents('api::obra.obra').create({
    data: {
      titulo,
      slug: titulo.toLowerCase().replace(/\s/g, '-'),
      anoDePublicacao,
    },
  });
  await strapi.documents('api::obra.obra').publish({ documentId: doc.documentId });
  return doc;
}

describe('GET /api/obras/featured', () => {
  it('returns up to 12 obras', async () => {
    for (let i = 0; i < 15; i++) {
      await createAndPublishObra(`Obra ${i}`, 2000 + i);
    }

    const res = await request(strapi.server.httpServer).get('/api/obras/featured').expect(200);

    expect(res.body.data).toHaveLength(12);
  });

  it('always includes the 6 most recent obras', async () => {
    for (let i = 0; i < 15; i++) {
      await createAndPublishObra(`Obra ${i}`, 2000 + i);
    }

    const res = await request(strapi.server.httpServer).get('/api/obras/featured').expect(200);

    const years: number[] = res.body.data.map(
      (o: { anoDePublicacao: number }) => o.anoDePublicacao
    );

    for (const year of [2009, 2010, 2011, 2012, 2013, 2014]) {
      expect(years).toContain(year);
    }
  });

  it('returns all obras when total is less than 12', async () => {
    for (let i = 0; i < 5; i++) {
      await createAndPublishObra(`Pequena ${i}`, 2020 + i);
    }

    const res = await request(strapi.server.httpServer).get('/api/obras/featured').expect(200);

    expect(res.body.data).toHaveLength(5);
  });
});
