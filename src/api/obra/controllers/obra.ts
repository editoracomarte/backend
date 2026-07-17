/**
 * obra controller
 */

import { factories } from '@strapi/strapi';

import { parseLimit } from '../services/related';

export default factories.createCoreController('api::obra.obra', ({ strapi }) => ({
  async findFeatured(ctx) {
    const data = await strapi.service('api::obra.obra').findFeatured();
    const sanitizedData = await this.sanitizeOutput(data, ctx);
    return ctx.send({ data: sanitizedData });
  },

  async findRelated(ctx) {
    const { slug } = ctx.params;
    const limit = parseLimit(ctx.query.limit);

    const data = await strapi.service('api::obra.obra').findRelated(slug, limit);

    if (data === null) {
      return ctx.notFound('Obra não encontrada');
    }

    // The internal `score` is dropped from the public payload and only kept
    // when the request opts into it via `?showScore` (for debugging).
    const sanitizedData = (await this.sanitizeOutput(data, ctx)) as Array<Record<string, unknown>>;
    const showScore = ctx.query.showScore !== undefined;
    const payload = sanitizedData.map(({ score, ...rest }) =>
      showScore ? { ...rest, score } : rest
    );

    return ctx.send({ data: payload });
  },

  async findOneBySlug(ctx) {
    const { slug } = ctx.params;

    const obra = await strapi.service('api::obra.obra').findOneBySlug(slug);

    if (!obra) {
      return ctx.notFound('Obra não encontrada');
    }

    const sanitizedData = await this.sanitizeOutput(obra, ctx);
    return ctx.send({ data: sanitizedData });
  },
}));
