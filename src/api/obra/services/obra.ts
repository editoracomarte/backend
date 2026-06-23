/**
 * obra service
 */

import { factories } from '@strapi/strapi';

import { shuffle } from '../../../utils/shuffle';

export default factories.createCoreService('api::obra.obra', ({ strapi }) => ({
  async findFeatured() {
    const allObras = await strapi.documents('api::obra.obra').findMany({
      status: 'published',
      sort: 'anoDePublicacao:desc',
      fields: ['titulo', 'slug', 'anoDePublicacao'],
    });

    const recent = allObras.slice(0, 6);
    const random = shuffle(allObras.slice(6)).slice(0, 6);

    return shuffle([...recent, ...random]);
  },
}));
