import request from 'supertest';
import type { Core } from '@strapi/strapi';
import { setupStrapi, cleanupStrapi } from '../helpers/strapi';
import { grantPublicAccess } from '../helpers/permissions';

describe('Obra public API', () => {
  let strapi: Core.Strapi;

  beforeAll(async () => {
    strapi = await setupStrapi();
    await grantPublicAccess(strapi, 'api::obra.obra', ['find', 'findOne']);
    await grantPublicAccess(strapi, 'api::autor.autor', ['find', 'findOne']);
    await grantPublicAccess(strapi, 'api::colecao.colecao', ['find', 'findOne']);
    await grantPublicAccess(strapi, 'api::genero.genero', ['find', 'findOne']);
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

  it('should return an empty list when no obras exist', async () => {
    const res = await request(strapi.server.httpServer).get('/api/obras');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('should expose a created obra via findOne', async () => {
    const created = await strapi.documents('api::obra.obra').create({
      data: {
        titulo: 'Dom Casmurro',
        slug: 'dom-casmurro',
        isbn: '978-85-254-3296-4',
        anoDePublicacao: 1899,
        numeroDePaginas: 256,
      },
      status: 'published',
    });

    const res = await request(strapi.server.httpServer).get(`/api/obras/${created.documentId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.titulo).toBe('Dom Casmurro');
  });

  it('should reject creation when titulo is missing', async () => {
    await expect(
      strapi.documents('api::obra.obra').create({
        // @ts-expect-error — intentionally omitting required field
        data: { slug: 'sem-titulo' },
        status: 'published',
      })
    ).rejects.toThrow();
  });

  it('should reject creation when slug is missing', async () => {
    await expect(
      strapi.documents('api::obra.obra').create({
        // @ts-expect-error — intentionally omitting required field
        data: { titulo: 'Sem Slug' },
        status: 'published',
      })
    ).rejects.toThrow();
  });

  it('should reject creation when ISBN format is invalid', async () => {
    await expect(
      strapi.documents('api::obra.obra').create({
        data: {
          titulo: 'Memórias Póstumas de Brás Cubas',
          slug: 'memorias-postumas-de-bras-cubas',
          isbn: 'not-a-real-isbn',
        },
        status: 'published',
      })
    ).rejects.toThrow();
  });

  it('should reject creation when ISSN format is invalid', async () => {
    await expect(
      strapi.documents('api::obra.obra').create({
        data: {
          titulo: 'Revista Inválida',
          slug: 'revista-invalida',
          issn: 'not-an-issn',
        },
        status: 'published',
      })
    ).rejects.toThrow();
  });

  it('should reject creation when ISBN is already used by another obra', async () => {
    await strapi.documents('api::obra.obra').create({
      data: {
        titulo: 'O Cortiço',
        slug: 'o-cortico',
        isbn: '978-85-254-3296-4',
      },
      status: 'published',
    });
    await expect(
      strapi.documents('api::obra.obra').create({
        data: {
          titulo: 'Iracema',
          slug: 'iracema',
          isbn: '978-85-254-3296-4',
        },
        status: 'published',
      })
    ).rejects.toThrow();
  });

  it('should reject creation when ISSN is already used by another obra', async () => {
    await strapi.documents('api::obra.obra').create({
      data: {
        titulo: 'Revista A',
        slug: 'revista-a',
        issn: '1234-5678',
      },
      status: 'published',
    });
    await expect(
      strapi.documents('api::obra.obra').create({
        data: {
          titulo: 'Revista B',
          slug: 'revista-b',
          issn: '1234-5678',
        },
        status: 'published',
      })
    ).rejects.toThrow();
  });

  it('should expose associated autoria (manyToMany) when populated', async () => {
    const autor = await strapi.documents('api::autor.autor').create({
      data: { nome: 'Machado de Assis', slug: 'machado-de-assis' },
      status: 'published',
    });
    const obra = await strapi.documents('api::obra.obra').create({
      data: {
        titulo: 'Dom Casmurro',
        slug: 'dom-casmurro',
        autoria: [autor.documentId],
      },
    });
    await strapi.documents('api::obra.obra').publish({ documentId: obra.documentId });

    const res = await request(strapi.server.httpServer).get(
      `/api/obras/${obra.documentId}?populate=autoria`
    );
    expect(res.status).toBe(200);
    expect(res.body.data.autoria).toHaveLength(1);
    expect(res.body.data.autoria[0].nome).toBe('Machado de Assis');
  });

  it('should expose associated colecao (manyToMany) when populated', async () => {
    const colecao = await strapi.documents('api::colecao.colecao').create({
      data: {
        nome: 'Clássicos da Literatura Brasileira',
        slug: 'classicos-da-literatura-brasileira',
      },
      status: 'published',
    });
    const obra = await strapi.documents('api::obra.obra').create({
      data: {
        titulo: 'Dom Casmurro',
        slug: 'dom-casmurro',
        colecao: [colecao.documentId],
      },
    });
    await strapi.documents('api::obra.obra').publish({ documentId: obra.documentId });

    const res = await request(strapi.server.httpServer).get(
      `/api/obras/${obra.documentId}?populate=colecao`
    );
    expect(res.status).toBe(200);
    expect(res.body.data.colecao).toHaveLength(1);
    expect(res.body.data.colecao[0].nome).toBe('Clássicos da Literatura Brasileira');
  });

  it('should expose associated generos (manyToMany) when populated', async () => {
    const genero = await strapi.documents('api::genero.genero').create({
      data: { nome: 'Romance', slug: 'romance' },
    });
    const obra = await strapi.documents('api::obra.obra').create({
      data: {
        titulo: 'Dom Casmurro',
        slug: 'dom-casmurro',
        generos: [genero.documentId],
      },
    });
    await strapi.documents('api::obra.obra').publish({ documentId: obra.documentId });

    const res = await request(strapi.server.httpServer).get(
      `/api/obras/${obra.documentId}?populate=generos`
    );
    expect(res.status).toBe(200);
    expect(res.body.data.generos).toHaveLength(1);
    expect(res.body.data.generos[0].nome).toBe('Romance');
  });

  it('should hide a draft obra from the public find endpoint', async () => {
    await strapi.documents('api::obra.obra').create({
      data: { titulo: 'Capitu (draft)', slug: 'capitu-draft' },
    });

    const res = await request(strapi.server.httpServer).get('/api/obras');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('should expose an obra in the public find endpoint after publish', async () => {
    const created = await strapi.documents('api::obra.obra').create({
      data: { titulo: 'Memórias de um Sargento de Milícias', slug: 'memorias-sargento-milicias' },
    });

    let res = await request(strapi.server.httpServer).get('/api/obras');
    expect(res.body.data).toEqual([]);

    await strapi.documents('api::obra.obra').publish({ documentId: created.documentId });

    res = await request(strapi.server.httpServer).get('/api/obras');
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].titulo).toBe('Memórias de um Sargento de Milícias');
  });
});
