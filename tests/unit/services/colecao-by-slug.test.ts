import { colecaoBySlugQuery, firstOrNull } from '../../../src/api/colecao/services/by-slug';

describe('colecaoBySlugQuery', () => {
  it('filters published colecoes by the given slug, limited to one', () => {
    const query = colecaoBySlugQuery('classicos-brasileiros');

    expect(query.status).toBe('published');
    expect(query.filters).toEqual({ slug: 'classicos-brasileiros' });
    expect(query.limit).toBe(1);
  });

  it('returns nome/descricao and populates obras with titulo/slug (API contract)', () => {
    const query = colecaoBySlugQuery('any');

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
