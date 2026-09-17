/**
 * Theaters describe genre in free text ("קומדיה רומנטית עם שירים",
 * "מחזמר אלוהי"). The app filters by a small fixed set, so map keywords
 * onto it. Order doesn't matter; a show can land in several categories.
 *
 * Deliberately conservative: an unmatched label gives no category rather
 * than a wrong one. Check `genreLabel` in the dry-run output and add keywords.
 */
const RULES: ReadonlyArray<[category: string, keywords: RegExp]> = [
  ['קומדיה', /קומדי|קומי|סאטיר/],
  ['דרמה', /דרמ|טרגדי/],
  ['מחזמר', /מחזמר|מיוזיקל|מוזיקלי/],
  ['מותחן', /מותחן|מתח/],
  ['ילדים', /ילדים|משפח/],
];

export function categoriesFor(...texts: Array<string | undefined>): string[] {
  const haystack = texts.filter(Boolean).join(' ');
  return RULES.filter(([, re]) => re.test(haystack)).map(([category]) => category);
}
