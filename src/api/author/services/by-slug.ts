/**
 * Pure helpers for the "find author by slug" flow, extracted from the
 * Strapi-bound service so they can be unit-tested and instrumented for
 * coverage without booting Strapi.
 */

/**
 * Builds the `documents().findMany` params to fetch a single published author
 * by slug, including the title/slug of its books. Centralizing the query
 * locks the public field contract consumed by the frontend.
 *
 * Fields are typed as literal tuples so the query is not widened to
 * `string[]`; the actual field names are still validated by `findMany` at the
 * call site in the service.
 */
export function authorBySlugQuery(slug: string) {
  return {
    status: 'published' as const,
    filters: { slug },
    fields: ['name', 'description'] as ['name', 'description'],
    populate: {
      books: {
        fields: ['title', 'slug'] as ['title', 'slug'],
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
