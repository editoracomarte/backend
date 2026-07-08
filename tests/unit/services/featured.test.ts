import { selectFeatured } from '../../../src/api/obra/services/featured';

const makeObras = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i + 1 }));

describe('selectFeatured', () => {
  it('returns all obras when there are 6 or fewer', () => {
    const result = selectFeatured(makeObras(4));

    expect(result).toHaveLength(4);
    expect(result.map((o) => o.id).sort((a, b) => a - b)).toEqual([1, 2, 3, 4]);
  });

  it('always includes the 6 most recent obras', () => {
    const result = selectFeatured(makeObras(20));
    const ids = new Set(result.map((o) => o.id));

    // The input is pre-sorted by anoDePublicacao desc, so the first 6 are the
    // most recent and must always be present.
    for (let id = 1; id <= 6; id++) {
      expect(ids.has(id)).toBe(true);
    }
  });

  it('returns at most 12 obras (6 recent + 6 random)', () => {
    expect(selectFeatured(makeObras(50))).toHaveLength(12);
  });

  it('does not duplicate obras', () => {
    const ids = selectFeatured(makeObras(50)).map((o) => o.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('handles an empty list', () => {
    expect(selectFeatured([])).toEqual([]);
  });
});
