import { bookBySlugQuery, firstOrNull } from '../../../src/api/book/services/by-slug';

describe('bookBySlugQuery', () => {
  it('filters published books by the given slug, limited to one', () => {
    const query = bookBySlugQuery('dom-casmurro');

    expect(query.status).toBe('published');
    expect(query.filters).toEqual({ slug: 'dom-casmurro' });
    expect(query.limit).toBe(1);
  });

  it('returns the descriptive book fields (API contract)', () => {
    const query = bookBySlugQuery('any');

    expect(query.fields).toEqual([
      'title',
      'slug',
      'description',
      'isbn',
      'issn',
      'format',
      'page_num',
      'publishing_year',
      'store_url',
    ]);
  });

  it('populates authors/collections/genres with name/slug (API contract)', () => {
    const query = bookBySlugQuery('any');

    expect(query.populate.authors.fields).toEqual(['name', 'slug']);
    expect(query.populate.collections.fields).toEqual(['name', 'slug']);
    expect(query.populate.genres.fields).toEqual(['name', 'slug']);
  });

  it('populates cover/sample with only the url (API contract)', () => {
    const query = bookBySlugQuery('any');

    expect(query.populate.cover.fields).toEqual(['url']);
    expect(query.populate.sample.fields).toEqual(['url']);
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
