/**
 * Pure helpers for the "obras relacionadas" flow, extracted from the
 * Strapi-bound service so the scoring/query logic can be unit-tested and
 * instrumented for coverage without booting Strapi.
 *
 * A candidate obra is scored by how much it overlaps with the base obra
 * across three relations, each weighted by product decision:
 *
 *   score = 3·(autores em comum) + 2·(coleções em comum) + 1·(gêneros em comum)
 *
 * "Same author" is the strongest signal, "same collection" next, "same genre"
 * the weakest (a work usually carries several genres, so genre overlap is the
 * least discriminating).
 */

export const RELATED_WEIGHTS = { autor: 3, colecao: 2, genero: 1 } as const;

/** Default number of related obras the endpoint returns (when `?limit` is absent). */
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
export interface ObraRelationIds {
  autorIds: string[];
  colecaoIds: string[];
  generoIds: string[];
}

/** A candidate obra plus the relation ids used to score it. */
export interface RelatedCandidate extends ObraRelationIds {
  id: number | string;
  documentId: string;
  titulo: string;
  slug: string;
  anoDePublicacao: number | null;
}

/** A scored candidate, as returned by {@link rankRelated}. */
export interface RankedObra extends RelatedCandidate {
  overlap: { autor: number; colecao: number; genero: number };
  score: number;
}

/** The public shape returned by the endpoint (score exposed only in ?debug). */
export interface RelatedResult {
  id: number | string;
  documentId: string;
  titulo: string;
  slug: string;
  anoDePublicacao: number | null;
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
 * Builds the `documents().findMany` params that fetch every published obra
 * sharing at least one autor, coleção or gênero with the base obra, excluding
 * the base itself. Returns `null` when the base obra has no relations at all
 * (there is nothing to match on), so the caller can short-circuit.
 */
export function relatedCandidatesQuery(base: ObraRelationIds, slug: string) {
  const or: Array<Record<string, unknown>> = [];
  if (base.autorIds.length) or.push({ autoria: { documentId: { $in: base.autorIds } } });
  if (base.colecaoIds.length) or.push({ colecao: { documentId: { $in: base.colecaoIds } } });
  if (base.generoIds.length) or.push({ generos: { documentId: { $in: base.generoIds } } });

  if (or.length === 0) return null;

  return {
    status: 'published' as const,
    filters: { $and: [{ slug: { $ne: slug } }, { $or: or }] },
    fields: ['titulo', 'slug', 'anoDePublicacao'] as ['titulo', 'slug', 'anoDePublicacao'],
    populate: {
      autoria: { fields: ['nome'] as ['nome'] },
      colecao: { fields: ['nome'] as ['nome'] },
      generos: { fields: ['nome'] as ['nome'] },
    },
  };
}

/**
 * Builds the `documents().findMany` params for the fallback pool: the most
 * recent published obras, excluding the base obra and any obra already picked
 * as related (passed in `excludeSlugs`). Used to top the list up to `limit`
 * when there are not enough genuinely-related obras.
 */
export function fallbackRecentQuery(excludeSlugs: string[], limit: number = RELATED_LIMIT) {
  return {
    status: 'published' as const,
    filters: { slug: { $notIn: excludeSlugs } },
    sort: 'anoDePublicacao:desc' as const,
    fields: ['titulo', 'slug', 'anoDePublicacao'] as ['titulo', 'slug', 'anoDePublicacao'],
    limit,
  };
}

/**
 * Tops the related list up to `limit` with fallback obras, skipping any that
 * are already present (by documentId). Related obras keep their position and
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
 * anoDePublicacao desc (most recent first) and then titulo for stability.
 */
export function rankRelated(
  base: ObraRelationIds,
  candidates: RelatedCandidate[],
  limit: number = RELATED_LIMIT
): RankedObra[] {
  const baseAutores = new Set(base.autorIds);
  const baseColecoes = new Set(base.colecaoIds);
  const baseGeneros = new Set(base.generoIds);

  return candidates
    .map((c): RankedObra => {
      const autor = overlapCount(c.autorIds, baseAutores);
      const colecao = overlapCount(c.colecaoIds, baseColecoes);
      const genero = overlapCount(c.generoIds, baseGeneros);
      const score =
        RELATED_WEIGHTS.autor * autor +
        RELATED_WEIGHTS.colecao * colecao +
        RELATED_WEIGHTS.genero * genero;
      return { ...c, overlap: { autor, colecao, genero }, score };
    })
    .filter((c) => c.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        (b.anoDePublicacao ?? 0) - (a.anoDePublicacao ?? 0) ||
        a.titulo.localeCompare(b.titulo)
    )
    .slice(0, limit);
}
