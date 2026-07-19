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
  await strapi.db.query('api::book.book').deleteMany({});
  await cleanupStrapi();
});

afterEach(async () => {
  await strapi.db.query('api::book.book').deleteMany({});
});

async function createAndPublishBook(title: string, publishing_year: number) {
  const doc = await strapi.documents('api::book.book').create({
    data: {
      title,
      slug: title.toLowerCase().replace(/\s/g, '-'),
      publishing_year,
    },
  });
  await strapi.documents('api::book.book').publish({ documentId: doc.documentId });
  return doc;
}

describe('GET /api/books/featured', () => {
  it('returns up to 12 books', async () => {
    for (let i = 0; i < 15; i++) {
      await createAndPublishBook(`Obra ${i}`, 2000 + i);
    }

    const res = await request(strapi.server.httpServer)
      .get('/api/books/featured')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.data).toHaveLength(12);
  });

  it('always includes the 6 most recent books', async () => {
    for (let i = 0; i < 15; i++) {
      await createAndPublishBook(`Obra ${i}`, 2000 + i);
    }

    const res = await request(strapi.server.httpServer)
      .get('/api/books/featured')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const years: number[] = res.body.data.map(
      (o: { publishing_year: number }) => o.publishing_year
    );

    for (const year of [2009, 2010, 2011, 2012, 2013, 2014]) {
      expect(years).toContain(year);
    }
  });

  it('returns all books when total is less than 12', async () => {
    for (let i = 0; i < 5; i++) {
      await createAndPublishBook(`Pequena ${i}`, 2020 + i);
    }

    const res = await request(strapi.server.httpServer)
      .get('/api/books/featured')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.data).toHaveLength(5);
  });

  it('returns only id, documentId, title, slug and publishing_year', async () => {
    await createAndPublishBook('Unica', 2024);

    const res = await request(strapi.server.httpServer)
      .get('/api/books/featured')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.data[0]).toEqual({
      id: expect.any(Number),
      documentId: expect.any(String),
      title: 'Unica',
      slug: 'unica',
      publishing_year: 2024,
    });
  });
});
