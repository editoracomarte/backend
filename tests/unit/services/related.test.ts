import {
  extractIds,
  fallbackRecentQuery,
  fillWithFallback,
  parseLimit,
  rankRelated,
  relatedCandidatesQuery,
  RELATED_LIMIT,
  RELATED_MAX_LIMIT,
  RELATED_WEIGHTS,
  type BookRelationIds,
  type RelatedCandidate,
  type RelatedResult,
} from '../../../src/api/book/services/related';

const EMPTY: BookRelationIds = { authorIds: [], collectionIds: [], genreIds: [] };

const candidate = (over: Partial<RelatedCandidate>): RelatedCandidate => ({
  id: 1,
  documentId: 'doc',
  title: 'Título',
  slug: 'titulo',
  publishing_year: 2000,
  authorIds: [],
  collectionIds: [],
  genreIds: [],
  ...over,
});

describe('RELATED_WEIGHTS', () => {
  it('weights author > collection > genre (3·2·1)', () => {
    expect(RELATED_WEIGHTS).toEqual({ author: 3, collection: 2, genre: 1 });
  });
});

describe('extractIds', () => {
  it('maps documentId off a populated relation', () => {
    expect(extractIds([{ documentId: 'a' }, { documentId: 'b' }])).toEqual(['a', 'b']);
  });

  it('returns [] for an empty or absent relation', () => {
    expect(extractIds([])).toEqual([]);
    expect(extractIds(undefined)).toEqual([]);
    expect(extractIds(null)).toEqual([]);
  });
});

describe('relatedCandidatesQuery', () => {
  const base: BookRelationIds = {
    authorIds: ['aut-1', 'aut-2'],
    collectionIds: ['col-1'],
    genreIds: ['gen-1'],
  };

  it('excludes the base book by slug and only fetches published', () => {
    const q = relatedCandidatesQuery(base, 'angola-janga')!;

    expect(q.status).toBe('published');
    expect(q.filters.$and[0]).toEqual({ slug: { $ne: 'angola-janga' } });
  });

  it('builds one $or clause per non-empty relation', () => {
    const q = relatedCandidatesQuery(base, 'x')!;
    const or = q.filters.$and[1].$or;

    expect(or).toEqual([
      { authors: { documentId: { $in: ['aut-1', 'aut-2'] } } },
      { collections: { documentId: { $in: ['col-1'] } } },
      { genres: { documentId: { $in: ['gen-1'] } } },
    ]);
  });

  it('omits relations that are empty on the base', () => {
    const q = relatedCandidatesQuery({ ...EMPTY, authorIds: ['aut-1'] }, 'x')!;

    expect(q.filters.$and[1].$or).toEqual([{ authors: { documentId: { $in: ['aut-1'] } } }]);
  });

  it('returns null when the base has no relations to match on', () => {
    expect(relatedCandidatesQuery(EMPTY, 'x')).toBeNull();
  });

  it('requests the public fields and populates the scored relations', () => {
    const q = relatedCandidatesQuery(base, 'x')!;

    expect(q.fields).toEqual(['title', 'slug', 'publishing_year']);
    expect(Object.keys(q.populate)).toEqual(['authors', 'collections', 'genres']);
  });
});

describe('rankRelated', () => {
  const base: BookRelationIds = {
    authorIds: ['A1', 'A2'],
    collectionIds: ['C1', 'C2'],
    genreIds: ['G1', 'G2', 'G3'],
  };

  it('scores overlap as 3·author + 2·collection + 1·genre', () => {
    const [ranked] = rankRelated(base, [
      candidate({ documentId: 'x', authorIds: ['A1'], collectionIds: ['C1'], genreIds: ['G1'] }),
    ]);

    expect(ranked.overlap).toEqual({ author: 1, collection: 1, genre: 1 });
    expect(ranked.score).toBe(6); // 3 + 2 + 1
  });

  it('ranks a shared author above a shared collection above a shared genre', () => {
    const ranked = rankRelated(base, [
      candidate({ documentId: 'genero', genreIds: ['G1'] }),
      candidate({ documentId: 'autor', authorIds: ['A1'] }),
      candidate({ documentId: 'colecao', collectionIds: ['C1'] }),
    ]);

    expect(ranked.map((r) => r.documentId)).toEqual(['autor', 'colecao', 'genero']);
  });

  it('drops candidates that share nothing with the base', () => {
    const ranked = rankRelated(base, [
      candidate({ documentId: 'unrelated', authorIds: ['ZZ'], genreIds: ['ZZ'] }),
    ]);

    expect(ranked).toEqual([]);
  });

  it('breaks score ties by publishing_year desc, then title', () => {
    const ranked = rankRelated(base, [
      candidate({ documentId: 'old', title: 'B', authorIds: ['A1'], publishing_year: 2000 }),
      candidate({ documentId: 'new', title: 'C', authorIds: ['A1'], publishing_year: 2020 }),
      candidate({ documentId: 'tie', title: 'A', authorIds: ['A1'], publishing_year: 2020 }),
    ]);

    // Same score (one shared author each): newest first, then title A before C.
    expect(ranked.map((r) => r.documentId)).toEqual(['tie', 'new', 'old']);
  });

  it('treats a null publishing_year as the oldest when breaking ties', () => {
    const ranked = rankRelated(base, [
      candidate({ documentId: 'dated', authorIds: ['A1'], publishing_year: 1990 }),
      candidate({ documentId: 'undated', authorIds: ['A1'], publishing_year: null }),
    ]);

    expect(ranked.map((r) => r.documentId)).toEqual(['dated', 'undated']);
  });

  it('returns at most RELATED_LIMIT (5) results', () => {
    const many = Array.from({ length: 9 }, (_, i) =>
      candidate({ documentId: `d${i}`, title: `T${i}`, authorIds: ['A1'] })
    );

    expect(rankRelated(base, many)).toHaveLength(RELATED_LIMIT);
  });

  it('honors a custom limit', () => {
    const many = Array.from({ length: 5 }, (_, i) =>
      candidate({ documentId: `d${i}`, authorIds: ['A1'] })
    );

    expect(rankRelated(base, many, 2)).toHaveLength(2);
  });

  it('returns [] for no candidates', () => {
    expect(rankRelated(base, [])).toEqual([]);
  });
});

