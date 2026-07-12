import { obraBySlugQuery, firstOrNull } from '../../../src/api/obra/services/by-slug';

describe('obraBySlugQuery', () => {
  it('filters published obras by the given slug, limited to one', () => {
    const query = obraBySlugQuery('dom-casmurro');

    expect(query.status).toBe('published');
    expect(query.filters).toEqual({ slug: 'dom-casmurro' });
    expect(query.limit).toBe(1);
  });

  it('returns the descriptive obra fields (API contract)', () => {
    const query = obraBySlugQuery('any');

    expect(query.fields).toEqual([
      'titulo',
      'slug',
      'descricao',
      'isbn',
      'issn',
      'formato',
      'numeroDePaginas',
      'anoDePublicacao',
    ]);
  });

  it('populates autoria/colecao/generos with nome/slug (API contract)', () => {
    const query = obraBySlugQuery('any');

    expect(query.populate.autoria.fields).toEqual(['nome', 'slug']);
    expect(query.populate.colecao.fields).toEqual(['nome', 'slug']);
    expect(query.populate.generos.fields).toEqual(['nome', 'slug']);
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
