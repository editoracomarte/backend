/**
 * obra service
 */

import { factories } from '@strapi/strapi';

import { selectFeatured } from './featured';
import {
  extractIds,
  fallbackRecentQuery,
  fillWithFallback,
  rankRelated,
  relatedCandidatesQuery,
  RELATED_LIMIT,
  type RelatedResult,
} from './related';

const RELATED_POPULATE = {
  autoria: { fields: ['nome'] as ['nome'] },
  colecao: { fields: ['nome'] as ['nome'] },
  generos: { fields: ['nome'] as ['nome'] },
};

export default factories.createCoreService('api::obra.obra', ({ strapi }) => ({
  async findFeatured() {
    const allObras = await strapi.documents('api::obra.obra').findMany({
      status: 'published',
      sort: 'anoDePublicacao:desc',
      fields: ['titulo', 'slug', 'anoDePublicacao'],
    });

    return selectFeatured(allObras);
  },

  /**
   * Returns exactly `RELATED_LIMIT` published obras for the obra identified by
   * `slug`: first the ones ranked by weighted overlap of autor/coleção/gênero
   * (score > 0), then, if there aren't enough, the most recent obras as
   * fallback (score 0). Yields `null` when the base obra does not exist so the
   * controller can 404. Every item carries a `score`; the controller only
   * exposes it when the request asks for debug output.
   */
  async findRelated(slug: string, limit: number = RELATED_LIMIT): Promise<RelatedResult[] | null> {
    const [base] = await strapi.documents('api::obra.obra').findMany({
      status: 'published',
      filters: { slug },
      fields: ['titulo', 'slug'],
      populate: RELATED_POPULATE,
      limit: 1,
    });

    if (!base) return null;

    const baseIds = {
      autorIds: extractIds(base.autoria),
      colecaoIds: extractIds(base.colecao),
      generoIds: extractIds(base.generos),
    };

    const query = relatedCandidatesQuery(baseIds, slug);
    const candidates = query ? await strapi.documents('api::obra.obra').findMany(query) : [];

    const shaped = candidates.map((c) => ({
      id: c.id,
      documentId: c.documentId,
      titulo: c.titulo,
      slug: c.slug,
      anoDePublicacao: c.anoDePublicacao ?? null,
      autorIds: extractIds(c.autoria),
      colecaoIds: extractIds(c.colecao),
      generoIds: extractIds(c.generos),
    }));

    const related: RelatedResult[] = rankRelated(baseIds, shaped, limit).map(
      ({ id, documentId, titulo, slug: s, anoDePublicacao, score }) => ({
        id,
        documentId,
        titulo,
        slug: s,
        anoDePublicacao,
        score,
      })
    );

    if (related.length >= limit) return related;

    // Not enough related obras — top up with the most recent ones (score 0).
    const excludeSlugs = [slug, ...related.map((r) => r.slug)];
    const pool = await strapi
      .documents('api::obra.obra')
      .findMany(fallbackRecentQuery(excludeSlugs, limit));

    const fallback: RelatedResult[] = pool.map((c) => ({
      id: c.id,
      documentId: c.documentId,
      titulo: c.titulo,
      slug: c.slug,
      anoDePublicacao: c.anoDePublicacao ?? null,
      score: 0,
    }));

    return fillWithFallback(related, fallback, limit);
  },
}));
