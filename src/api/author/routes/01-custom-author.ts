/**
 * author custom routes
 */

export default {
  routes: [
    {
      method: 'GET',
      path: '/author/:slug',
      handler: 'author.findOneBySlug',
      config: {
        policies: [],
        middlewares: [],
        // Read scope so a read-only API token (the app's standard token) can
        // reach this route, consistent with the other content-api endpoints.
        auth: {
          scope: ['api::author.author.find'],
        },
      },
    },
  ],
};
