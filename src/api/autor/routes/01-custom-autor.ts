/**
 * autor custom routes
 */

export default {
  routes: [
    {
      method: 'GET',
      path: '/author/:slug',
      handler: 'autor.findOneBySlug',
      config: {
        policies: [],
        middlewares: [],
        auth: {
          scope: ['api::autor.autor.find'],
        },
      },
    },
  ],
};
