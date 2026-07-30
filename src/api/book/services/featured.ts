import { shuffle } from '../../../utils/shuffle';

const MAX_FEATURED = 12;
const TOP_FIXED = 8;

/**
 * Selects the featured books from a list already sorted by
 * publishing_year (desc):
 *
 * - every book from the current and previous year goes on top, most recent
 *   first, never shuffled (capped at MAX_FEATURED, dropping the oldest
 *   first if there are too many);
 * - if that's fewer than TOP_FIXED, the next most recent books complete the
 *   top TOP_FIXED slots — which books make the cut is still deterministic
 *   (the next most recent ones), but their order among themselves is
 *   shuffled;
 * - the remaining slots up to MAX_FEATURED are filled with random books
 *   from what's left.
 *
 * Pure function (no Strapi dependency) so it can be unit-tested.
 */
export function selectFeatured<T extends { publishing_year: number | null }>(
  allBooks: T[],
  currentYear: number = new Date().getFullYear()
): T[] {
  const cutoffYear = currentYear - 1;
  const isRecent = (b: T) => b.publishing_year !== null && b.publishing_year >= cutoffYear;

  const recentYears = allBooks.filter(isRecent);
  const older = allBooks.filter((b) => !isRecent(b));

  const fixedRecent = recentYears.slice(0, MAX_FEATURED);
  const fillCount = Math.max(0, TOP_FIXED - fixedRecent.length);
  const fixed = [...fixedRecent, ...shuffle(older.slice(0, fillCount))];

  const remainingOlder = older.slice(fillCount);
  const randomFill = shuffle(remainingOlder).slice(0, MAX_FEATURED - fixed.length);

  return [...fixed, ...randomFill];
}
