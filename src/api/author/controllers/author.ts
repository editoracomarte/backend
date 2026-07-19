/**
 * author controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::author.author', ({ strapi }) => ({
  async findOneBySlug(ctx) {
    const { slug } = ctx.params;

    const author = await strapi.service('api::author.author').findOneBySlug(slug);

    if (!author) {
      return ctx.notFound('Autor não encontrado');
    }

    const sanitizedData = await this.sanitizeOutput(author, ctx);
    return ctx.send({ data: sanitizedData });
  },
}));
