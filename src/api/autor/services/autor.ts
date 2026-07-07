/**
 * autor service
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreService('api::autor.autor', ({ strapi }) => ({
  async findOneBySlug(slug: string) {
    const [autor] = await strapi.documents('api::autor.autor').findMany({
      status: 'published',
      filters: { slug },
      fields: ['nome', 'descricao'],
      populate: {
        obras: {
          fields: ['titulo', 'slug'],
        },
      },
      limit: 1,
    });

    return autor ?? null;
  },
}));
