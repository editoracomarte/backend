import { collectionBySlugQuery, firstOrNull } from '../../../src/api/collection/services/by-slug';

describe('collectionBySlugQuery', () => {
  it('filters published collections by the given slug, limited to one', () => {
    const query = collectionBySlugQuery('classicos-brasileiros');

    expect(query.status).toBe('published');
    expect(query.filters).toEqual({ slug: 'classicos-brasileiros' });
    expect(query.limit).toBe(1);
  });

  it('returns name/description and populates books with title/slug (API contract)', () => {
    const query = collectionBySlugQuery('any');

    expect(query.fields).toEqual(['name', 'description']);
    expect(query.populate.books.fields).toEqual(['title', 'slug']);
  });
});

describe('firstOrNull', () => {
  it('returns the first element when the list is not empty', () => {
    expect(firstOrNull([{ id: 1 }, { id: 2 }])).toEqual({ id: 1 });
  });

  it('returns null for an empty list', () => {
    expect(firstOrNull([])).toBeNull();
  });
});
