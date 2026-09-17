import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { extractShowUrls, fullSizeImage, normalizeShowUrl, parseShowPage } from '../src/adapters/habima.js';

const html = readFileSync(new URL('./fixtures/habima-show.synthetic.html', import.meta.url), 'utf8');
const URL_ENCODED = 'https://www.habima.co.il/shows/%d7%a1%d7%95%d7%97%d7%a8%d7%99-%d7%92%d7%95%d7%9e%d7%99/';
const NOW = new Date('2026-09-17T05:30:00Z'); // 08:30 Israel time

describe('normalizeShowUrl', () => {
  it('gives lower-case encoding and raw Hebrew the same canonical URL', () => {
    const a = normalizeShowUrl(URL_ENCODED);
    const b = normalizeShowUrl('https://habima.co.il/shows/סוחרי-גומי?utm=x#top');
    expect(a).toEqual(b);
    expect(a?.slug).toBe('סוחרי-גומי');
  });
  it('rejects non-show and foreign URLs', () => {
    expect(normalizeShowUrl('https://www.habima.co.il/presentations/')).toBeNull();
    expect(normalizeShowUrl('https://www.lessin.co.il/shows/x/')).toBeNull();
    expect(normalizeShowUrl('https://www.habima.co.il/en/shows/x/')).toBeNull();
  });
});

describe('extractShowUrls', () => {
  it('finds show links and nothing else', () => {
    expect(extractShowUrls(html).map((u) => decodeURI(u))).toEqual(['https://www.habima.co.il/shows/יתוש-בראש/']);
  });
});

describe('fullSizeImage', () => {
  it('strips the WordPress thumbnail suffix only', () => {
    expect(fullSizeImage('https://x/wp-content/uploads/a-1-1-182x300.jpg')).toBe('https://x/wp-content/uploads/a-1-1.jpg');
    expect(fullSizeImage('https://x/500X575-name.jpg')).toBe('https://x/500X575-name.jpg');
  });
});

describe('parseShowPage', () => {
  const show = parseShowPage(html, URL_ENCODED, NOW);

  it('reads identity and text', () => {
    expect(show.id).toBe('habima-סוחרי-גומי');
    expect(show.name).toBe('סוחרי גומי');
    expect(show.genreLabel).toBe('קומדיה רומנטית עם שירים');
    expect(show.categories).toEqual(['קומדיה']);
    expect(show.synopsis.startsWith('יוחנן, רווק מזדקן')).toBe(true);
    expect(show.synopsis).toContain('\nמשני צידי הדלפק');
    expect(show.synopsis).toContain('\n\nההצגה מכילה');
    expect(show.synopsis).not.toContain('הקלדת טקסט');
  });

  it('keeps only upcoming showtimes, sorted, with ids from the order links', () => {
    expect(show.showtimes).toEqual([
      { id: 'habima-50666', startsAt: '2026-09-17T20:00:00', purchaseUrl: 'https://tickets.habima.co.il/order/50666' },
      { id: 'habima-50667', startsAt: '2026-09-18T11:00:00', purchaseUrl: 'https://tickets.habima.co.il/order/50667' },
      { id: 'habima-50818', startsAt: '2026-10-20T20:00:00', purchaseUrl: 'https://tickets.habima.co.il/order/50818' },
      { id: 'habima-51000', startsAt: '2027-01-02T21:00:00', purchaseUrl: 'https://tickets.habima.co.il/order/51000' },
    ]);
  });

  it('separates cast from creative team and splits multiple names', () => {
    expect(show.performers).toEqual([
      { name: 'עידו מוסרי', role: 'יוחנן צינגרבאי' },
      { name: 'ליליאן ברטו', role: 'בלה ברלו' },
      { name: 'אורי הוכמן', role: 'שמואל ספרול' },
    ]);
    expect(show.credits).toContainEqual({ name: 'ליאם פורמן', role: 'עוזרים מוסיקליים' });
    expect(show.credits).toHaveLength(4);
  });

  it('uses the poster, full size and percent-encoded (safe for expo-image), not the promo pop-up', () => {
    expect(show.images.map((u) => decodeURI(u))).toEqual(['https://www.habima.co.il/wp-content/uploads/2026/06/496X818-סוחרי-גומי-1-1.jpg']);
  });
});
