/**
 * book custom routes
 */

export default {
  routes: [
    {
      method: 'GET',
      path: '/books/featured',
      handler: 'book.findFeatured',
      config: {
        // Guard this read endpoint with the book `find` scope so read-only API
        // tokens (which only allow scopes ending in `find`/`findOne`) can reach it.
        auth: {
          scope: ['api::book.book.find'],
        },
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'GET',
      path: '/books/:slug/related',
      handler: 'book.findRelated',
      config: {
        // Same read scope so the app's read-only API token can reach it.
        auth: {
          scope: ['api::book.book.find'],
        },
        policies: [],
        middlewares: [],
      },
    },
    {
      // Singular segment (`/book`) so this does not shadow the core
      // `GET /books/:documentId` findOne route registered by the default router.
      method: 'GET',
      path: '/book/:slug',
      handler: 'book.findOneBySlug',
      config: {
        // Read scope so a read-only API token (the app's standard token) can
        // reach this route, consistent with the other content-api endpoints.
        auth: {
          scope: ['api::book.book.find'],
        },
        policies: [],
        middlewares: [],
      },
    },
  ],
};