describe('parseLimit', () => {
  it('returns the default when the value is absent', () => {
    expect(parseLimit(undefined)).toBe(RELATED_LIMIT);
  });

  it('parses a valid numeric string', () => {
    expect(parseLimit('8')).toBe(8);
  });

  it('clamps values above the ceiling to RELATED_MAX_LIMIT', () => {
    expect(parseLimit('999')).toBe(RELATED_MAX_LIMIT);
  });

  it('falls back for non-numeric, non-integer, zero or negative values', () => {
    expect(parseLimit('abc')).toBe(RELATED_LIMIT);
    expect(parseLimit('2.5')).toBe(RELATED_LIMIT);
    expect(parseLimit('0')).toBe(RELATED_LIMIT);
    expect(parseLimit('-3')).toBe(RELATED_LIMIT);
    expect(parseLimit(['1', '2'])).toBe(RELATED_LIMIT); // repeated ?limit=1&limit=2
  });

  it('accepts the boundary values 1 and the ceiling', () => {
    expect(parseLimit('1')).toBe(1);
    expect(parseLimit(String(RELATED_MAX_LIMIT))).toBe(RELATED_MAX_LIMIT);
  });
});

describe('fallbackRecentQuery', () => {
  it('fetches recent published books excluding the given slugs', () => {
    const q = fallbackRecentQuery(['base', 'ja-relacionada']);

    expect(q.status).toBe('published');
    expect(q.filters).toEqual({ slug: { $notIn: ['base', 'ja-relacionada'] } });
    expect(q.sort).toBe('publishing_year:desc');
    expect(q.fields).toEqual(['title', 'slug', 'publishing_year']);
    expect(q.limit).toBe(RELATED_LIMIT);
  });
});

describe('fillWithFallback', () => {
  const result = (over: Partial<RelatedResult>): RelatedResult => ({
    id: 1,
    documentId: 'doc',
    title: 'T',
    slug: 't',
    publishing_year: 2000,
    score: 0,
    ...over,
  });

  it('returns the related list untouched when it already fills the limit', () => {
    const related = Array.from({ length: 5 }, (_, i) => result({ documentId: `r${i}`, score: 5 }));
    const fallback = [result({ documentId: 'f0' })];

    expect(fillWithFallback(related, fallback)).toEqual(related);
  });

  it('appends fallbacks after the related ones until the limit is reached', () => {
    const related = [result({ documentId: 'r0', score: 6 })];
    const fallback = [
      result({ documentId: 'f0' }),
      result({ documentId: 'f1' }),
      result({ documentId: 'f2' }),
    ];

    const out = fillWithFallback(related, fallback, 3);

    expect(out.map((o) => o.documentId)).toEqual(['r0', 'f0', 'f1']);
  });

  it('never duplicates a book already present as related', () => {
    const related = [result({ documentId: 'shared', score: 3 })];
    const fallback = [result({ documentId: 'shared' }), result({ documentId: 'new' })];

    const out = fillWithFallback(related, fallback, 5);

    expect(out.map((o) => o.documentId)).toEqual(['shared', 'new']);
  });

  it('returns fewer than the limit when the fallback pool runs out', () => {
    const out = fillWithFallback([], [result({ documentId: 'only' })], 5);

    expect(out).toHaveLength(1);
  });

  it('fills entirely from fallback when nothing is related', () => {
    const fallback = Array.from({ length: 6 }, (_, i) => result({ documentId: `f${i}` }));

    const out = fillWithFallback([], fallback, 5);

    expect(out).toHaveLength(5);
    expect(out.every((o) => o.score === 0)).toBe(true);
  });
});
