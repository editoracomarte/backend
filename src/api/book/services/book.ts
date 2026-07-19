/**
 * book service
 */

import { factories } from '@strapi/strapi';

import { selectFeatured } from './featured';
import { bookBySlugQuery, firstOrNull } from './by-slug';
import {
  extractIds,
  fallbackRecentQuery,
  fillWithFallback,
  pickCoverUrl,
  rankRelated,
  relatedCandidatesQuery,
  RELATED_LIMIT,
  type RelatedResult,
} from './related';

const RELATED_POPULATE = {
  authors: { fields: ['name'] as ['name'] },
  collections: { fields: ['name'] as ['name'] },
  genres: { fields: ['name'] as ['name'] },
};

export default factories.createCoreService('api::book.book', ({ strapi }) => ({
  async findFeatured() {
    const allBooks = await strapi.documents('api::book.book').findMany({
      status: 'published',
      sort: 'publishing_year:desc',
      fields: ['title', 'slug', 'publishing_year'],
    });

    return selectFeatured(allBooks);
  },

  /**
   * Returns exactly `RELATED_LIMIT` published books for the book identified by
   * `slug`: first the ones ranked by weighted overlap of author/collection/genre
   * (score > 0), then, if there aren't enough, the most recent books as
   * fallback (score 0). Yields `null` when the base book does not exist so the
   * controller can 404. Every item carries a `score`; the controller only
   * exposes it when the request asks for debug output.
   */
  async findRelated(slug: string, limit: number = RELATED_LIMIT): Promise<RelatedResult[] | null> {
    const [base] = await strapi.documents('api::book.book').findMany({
      status: 'published',
      filters: { slug },
      fields: ['title', 'slug'],
      populate: RELATED_POPULATE,
      limit: 1,
    });

    if (!base) return null;

    const baseIds = {
      authorIds: extractIds(base.authors),
      collectionIds: extractIds(base.collections),
      genreIds: extractIds(base.genres),
    };

    const query = relatedCandidatesQuery(baseIds, slug);
    const candidates = query ? await strapi.documents('api::book.book').findMany(query) : [];

    const shaped = candidates.map((c) => ({
      id: c.id,
      documentId: c.documentId,
      title: c.title,
      slug: c.slug,
      publishing_year: c.publishing_year ?? null,
      cover: pickCoverUrl(c.cover),
      authorIds: extractIds(c.authors),
      collectionIds: extractIds(c.collections),
      genreIds: extractIds(c.genres),
    }));

    const related: RelatedResult[] = rankRelated(baseIds, shaped, limit).map(
      ({ id, documentId, title, slug: s, publishing_year, cover, score }) => ({
        id,
        documentId,
        title,
        slug: s,
        publishing_year,
        cover,
        score,
      })
    );

    if (related.length >= limit) return related;

    // Not enough related books — top up with the most recent ones (score 0).
    const excludeSlugs = [slug, ...related.map((r) => r.slug)];
    const pool = await strapi
      .documents('api::book.book')
      .findMany(fallbackRecentQuery(excludeSlugs, limit));

    const fallback: RelatedResult[] = pool.map((c) => ({
      id: c.id,
      documentId: c.documentId,
      title: c.title,
      slug: c.slug,
      publishing_year: c.publishing_year ?? null,
      cover: pickCoverUrl(c.cover),
      score: 0,
    }));

    return fillWithFallback(related, fallback, limit);
  },

  async findOneBySlug(slug: string) {
    const results = await strapi.documents('api::book.book').findMany(bookBySlugQuery(slug));

    return firstOrNull(results);
  },
}));
