/**
 * Pure helpers for the "find book by slug" flow, extracted from the
 * Strapi-bound service so they can be unit-tested and instrumented for
 * coverage without booting Strapi.
 */

/**
 * Builds the `documents().findMany` params to fetch a single published book
 * by slug, including the descriptive fields plus the name/slug of its
 * relations (authors, collections, genres). Centralizing the query locks the
 * public field contract consumed by the frontend.
 *
 * Fields are typed as literal tuples so the query is not widened to
 * `string[]`; the actual field names are still validated by `findMany` at the
 * call site in the service.
 */
export function bookBySlugQuery(slug: string) {
  const relationFields = ['name', 'slug'] as ['name', 'slug'];

  return {
    status: 'published' as const,
    filters: { slug },
    fields: [
      'title',
      'slug',
      'description',
      'isbn',
      'issn',
      'format',
      'page_num',
      'publishing_year',
    ] as ['title', 'slug', 'description', 'isbn', 'issn', 'format', 'page_num', 'publishing_year'],
    populate: {
      authors: { fields: relationFields },
      collections: { fields: relationFields },
      genres: { fields: relationFields },
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
