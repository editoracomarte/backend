/**
 * instagram controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::instagram.instagram', ({ strapi }) => ({
  async find(ctx) {
    const posts = await strapi.service('api::instagram.instagram').getPosts();

    // Sem posts (sem cache, API falhou e sem entry manual) → 404.
    if (posts.length === 0) {
      return ctx.notFound();
    }

    const sanitized = await this.sanitizeOutput({ posts }, ctx);
    return ctx.send({ data: sanitized });
  },
}));
