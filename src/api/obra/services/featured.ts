import { shuffle } from '../../../utils/shuffle';

/**
 * Selects the featured obras from a list already sorted by
 * anoDePublicacao (desc): the 6 most recent plus up to 6 random ones
 * from the remainder, returned in a shuffled order.
 *
 * Pure function (no Strapi dependency) so it can be unit-tested.
 */
export function selectFeatured<T>(allObras: T[]): T[] {
  const recent = allObras.slice(0, 6);
  const random = shuffle(allObras.slice(6)).slice(0, 6);

  return shuffle([...recent, ...random]);
}
