/**
 * collection controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::collection.collection', ({ strapi }) => ({
  async findOneBySlug(ctx) {
    const { slug } = ctx.params;

    const collection = await strapi.service('api::collection.collection').findOneBySlug(slug);

    if (!collection) {
      return ctx.notFound('Coleção não encontrada');
    }

    const sanitizedData = await this.sanitizeOutput(collection, ctx);
    return ctx.send({ data: sanitizedData });
  },
}));
