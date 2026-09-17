import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

import { buildLessinShows, extractLessinShowUrls, parseLessinHome, parseLessinShowPage } from '../src/adapters/lessin.js';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const NOW = new Date('2026-09-17T05:30:00Z'); // 08:30 Israel time
const SHOW_URL = 'https://www.lessin.co.il/shows/%D7%90%D7%A3-%D7%9E%D7%99%D7%9C%D7%94-%D7%9C%D7%90%D7%9E%D7%90/';

describe('parseLessinHome', () => {
  const home = parseLessinHome(fixture('lessin-home.html'));

  it('reads date with year, hall, time and title; the duplicate host list collapses', () => {
    expect(home).toHaveLength(5);
    expect(home[0]).toEqual({ orderId: '45017', startsAt: '2026-09-17T11:00:00', title: 'מסיבת אירוסין', hall: 'אולם 2' });
    expect(home.find((e) => e.orderId === '45099')?.startsAt).toBe('2026-12-13T20:30:00');
  });
});

describe('extractLessinShowUrls', () => {
  it('normalises show links and ignores the rest', () => {
    const html = '<a href="/shows/אף-מילה-לאמא/?x=1">a</a><a href="https://www.lessin.co.il/shows/אף-מילה-לאמא/">b</a><a href="/about/">c</a>';
    expect(extractLessinShowUrls(html).map((u) => decodeURI(u))).toEqual(['https://www.lessin.co.il/shows/אף-מילה-לאמא/']);
  });
});

describe('parseLessinShowPage', () => {
  const page = parseLessinShowPage(fixture('lessin-show.html'), SHOW_URL);

  it('reads name (without the video link), tagline and synopsis without house notes', () => {
    expect(page.id).toBe('lessin-אף-מילה-לאמא');
    expect(page.name).toBe('אף מילה לאמא');
    expect(page.genreLabel).toBe('קומדיה ישראלית חדשה מאת נעם גיל');
    expect(page.categories).toEqual(['קומדיה']);
    expect(page.synopsis.split('\n\n')).toEqual([
      'קומדיה אנטי-רומנטית מצחיקה עד דמעות',
      'כשנורית מגלה שבעלה בוגד בה, היא מזמינה את בעלה של המאהבת ודורשת ממנו לצאת איתה למלחמה על כבודם האבוד.',
      'המחזה הוצג בקריאה מבוימת במסגרת פסטיבל "פותחים במה" 2024.',
    ]);
    expect(page.synopsis).not.toContain('מובייל');
  });

  it('splits cast from team; alternating cast names become separate people', () => {
    expect(page.performers.map((p) => p.name)).toEqual(['לימור גולדשטיין', 'מולי שולמן', 'יובל ינאי', 'קרן מור מישורי', 'יעל שטולמן']);
    expect(page.performers.every((p) => p.role === '')).toBe(true);
    expect(page.credits).toEqual([
      { name: 'נעם גיל', role: 'מאת' },
      { name: 'אודי גוטשלק', role: 'בימוי' },
      { name: 'שרי גוליאט', role: 'ע. מעצב תפאורה' },
    ]);
  });

  it('reads one row per order id, and poster + full-size photos', () => {
    expect(page.rows).toEqual([
      { orderId: '45033', dayMonthTime: '18.09 21:30', hall: 'אולם 2' },
      { orderId: '45034', dayMonthTime: '19.09 17:00', hall: 'אולם 2' },
      { orderId: '45035', dayMonthTime: '22.09 18:00', hall: 'אולם 2' },
    ]);
    expect(page.images.map((u) => decodeURI(u))).toEqual([
      'https://www.lessin.co.il/wp-content/uploads/2025/10/1000x800-ח.jpg',
      'https://www.lessin.co.il/wp-content/uploads/2025/10/Af-Mila-Leima-Photo_by_Kfir_Bolotin_15.jpg',
      'https://www.lessin.co.il/wp-content/uploads/2025/10/Af-Mila-Leima-Photo_by_Kfir_Bolotin_03.jpg',
    ]);
  });
});

describe('buildLessinShows', () => {
  it('joins by order id, adds home-only performances by title, drops past ones', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const [show] = buildLessinShows(
      [parseLessinShowPage(fixture('lessin-show.html'), SHOW_URL)],
      parseLessinHome(fixture('lessin-home.html')),
      NOW,
    );
    expect(show!.showtimes).toEqual([
      { id: 'lessin-45033', startsAt: '2026-09-18T21:30:00', purchaseUrl: 'https://lessin.presglobal.store/order/45033', hall: 'אולם 2' },
      { id: 'lessin-45034', startsAt: '2026-09-19T17:00:00', purchaseUrl: 'https://lessin.presglobal.store/order/45034', hall: 'אולם 2' },
      // not on the home page → year inferred
      { id: 'lessin-45035', startsAt: '2026-09-22T18:00:00', purchaseUrl: 'https://lessin.presglobal.store/order/45035', hall: 'אולם 2' },
      // only on the home page, title spelled slightly differently → matched by title
      { id: 'lessin-45099', startsAt: '2026-12-13T20:30:00', purchaseUrl: 'https://lessin.presglobal.store/order/45099', hall: 'אולם 1' },
    ]);
    expect(show).not.toHaveProperty('rows');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('מסיבת אירוסין'));
    warn.mockRestore();
  });
});
