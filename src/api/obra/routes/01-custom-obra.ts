/**
 * obra custom routes
 */

export default {
  routes: [
    {
      method: 'GET',
      path: '/obras/featured',
      handler: 'obra.findFeatured',
      config: {
        // Guard this read endpoint with the obra `find` scope so read-only API
        // tokens (which only allow scopes ending in `find`/`findOne`) can reach it.
        auth: {
          scope: ['api::obra.obra.find'],
        },
        policies: [],
        middlewares: [],
      },
    },
  ],
};
