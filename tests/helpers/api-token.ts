import type { Core } from '@strapi/strapi';

/**
 * Creates a read-only API token and returns its plaintext accessKey. Use it in
 * the `Authorization: Bearer <token>` header to reach authenticated (non-public)
 * read routes in integration tests.
 *
 * A read-only token grants any route whose `config.auth.scope` ends with `find`
 * or `findOne`. Custom read routes must therefore declare such a scope to be
 * reachable by read-only tokens (see `routes/01-custom-autor.ts`).
 */
export async function createReadOnlyToken(strapi: Core.Strapi): Promise<string> {
  const token = await strapi.service('admin::api-token').create({
    name: `test-token-${Date.now()}`,
    description: 'Integration test token',
    type: 'read-only',
    lifespan: null,
  });

  return token.accessKey;
}
