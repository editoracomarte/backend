/**
 * Pure helpers for the "related books" flow, extracted from the Strapi-bound
 * service so the scoring/query logic can be unit-tested and instrumented for
 * coverage without booting Strapi.
 *
 * A candidate book is scored by how much it overlaps with the base book across
 * three relations, each weighted by product decision:
 *
 *   score = 3·(authors in common) + 2·(collections in common) + 1·(genres in common)
 *
 * "Same author" is the strongest signal, "same collection" next, "same genre"
 * the weakest (a work usually carries several genres, so genre overlap is the
 * least discriminating).
 */

export const RELATED_WEIGHTS = { author: 3, collection: 2, genre: 1 } as const;

/** Default number of related books the endpoint returns (when `?limit` is absent). */
export const RELATED_LIMIT = 5;

/** Ceiling for the `?limit` query param, to protect the backend. */
export const RELATED_MAX_LIMIT = 10;

/**
 * Parses the `?limit` query value into a positive integer, clamped to
 * `[1, max]`. Falls back to `fallback` for anything missing, non-numeric,
 * non-integer or <= 0, so the endpoint never errors on a bad `?limit`.
 */
export function parseLimit(
  raw: unknown,
  fallback: number = RELATED_LIMIT,
  max: number = RELATED_MAX_LIMIT
): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return fallback;
  return Math.min(n, max);
}

/** The documentIds of the three relations we score on. */
export interface BookRelationIds {
  authorIds: string[];
  collectionIds: string[];
  genreIds: string[];
}

/** A candidate book plus the relation ids used to score it. */
export interface RelatedCandidate extends BookRelationIds {
  id: number | string;
  documentId: string;
  title: string;
  slug: string;
  publishing_year: number | null;
}

/** A scored candidate, as returned by {@link rankRelated}. */
export interface RankedBook extends RelatedCandidate {
  overlap: { author: number; collection: number; genre: number };
  score: number;
}

/** The public shape returned by the endpoint (score exposed only in ?debug). */
export interface RelatedResult {
  id: number | string;
  documentId: string;
  title: string;
  slug: string;
  publishing_year: number | null;
  score: number;
}

/**
 * Reads the `documentId` off a populated relation array, tolerating an
 * absent/empty relation (Strapi returns `[]`, or `undefined` when not
 * populated).
 */
export function extractIds(entities?: Array<{ documentId: string }> | null): string[] {
  return (entities ?? []).map((e) => e.documentId);
}

function overlapCount(ids: string[], base: Set<string>): number {
  let n = 0;
  for (const id of ids) if (base.has(id)) n++;
  return n;
}

/**
 * Builds the `documents().findMany` params that fetch every published book
 * sharing at least one author, collection or genre with the base book,
 * excluding the base itself. Returns `null` when the base book has no relations
 * at all (there is nothing to match on), so the caller can short-circuit.
 */
export function relatedCandidatesQuery(base: BookRelationIds, slug: string) {
  const or: Array<Record<string, unknown>> = [];
  if (base.authorIds.length) or.push({ authors: { documentId: { $in: base.authorIds } } });
  if (base.collectionIds.length)
    or.push({ collections: { documentId: { $in: base.collectionIds } } });
  if (base.genreIds.length) or.push({ genres: { documentId: { $in: base.genreIds } } });

  if (or.length === 0) return null;

  return {
    status: 'published' as const,
    filters: { $and: [{ slug: { $ne: slug } }, { $or: or }] },
    fields: ['title', 'slug', 'publishing_year'] as ['title', 'slug', 'publishing_year'],
    populate: {
      authors: { fields: ['name'] as ['name'] },
      collections: { fields: ['name'] as ['name'] },
      genres: { fields: ['name'] as ['name'] },
    },
  };
}

/**
 * Builds the `documents().findMany` params for the fallback pool: the most
 * recent published books, excluding the base book and any book already picked
 * as related (passed in `excludeSlugs`). Used to top the list up to `limit`
 * when there are not enough genuinely-related books.
 */
export function fallbackRecentQuery(excludeSlugs: string[], limit: number = RELATED_LIMIT) {
  return {
    status: 'published' as const,
    filters: { slug: { $notIn: excludeSlugs } },
    sort: 'publishing_year:desc' as const,
    fields: ['title', 'slug', 'publishing_year'] as ['title', 'slug', 'publishing_year'],
    limit,
  };
}

/**
 * Tops the related list up to `limit` with fallback books, skipping any that
 * are already present (by documentId). Related books keep their position and
 * score; fallbacks come after, in the order given (recent first).
 */
export function fillWithFallback(
  related: RelatedResult[],
  fallback: RelatedResult[],
  limit: number = RELATED_LIMIT
): RelatedResult[] {
  if (related.length >= limit) return related.slice(0, limit);

  const seen = new Set(related.map((r) => r.documentId));
  const out = [...related];
  for (const f of fallback) {
    if (out.length >= limit) break;
    if (seen.has(f.documentId)) continue;
    seen.add(f.documentId);
    out.push(f);
  }
  return out;
}

/**
 * Scores each candidate against the base relations, drops the ones with no
 * overlap, and returns the top `limit` sorted by score desc, breaking ties by
 * publishing_year desc (most recent first) and then title for stability.
 */
export function rankRelated(
  base: BookRelationIds,
  candidates: RelatedCandidate[],
  limit: number = RELATED_LIMIT
): RankedBook[] {
  const baseAuthors = new Set(base.authorIds);
  const baseCollections = new Set(base.collectionIds);
  const baseGenres = new Set(base.genreIds);

  return candidates
    .map((c): RankedBook => {
      const author = overlapCount(c.authorIds, baseAuthors);
      const collection = overlapCount(c.collectionIds, baseCollections);
      const genre = overlapCount(c.genreIds, baseGenres);
      const score =
        RELATED_WEIGHTS.author * author +
        RELATED_WEIGHTS.collection * collection +
        RELATED_WEIGHTS.genre * genre;
      return { ...c, overlap: { author, collection, genre }, score };
    })
    .filter((c) => c.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        (b.publishing_year ?? 0) - (a.publishing_year ?? 0) ||
        a.title.localeCompare(b.title)
    )
    .slice(0, limit);
}
