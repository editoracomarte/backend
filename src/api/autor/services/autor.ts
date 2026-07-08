/**
 * autor service
 */

import { factories } from '@strapi/strapi';

import { autorBySlugQuery, firstOrNull } from './by-slug';

export default factories.createCoreService('api::autor.autor', ({ strapi }) => ({
  async findOneBySlug(slug: string) {
    const results = await strapi.documents('api::autor.autor').findMany(autorBySlugQuery(slug));

    return firstOrNull(results);
  },
}));
