/**
 * colecao controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::colecao.colecao', ({ strapi }) => ({
  async findOneBySlug(ctx) {
    const { slug } = ctx.params;

    const colecao = await strapi.service('api::colecao.colecao').findOneBySlug(slug);

    if (!colecao) {
      return ctx.notFound('Coleção não encontrada');
    }

    const sanitizedData = await this.sanitizeOutput(colecao, ctx);
    return ctx.send({ data: sanitizedData });
  },
}));
