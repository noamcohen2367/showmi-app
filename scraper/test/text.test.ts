import { describe, expect, it } from 'vitest';

import { categoriesFor } from '../src/lib/categories.js';
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
    expect(categoriesFor('דרמת מתח ישראלית')).toEqual(['דרמה', 'מותחן']);
    expect(categoriesFor('קלאסיקה מוסיקלית לילדים')).toEqual(['מחזמר', 'ילדים']);
    expect(categoriesFor('ההצגה מתחילה בזמן')).toEqual([]);
    expect(categoriesFor('דרמה משפחתית ישראלית')).toEqual(['דרמה']);
  });
});
