/**
 * obra controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::obra.obra', ({ strapi }) => ({
  async findFeatured(ctx) {
    const data = await strapi.service('api::obra.obra').findFeatured();
    const sanitizedData = await this.sanitizeOutput(data, ctx);
    return ctx.send({ data: sanitizedData });
  },
}));
