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
    {
      // Singular segment (`/obra`) so this does not shadow the core
      // `GET /obras/:documentId` findOne route registered by the default router.
      method: 'GET',
      path: '/obra/:slug',
      handler: 'obra.findOneBySlug',
      config: {
        // Read scope so a read-only API token (the app's standard token) can
        // reach this route, consistent with the other content-api endpoints.
        auth: {
          scope: ['api::obra.obra.find'],
        },
        policies: [],
        middlewares: [],
      },
    },
  ],
};
