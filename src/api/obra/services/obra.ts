/**
 * obra service
 */

import { factories } from '@strapi/strapi';

function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

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
