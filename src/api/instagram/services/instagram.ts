/**
 * instagram service
 */

import { factories } from '@strapi/strapi';
import * as feed from './feed';

export default factories.createCoreService('api::instagram.instagram', ({ strapi }) => ({
  getPosts() {
    return feed.getPosts(strapi);
  },
}));
