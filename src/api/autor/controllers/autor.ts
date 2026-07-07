/**
 * autor controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::autor.autor', ({ strapi }) => ({
  async findOneBySlug(ctx) {
    const { slug } = ctx.params;

    const autor = await strapi.service('api::autor.autor').findOneBySlug(slug);

    if (!autor) {
      return ctx.notFound('Autor não encontrado');
    }

    const sanitizedData = await this.sanitizeOutput(autor, ctx);
    return ctx.send({ data: sanitizedData });
  },
}));
