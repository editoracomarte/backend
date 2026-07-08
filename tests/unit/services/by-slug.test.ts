import { autorBySlugQuery, firstOrNull } from '../../../src/api/autor/services/by-slug';

describe('autorBySlugQuery', () => {
  it('filters published autores by the given slug, limited to one', () => {
    const query = autorBySlugQuery('machado-de-assis');

    expect(query.status).toBe('published');
    expect(query.filters).toEqual({ slug: 'machado-de-assis' });
    expect(query.limit).toBe(1);
  });

  it('returns nome/descricao and populates obras with titulo/slug (API contract)', () => {
    const query = autorBySlugQuery('any');

    expect(query.fields).toEqual(['nome', 'descricao']);
    expect(query.populate.obras.fields).toEqual(['titulo', 'slug']);
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
