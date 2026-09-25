/**
 * The words a review is built from.
 *
 * All of it lives here rather than in the database, so rewording a tag or
 * adding one is an edit rather than a migration. The only things the server
 * enforces are shape — at most six tags, and `price_verdict` being one of
 * three known values.
 *
 * Stored as written, which is safe only while the app is Hebrew-only. A
 * second language would need stable ids underneath, with the Hebrew becoming
 * a translation of them — and the tags already written would have to be
 * migrated onto those ids.
 */

/**
 * How the show felt. Multi-select, because a show can be funny and moving at
 * the same time.
 *
 * Both ends of the range on purpose. A vocabulary with only praise in it
 * makes the whole feature read as decoration — nobody believes a wall of
 * compliments, and somebody who disliked a show needs a word for that or
 * they will not write anything at all.
 */
export const FEELING_TAGS = [
  'מרגש',
  'מצחיק',
  'מותח',
  'מעורר מחשבה',
  'מוזיקה מעולה',
  'משחק מרשים',
  'ארוך מדי',
  'לא התחברתי',
] as const;

export type FeelingTag = (typeof FEELING_TAGS)[number];

/**
 * How many a single review may carry.
 *
 * The database allows six. Three is the app's limit, because past that they
 * stop describing this show and start describing theatre in general — and a
 * review tagged with everything is as uninformative as one tagged with
 * nothing.
 */
export const MAX_FEELING_TAGS = 3;

/**
 * Whether the ticket felt deserved. One answer, not a tag: "worth it" and
 * "too expensive" are the same question, and an array would let somebody
 * pick both.
 */
export const PRICE_VERDICTS = [
  { value: 'worth_it', label: 'שווה כל שקל' },
  { value: 'fair', label: 'מחיר הוגן' },
  { value: 'too_much', label: 'יקר מדי' },
] as const;

export type PriceVerdict = (typeof PRICE_VERDICTS)[number]['value'];

export function priceVerdictLabel(value: string | null | undefined): string | undefined {
  return PRICE_VERDICTS.find((v) => v.value === value)?.label;
}

/** The lowest and highest a star rating can be. */
export const MIN_RATING = 1;
export const MAX_RATING = 5;
