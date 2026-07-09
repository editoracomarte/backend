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
        // Read scope so a read-only API token (the app's standard token) can
        // reach this route, consistent with the other content-api endpoints.
        auth: {
          scope: ['api::autor.autor.find'],
        },
      },
    },
  ],
};
