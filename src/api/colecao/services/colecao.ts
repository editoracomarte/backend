/**
 * colecao service
 */

import { factories } from '@strapi/strapi';

import { colecaoBySlugQuery, firstOrNull } from './by-slug';

export default factories.createCoreService('api::colecao.colecao', ({ strapi }) => ({
  async findOneBySlug(slug: string) {
    const results = await strapi.documents('api::colecao.colecao').findMany(colecaoBySlugQuery(slug));

    return firstOrNull(results);
  },
}));
