/**
 * Pure helpers for the "find obra by slug" flow, extracted from the
 * Strapi-bound service so they can be unit-tested and instrumented for
 * coverage without booting Strapi.
 */

/**
 * Builds the `documents().findMany` params to fetch a single published obra
 * by slug, including the descriptive fields plus the nome/slug of its
 * relations (autoria, colecao, generos). Centralizing the query locks the
 * public field contract consumed by the frontend.
 *
 * Fields are typed as literal tuples so the query is not widened to
 * `string[]`; the actual field names are still validated by `findMany` at the
 * call site in the service.
 */
export function obraBySlugQuery(slug: string) {
  const relationFields = ['nome', 'slug'] as ['nome', 'slug'];

  return {
    status: 'published' as const,
    filters: { slug },
    fields: [
      'titulo',
      'slug',
      'descricao',
      'isbn',
      'issn',
      'formato',
      'numeroDePaginas',
      'anoDePublicacao',
    ] as [
      'titulo',
      'slug',
      'descricao',
      'isbn',
      'issn',
      'formato',
      'numeroDePaginas',
      'anoDePublicacao',
    ],
    populate: {
      autoria: { fields: relationFields },
      colecao: { fields: relationFields },
      generos: { fields: relationFields },
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
