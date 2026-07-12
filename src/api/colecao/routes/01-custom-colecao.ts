/**
 * colecao custom routes
 */

export default {
  routes: [
    {
      method: 'GET',
      path: '/collection/:slug',
      handler: 'colecao.findOneBySlug',
      config: {
        policies: [],
        middlewares: [],
        // Read scope so a read-only API token (the app's standard token) can
        // reach this route, consistent with the other content-api endpoints.
        auth: {
          scope: ['api::colecao.colecao.find'],
        },
      },
    },
  ],
};
