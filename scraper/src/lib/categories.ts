/**
 * Theaters describe genre in free text ("קומדיה רומנטית עם שירים",
 * "דרמת מתח ישראלית"). The app filters by a small fixed set, so map keywords
 * onto it. A show can land in several.
 *
 * Deliberately conservative: an unmatched show gets no category rather than
 * a wrong one.
 *
 * That principle is why matching is split by *where the text came from*:
 *
 *  - A **label** is text that declares a genre: the theater's own genre
 *    line, and — for a site that writes one — the synopsis's opening line.
 *    Anything it says can be taken at face value.
 *  - **Prose** is plot description. It mentions words in passing, and only
 *    rules whose keyword is effectively a genre *claim* may match it.
 *
 * Which is which is a fact about each site, so the adapters decide: Lessin
 * opens its synopsis with the genre ("דרמה חברתית.", "דרמה קומית. עיבוד
 * לסרט מצליח."), while Habima and Cameri start straight into plot.
 *
 * Both halves of the split were measured against the live catalogue. Feeding
 * every synopsis to every rule recovered 48 of 104 uncategorised shows, but
 * filed Ibsen's "בית בובות" as a children's show because its synopsis
 * mentions Nora's children. Treating every synopsis's first line as a
 * declaration did the same. Prose says "ילדים" and "מתח" constantly without
 * meaning the genre; it rarely says "מחזמר" or "קומדיה" about anything but
 * itself.
 */

type Rule = {
  category: string;
  keywords: RegExp;
  /**
   * Whether this rule may match running prose. False for keywords that are
   * ordinary plot vocabulary as well as genre names.
   */
  matchesProse: boolean;
};

const RULES: readonly Rule[] = [
  // "קומדיה"/"סאטירה" in a synopsis is nearly always a claim about the piece.
  // "קומי" is not — "רגע קומי" describes a moment — so it stays label-only.
  { category: 'קומדיה', keywords: /קומדי|סאטיר/, matchesProse: true },
  { category: 'קומדיה', keywords: /קומי/, matchesProse: false },
  // A musical announces itself; prose does not call a play a מחזמר by accident.
  { category: 'מחזמר', keywords: /מחזמר|מיוזיקל|מוזיקלי|מוסיקלי/, matchesProse: true },
  // "דרמטי" is everywhere in blurbs ("רגע דרמטי"), so labels only.
  { category: 'דרמה', keywords: /דרמ|טרגדי/, matchesProse: false },
  // Likewise "מתח" — "מתח בין הדמויות" is a description, not a thriller.
  { category: 'מותחן', keywords: /מותחן|(?:^|\s)מתח(?:$|[\s.,!])/, matchesProse: false },
  // And "ילדים" — plenty of adult drama is about someone's children.
  { category: 'ילדים', keywords: /ילדים|לכל המשפחה|משפחתי לילדים/, matchesProse: false },
];

export type CategorySources = {
  /** The theater's own genre line, plus anything else equally declarative. */
  label?: string | undefined;
  /** Plot description. Matched only by rules marked `matchesProse`. */
  prose?: string | undefined;
};

/**
 * Splits a synopsis into its opening declaration and the plot that follows.
 *
 * For the one site that writes a genre line there — Lessin — the opening
 * paragraph is a label and the remainder is prose. Adapters for sites that
 * don't should pass the whole synopsis as `prose` instead of calling this.
 */
export function splitDeclaredGenre(synopsis: string): { label: string; prose: string } {
  const [first = '', ...rest] = synopsis.split('\n\n');
  return { label: first, prose: rest.join('\n\n') };
}

/**
 * The categories a show belongs to.
 *
 * Check `genreLabel` in the dry-run output and widen the rules from real
 * values rather than from guesses — a keyword that never appears costs
 * nothing, but one that appears in the wrong context mis-files shows.
 */
export function categoriesFor({ label, prose }: CategorySources): string[] {
  const found = new Set<string>();

  for (const rule of RULES) {
    if (label && rule.keywords.test(label)) found.add(rule.category);
    else if (rule.matchesProse && prose && rule.keywords.test(prose)) found.add(rule.category);
  }

  return [...found];
}

/**
 * Whether a line is a credits list rather than a description.
 *
 * Lessin's show pages put the writer/translator/director in the same slot
 * that sometimes holds a genre line, and the page carries no genre anywhere
 * else — no `og:description`, no taxonomy. Recognising the shape is the only
 * way to tell the two apart, so a credits line can be left out of
 * `genreLabel` instead of sitting in the database's genre column.
 */
export function looksLikeCredits(text: string): boolean {
  // "מאת:", "בימוי:", "תרגום:" and friends — a role followed by a colon.
  // The colon matters: "מאת נעם גיל" tacked onto a real genre line ("קומדיה
  // ישראלית חדשה מאת נעם גיל") must NOT count, or a usable label is lost.
  return /(?:^|\s)(?:מאת|בימוי|תרגום|עיבוד|מוסיקה|מוזיקה|כוריאוגרפיה|תפאורה|תלבושות)\s*:/.test(text);
}
