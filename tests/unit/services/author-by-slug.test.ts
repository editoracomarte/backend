import { authorBySlugQuery, firstOrNull } from '../../../src/api/author/services/by-slug';

describe('authorBySlugQuery', () => {
  it('filters published authors by the given slug, limited to one', () => {
    const query = authorBySlugQuery('machado-de-assis');

    expect(query.status).toBe('published');
    expect(query.filters).toEqual({ slug: 'machado-de-assis' });
    expect(query.limit).toBe(1);
  });

  it('returns name, description, lattes, orcid and populates books with title/slug (API contract)', () => {
    const query = authorBySlugQuery('any');

    expect(query.fields).toEqual(['name', 'description', 'lattes', 'orcid']);
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
