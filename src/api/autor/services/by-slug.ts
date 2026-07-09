/**
 * Pure helpers for the "find autor by slug" flow, extracted from the
 * Strapi-bound service so they can be unit-tested and instrumented for
 * coverage without booting Strapi.
 */

/**
 * Builds the `documents().findMany` params to fetch a single published autor
 * by slug, including the titulo/slug of its obras. Centralizing the query
 * locks the public field contract consumed by the frontend.
 *
 * Fields are typed as literal tuples so the query is not widened to
 * `string[]`; the actual field names are still validated by `findMany` at the
 * call site in the service.
 */
export function autorBySlugQuery(slug: string) {
  return {
    status: 'published' as const,
    filters: { slug },
    fields: ['nome', 'descricao'] as ['nome', 'descricao'],
    populate: {
      obras: {
        fields: ['titulo', 'slug'] as ['titulo', 'slug'],
      },
    },
    limit: 1,
  };
}

/**
 * Normalizes a `findMany` result to the first match or `null` when the list
 * is empty (Strapi returns `[]`, not `undefined`, for no matches).
 */
export function firstOrNull<T>(results: T[]): T | null {
  return results[0] ?? null;
}
