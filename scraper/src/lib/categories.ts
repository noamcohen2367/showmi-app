/**
 * Theaters describe genre in free text ("קומדיה רומנטית עם שירים",
 * "דרמת מתח ישראלית", "קלאסיקה מוסיקלית לילדים"). The app filters by a small
 * fixed set, so map keywords onto it. A show can land in several.
 *
 * Deliberately conservative: an unmatched label gives no category rather
 * than a wrong one. Check `genreLabel` in the dry-run output and add keywords.
 */
const RULES: ReadonlyArray<[category: string, keywords: RegExp]> = [
  ['קומדיה', /קומדי|קומי|סאטיר/],
  ['דרמה', /דרמ|טרגדי/],
  ['מחזמר', /מחזמר|מיוזיקל|מוזיקלי|מוסיקלי/],
  ['מותחן', /מותחן|(?:^|\s)מתח(?:$|[\s.,!])/],
  ['ילדים', /ילדים|לכל המשפחה|משפחתי לילדים/],
];

export function categoriesFor(...texts: Array<string | undefined>): string[] {
  const haystack = texts.filter(Boolean).join(' ');
  return RULES.filter(([, re]) => re.test(haystack)).map(([category]) => category);
}
