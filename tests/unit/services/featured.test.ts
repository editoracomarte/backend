import { selectFeatured } from '../../../src/api/book/services/featured';

const CURRENT_YEAR = 2026;

const makeBooks = (n: number, startYear = CURRENT_YEAR) =>
  Array.from({ length: n }, (_, i) => ({ id: i + 1, publishing_year: startYear - i }));

describe('selectFeatured', () => {
  it('returns all books when there are 6 or fewer', () => {
    const result = selectFeatured(makeBooks(4), CURRENT_YEAR);

    expect(result).toHaveLength(4);
    expect(result.map((o) => o.id).sort((a, b) => a - b)).toEqual([1, 2, 3, 4]);
  });

  it('always includes every book from the current and previous year', () => {
    const books = [
      { id: 1, publishing_year: CURRENT_YEAR },
      { id: 2, publishing_year: CURRENT_YEAR - 1 },
      { id: 3, publishing_year: CURRENT_YEAR - 2 },
      { id: 4, publishing_year: CURRENT_YEAR - 3 },
    ];

    const result = selectFeatured(books, CURRENT_YEAR);
    const ids = new Set(result.map((o) => o.id));

    expect(ids.has(1)).toBe(true);
    expect(ids.has(2)).toBe(true);
  });

  it('puts every book from the last 2 years ahead of older ones', () => {
    const books = [
      { id: 1, publishing_year: CURRENT_YEAR },
      { id: 2, publishing_year: CURRENT_YEAR - 1 },
      { id: 3, publishing_year: CURRENT_YEAR - 5 },
      { id: 4, publishing_year: CURRENT_YEAR - 6 },
    ];

    const result = selectFeatured(books, CURRENT_YEAR);
    const positions = new Map(result.map((o, i) => [o.id, i]));

    expect(positions.get(1)).toBeLessThan(positions.get(3)!);
    expect(positions.get(1)).toBeLessThan(positions.get(4)!);
    expect(positions.get(2)).toBeLessThan(positions.get(3)!);
    expect(positions.get(2)).toBeLessThan(positions.get(4)!);
  });

  it('keeps the last-2-years books sorted by most recent first, not shuffled', () => {
    const books = [
      { id: 1, publishing_year: CURRENT_YEAR },
      { id: 2, publishing_year: CURRENT_YEAR },
      { id: 3, publishing_year: CURRENT_YEAR - 1 },
      { id: 4, publishing_year: CURRENT_YEAR - 1 },
      { id: 5, publishing_year: CURRENT_YEAR - 10 },
    ];

    const result = selectFeatured(books, CURRENT_YEAR);

    expect(result.slice(0, 4)).toEqual([books[0], books[1], books[2], books[3]]);
  });

  it('completes the top 8 with the next most recent books when the last 2 years have fewer than 8', () => {
    const books = [
      { id: 1, publishing_year: CURRENT_YEAR }, // 1 book in the last 2 years
      ...makeBooks(20, CURRENT_YEAR - 5).map((b, i) => ({
        id: 100 + i,
        publishing_year: CURRENT_YEAR - 5 - i, // strictly decreasing, so order is unambiguous
      })),
    ];

    const result = selectFeatured(books, CURRENT_YEAR);

    // the recent book is always first; the other 7 top slots are the next 7
    // most recent books, but their order among themselves may be shuffled
    expect(result[0]).toEqual(books[0]);
    expect(
      result
        .slice(1, 8)
        .map((o) => o.id)
        .sort((a, b) => a - b)
    ).toEqual(
      books
        .slice(1, 8)
        .map((o) => o.id)
        .sort((a, b) => a - b)
    );
  });

  it('does not need filler when the last 2 years already fill 8 or more slots', () => {
    const books = [
      ...makeBooks(9, CURRENT_YEAR).map((b) => ({ ...b, publishing_year: CURRENT_YEAR })), // 9 recent books
      ...makeBooks(10, CURRENT_YEAR - 5).map((b, i) => ({
        id: 100 + i,
        publishing_year: CURRENT_YEAR - 5 - i,
      })),
    ];

    const result = selectFeatured(books, CURRENT_YEAR);

    // all 9 recent books are present, in fixed order, ahead of anything else
    expect(result.slice(0, 9).map((o) => o.id)).toEqual(books.slice(0, 9).map((o) => o.id));
    expect(result).toHaveLength(12);
  });

  it('caps the result at 12, dropping the oldest recent-year books first', () => {
    const books = makeBooks(20, CURRENT_YEAR).map((b) => ({ ...b, publishing_year: CURRENT_YEAR }));

    const result = selectFeatured(books, CURRENT_YEAR);
    const ids = result.map((o) => o.id);

    expect(result).toHaveLength(12);
    for (let id = 1; id <= 12; id++) {
      expect(ids).toContain(id);
    }
  });

  it('fills remaining slots with random older books up to 12 total', () => {
    const books = [
      { id: 1, publishing_year: CURRENT_YEAR },
      ...makeBooks(20, CURRENT_YEAR - 5).map((b, i) => ({
        id: 100 + i,
        publishing_year: CURRENT_YEAR - 5 - i,
      })),
    ];

    expect(selectFeatured(books, CURRENT_YEAR)).toHaveLength(12);
  });

  it('does not duplicate books', () => {
    const books = makeBooks(30, CURRENT_YEAR);
    const ids = selectFeatured(books, CURRENT_YEAR).map((o) => o.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('handles an empty list', () => {
    expect(selectFeatured([], CURRENT_YEAR)).toEqual([]);
  });

  it('handles books with no publishing_year as older books', () => {
    const books = [
      { id: 1, publishing_year: CURRENT_YEAR },
      { id: 2, publishing_year: null },
    ];

    const result = selectFeatured(books, CURRENT_YEAR);

    expect(result).toHaveLength(2);
  });
});
