/**
 * collection service
 */

import { factories } from '@strapi/strapi';

import { collectionBySlugQuery, firstOrNull } from './by-slug';

export default factories.createCoreService('api::collection.collection', ({ strapi }) => ({
  async findOneBySlug(slug: string) {
    const results = await strapi
      .documents('api::collection.collection')
      .findMany(collectionBySlugQuery(slug));

    return firstOrNull(results);
  },
}));
