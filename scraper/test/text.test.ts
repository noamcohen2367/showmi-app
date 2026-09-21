import { describe, expect, it } from 'vitest';

import { categoriesFor, looksLikeCredits } from '../src/lib/categories.js';
import { combineDateAndTime, fromDateTimeAttr, fromDayMonthYear } from '../src/lib/dates.js';
import { absoluteUrl, decodeEntities, fullSizeImage, matchKey, splitNames, stripBidi } from '../src/lib/text.js';

describe('text helpers', () => {
  it('fullSizeImage strips only a WordPress size suffix', () => {
    expect(fullSizeImage('https://x/a-1-1-182x300.jpg')).toBe('https://x/a-1-1.jpg');
    expect(fullSizeImage('https://x/ורד-פיקר-אופקית--530x344.jpg')).toBe('https://x/ורד-פיקר-אופקית-.jpg');
    expect(fullSizeImage('https://x/500X575-name.jpg')).toBe('https://x/500X575-name.jpg');
    expect(fullSizeImage('https://x/1000x800-ח.jpg')).toBe('https://x/1000x800-ח.jpg');
  });

  it('absoluteUrl resolves, encodes and drops query strings', () => {
    expect(absoluteUrl('/shows/א/?token=abc#x', 'https://www.lessin.co.il')).toBe('https://www.lessin.co.il/shows/%D7%90/');
  });

  it('splitNames handles commas, slashes and pipes', () => {
    expect(splitNames('איתי עברון, ליאם פורמן')).toEqual(['איתי עברון', 'ליאם פורמן']);
    expect(splitNames('טל לוי קצנשטיין/ מאיה פשר')).toEqual(['טל לוי קצנשטיין', 'מאיה פשר']);
  });

  it('decodes entities and strips direction marks', () => {
    expect(decodeEntities('ד&quot;ר &amp; <b>')).toBe('ד"ר & <b>');
    expect(stripBidi('\u2068הגבעטרון\u2069')).toBe('הגבעטרון');
  });

  it('matchKey ignores punctuation and spacing differences', () => {
    expect(matchKey('סיפור הפרברים – המחזמר')).toBe(matchKey('סיפור הפרברים המחזמר!'));
  });
});

describe('date helpers', () => {
  it('reads each site format', () => {
    expect(fromDateTimeAttr('2026-09-16 20:00:00')).toBe('2026-09-16T20:00:00');
    expect(combineDateAndTime('2026-09-17', '18:30')).toBe('2026-09-17T18:30:00');
    expect(fromDayMonthYear('13-12-2026', '9:05')).toBe('2026-12-13T09:05:00');
    expect(fromDateTimeAttr(undefined)).toBeNull();
    expect(combineDateAndTime('2026-09-17', '25:00')).toBeNull();
  });
});

describe('categoriesFor', () => {
  it('maps real taglines conservatively', () => {
    expect(categoriesFor({ label: 'דרמת מתח ישראלית' })).toEqual(['דרמה', 'מותחן']);
    expect(categoriesFor({ label: 'קלאסיקה מוסיקלית לילדים' })).toEqual(['מחזמר', 'ילדים']);
    expect(categoriesFor({ label: 'ההצגה מתחילה בזמן' })).toEqual([]);
    expect(categoriesFor({ label: 'דרמה משפחתית ישראלית' })).toEqual(['דרמה']);
  });

  it('lets a synopsis supply a genre only when the word is a genre claim', () => {
    // "מחזמר" and "קומדיה" in running text are about the piece itself.
    expect(categoriesFor({ prose: 'מחזמר חדש על להקה שמתפרקת' })).toEqual(['מחזמר']);
    expect(categoriesFor({ prose: 'קומדיה שחורה על משפחה אחת' })).toEqual(['קומדיה']);
  });

  it('refuses plot vocabulary from a synopsis', () => {
    // The case this split exists for: Ibsen's "בית בובות" is a drama whose
    // synopsis mentions Nora's children. Before, the catalogue filed it under
    // ילדים.
    expect(categoriesFor({ prose: 'נורה עוזבת את בעלה ואת שלושת ילדיה' })).toEqual([]);
    // Likewise "מתח" as tension between characters, not a thriller.
    expect(categoriesFor({ prose: 'המתח בין האחים גובר לאורך הערב' })).toEqual([]);
    // And "דרמטי" describing a moment rather than the form.
    expect(categoriesFor({ prose: 'ברגע דרמטי אחד הכול מתהפך' })).toEqual([]);
  });

  it('still trusts those same words in a label', () => {
    expect(categoriesFor({ label: 'הצגת ילדים' })).toEqual(['ילדים']);
    expect(categoriesFor({ label: 'מותחן פסיכולוגי' })).toEqual(['מותחן']);
  });

  it('does not duplicate a category found in both sources', () => {
    expect(categoriesFor({ label: 'קומדיה', prose: 'קומדיה על אהבה' })).toEqual(['קומדיה']);
  });
});

describe('looksLikeCredits', () => {
  it('recognises the credits line Lessin puts where a genre would go', () => {
    expect(looksLikeCredits("מאת: ווג'די מועוואד תרגום: אלי ביז'אווי בימוי:יאיר שרמן")).toBe(true);
    expect(looksLikeCredits('עיבוד בימתי סוחף על פי ספרו של בשביס זינגר מאת: נועה לזר קינן')).toBe(true);
  });

  it('does not mistake a genre line that happens to name its writer', () => {
    // No colon after מאת — this is the shape of a usable label, and treating
    // it as credits would throw away the only genre Lessin publishes.
    expect(looksLikeCredits('קומדיה ישראלית חדשה מאת נעם גיל')).toBe(false);
    expect(looksLikeCredits('דרמה ישראלית')).toBe(false);
  });
});
