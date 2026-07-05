import type { Core } from '@strapi/strapi';

/**
 * Creates an API token scoped to the given content-api actions and returns its
 * plaintext accessKey. Use it in the `Authorization: Bearer <token>` header to
 * reach authenticated (non-public) content-api routes in integration tests.
 *
 * Note: a `read-only` token only covers actions whose scope ends with
 * `find`/`findOne`, so custom actions (e.g. `findOneBySlug`) must be granted via
 * a `custom` token that lists the exact action UID.
 */
export async function createScopedToken(
  strapi: Core.Strapi,
  permissions: string[]
): Promise<string> {
  const token = await strapi.service('admin::api-token').create({
    name: `test-token-${Date.now()}`,
    description: 'Integration test token',
    type: 'custom',
    lifespan: null,
    permissions,
  });

  return token.accessKey;
}
