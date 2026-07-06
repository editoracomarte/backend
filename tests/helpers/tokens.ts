import type { Core } from '@strapi/strapi';

/**
 * Creates a read-only API token and returns its plaintext access key.
 *
 * A read-only token grants access to every `find`/`findOne` action across all
 * content types without needing per-action permissions on the public role.
 * Pass the returned key as `Authorization: Bearer <key>` on requests.
 */
export async function createReadOnlyToken(strapi: Core.Strapi): Promise<string> {
  const token = await strapi.service('admin::api-token').create({
    name: `e2e-readonly-${Date.now()}`,
    description: 'Read-only token for integration tests',
    type: 'read-only',
    lifespan: null,
  });

  return token.accessKey;
}
