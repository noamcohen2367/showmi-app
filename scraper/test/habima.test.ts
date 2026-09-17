import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { extractShowUrls, normalizeShowUrl, parseShowPage } from '../src/adapters/habima.js';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const NOW = new Date('2026-09-17T05:30:00Z'); // 08:30 Israel time
const decoded = (urls: string[]) => urls.map((u) => decodeURI(u));

describe('normalizeShowUrl', () => {
  it('gives every spelling of a show URL the same canonical form', () => {
    const lower = normalizeShowUrl('https://www.habima.co.il/shows/%d7%a1%d7%95%d7%97%d7%a8%d7%99-%d7%92%d7%95%d7%9e%d7%99/');
    const raw = normalizeShowUrl('https://habima.co.il/shows/סוחרי-גומי?utm=x#top');
    expect(lower).toEqual(raw);
    expect(lower?.slug).toBe('סוחרי-גומי');
  });

  it('keeps direction marks in the URL but not in the slug', () => {
    const show = normalizeShowUrl('https://www.habima.co.il/shows/\u2068הגבעטרון-במחווה\u2069/');
    expect(show?.slug).toBe('הגבעטרון-במחווה');
    expect(decodeURI(show!.url)).toContain('\u2068');
  });

  it('rejects non-show and foreign URLs', () => {
    expect(normalizeShowUrl('https://www.habima.co.il/presentations/')).toBeNull();
    expect(normalizeShowUrl('https://www.lessin.co.il/shows/x/')).toBeNull();
    expect(normalizeShowUrl('https://www.habima.co.il/en/shows/x/')).toBeNull();
  });
});

describe('extractShowUrls', () => {
  it('finds show links only', () => {
    const html = '<a href="/shows/יתוש-בראש/">x</a><a href="https://www.habima.co.il/shows/יתוש-בראש">dup</a><a href="/presentations/">no</a>';
    expect(decoded(extractShowUrls(html))).toEqual(['https://www.habima.co.il/shows/יתוש-בראש/']);
  });
});

describe('parseShowPage — cast as cards (real markup)', () => {
  const show = parseShowPage(fixture('habima-show-cards.html'), 'https://www.habima.co.il/shows/פעולות-פשוטות/', NOW);

  it('reads identity, tagline and synopsis', () => {
    expect(show.id).toBe('habima-פעולות-פשוטות');
    expect(show.name).toBe('פעולות פשוטות');
    expect(show.genreLabel).toBe('דרמה משפחתית ישראלית');
    expect(show.categories).toEqual(['דרמה']);
    expect(show.synopsis.startsWith('מה היא משפחה ישראלית?\nאילו פעולות')).toBe(true);
    expect(show.synopsis).not.toContain('משך ההצגה');
  });

  it('dates showtimes from <time datetime>', () => {
    expect(show.showtimes).toEqual([
      { id: 'habima-50713', startsAt: '2026-09-22T20:00:00', purchaseUrl: 'https://tickets.habima.co.il/order/50713' },
      { id: 'habima-50714', startsAt: '2026-09-23T20:00:00', purchaseUrl: 'https://tickets.habima.co.il/order/50714' },
      { id: 'habima-50794', startsAt: '2026-10-06T20:00:00', purchaseUrl: 'https://tickets.habima.co.il/order/50794' },
    ]);
  });

  it('takes the cast from the cards, with characters and full-size headshots', () => {
    expect(show.performers.map(({ name, role }) => [name, role])).toEqual([
      ['אסנת פישמן', 'מאיה'],
      ['תומר שרון', 'גלעד'],
      ['ליליאן ברטו', 'אילנה'],
    ]);
    expect(decodeURI(show.performers[0]!.photoUrl!)).toBe('https://www.habima.co.il/wp-content/uploads/2026/04/0020_אסנת-פישמן.jpg');
    expect(decodeURI(show.performers[0]!.profileUrl!)).toBe('https://www.habima.co.il/actors/אסנת-פישמן/');
  });

  it('keeps the creative team, and drops the "תודות" list', () => {
    expect(show.credits.map((p) => p.role)).toEqual(['מאת', 'בימוי', 'דרמטורגיה', 'תפאורה']);
    expect(JSON.stringify(show)).not.toContain('יואב גלנט');
  });

  it('uses the portrait poster then the gallery at full size — never the banner or headshots', () => {
    expect(decoded(show.images)).toEqual([
      'https://www.habima.co.il/wp-content/uploads/2026/01/496X818-הבימה-מארחת.jpg',
      'https://www.habima.co.il/wp-content/uploads/2025/10/פעולות-פשוטות-תמונת-גלריה-רוחב-3.jpg',
      'https://www.habima.co.il/wp-content/uploads/2025/10/פעולות-פשוטות-תמונת-גלריה-גובה-2.jpg',
      'https://www.habima.co.il/wp-content/uploads/2025/10/פעולות-פשוטות-תמונת-גלריה-רוחב-2.jpg',
      'https://www.habima.co.il/wp-content/uploads/2025/10/פעולות-פשוטות-תמונת-גלריה-רוחב-6.jpg',
    ]);
  });
});

describe('parseShowPage — cast as "role: name" lists', () => {
  const show = parseShowPage(fixture('habima-show-names.html'), 'https://www.habima.co.il/shows/סוחרי-גומי/', NOW);

  it('reads the synopsis with its line breaks, and nothing from the header', () => {
    expect(show.synopsis).toBe('יוחנן, רווק מזדקן צמא לאהבה, נכנס לקנות קונדומים בבית המרקחת של בלה.\nמשני צידי הדלפק מתפתח בינו לבינה רגע נדיר של קרבה.');
    expect(show.categories).toEqual(['קומדיה']);
  });

  it('drops past performances and includes the collapsed "more dates" list', () => {
    expect(show.showtimes.map((s) => [s.id, s.startsAt])).toEqual([
      ['habima-50666', '2026-09-17T20:00:00'],
      ['habima-51000', '2027-01-02T21:00:00'],
    ]);
  });

  it('splits team (first list) from cast (second list) and multiple names', () => {
    expect(show.performers).toEqual([
      { name: 'עידו מוסרי', role: 'יוחנן צינגרבאי' },
      { name: 'ליליאן ברטו', role: 'בלה ברלו' },
      { name: 'אורי הוכמן', role: 'שמואל ספרול' },
    ]);
    expect(show.credits).toContainEqual({ name: 'ליאם פורמן', role: 'עוזרים מוסיקליים' });
    expect(show.credits).toHaveLength(5);
  });

  it('prefers the 496X818 poster source over the wide banner', () => {
    expect(decoded(show.images)).toEqual(['https://www.habima.co.il/wp-content/uploads/2026/06/496X818-סוחרי-גומי-1-1.jpg']);
  });
});
