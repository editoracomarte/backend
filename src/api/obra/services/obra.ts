/**
 * obra service
 */

import { factories } from '@strapi/strapi';

import { selectFeatured } from './featured';
import { obraBySlugQuery, firstOrNull } from './by-slug';

export default factories.createCoreService('api::obra.obra', ({ strapi }) => ({
  async findFeatured() {
    const allObras = await strapi.documents('api::obra.obra').findMany({
      status: 'published',
      sort: 'anoDePublicacao:desc',
      fields: ['titulo', 'slug', 'anoDePublicacao'],
    });

    return selectFeatured(allObras);
  },

  async findOneBySlug(slug: string) {
    const results = await strapi.documents('api::obra.obra').findMany(obraBySlugQuery(slug));

    return firstOrNull(results);
  },
}));
