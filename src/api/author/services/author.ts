/**
 * author service
 */

import { factories } from '@strapi/strapi';

import { authorBySlugQuery, firstOrNull } from './by-slug';

export default factories.createCoreService('api::author.author', ({ strapi }) => ({
  async findOneBySlug(slug: string) {
    const results = await strapi.documents('api::author.author').findMany(authorBySlugQuery(slug));

    return firstOrNull(results);
  },
}));
