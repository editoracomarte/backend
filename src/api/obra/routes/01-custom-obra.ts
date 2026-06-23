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
        policies: [],
        middlewares: [],
      },
    },
  ],
};
