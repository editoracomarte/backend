import { shuffle } from '../../../src/utils/shuffle';

describe('shuffle', () => {
  it('should not mutate the original array', () => {
    const original = [1, 2, 3, 4, 5];
    const copy = [...original];

    shuffle(original);

    expect(original).toEqual(copy);
  });

  it('should return a new array instance', () => {
    const original = [1, 2, 3];

    expect(shuffle(original)).not.toBe(original);
  });

  it('should keep the same elements', () => {
    const original = [1, 2, 3, 4, 5];

    expect(shuffle(original).sort((a, b) => a - b)).toEqual(original);
  });

  it('should preserve the array length', () => {
    const original = [1, 2, 3, 4, 5];

    expect(shuffle(original)).toHaveLength(original.length);
  });

  it('should handle an empty array', () => {
    expect(shuffle([])).toEqual([]);
  });

  it('should handle a single-element array', () => {
    expect(shuffle([42])).toEqual([42]);
  });

  it('should produce a deterministic order for a mocked random source', () => {
    const spy = jest.spyOn(Math, 'random').mockReturnValue(0);

    // With Math.random() === 0, j is always 0, so each element from the end
    // swaps with index 0, rotating the first element to the back.
    expect(shuffle([1, 2, 3, 4])).toEqual([2, 3, 4, 1]);

    spy.mockRestore();
  });
});
