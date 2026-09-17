import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  extractActorNames,
  extractCalendarEvents,
  mergeCameriDetails,
  parseCalendar,
  parseCameriShowPage,
} from '../src/adapters/cameri.js';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const NOW = new Date('2026-09-17T05:30:00Z'); // 08:30 Israel time
const calendar = fixture('cameri-calendar.html');

describe('extractCalendarEvents', () => {
  it('parses the escaped JSON literal and ignores code after it', () => {
    const events = extractCalendarEvents(calendar);
    expect(events).toHaveLength(7);
    expect(events[1]!.extendedProps.show_name).toBe('זינגר');
    expect(events[1]!.extendedProps.show_permalink).toBe('https://www.cameri.co.il/הצגות_הקאמרי/%d7%96%d7%99%d7%a0%d7%92%d7%a8/');
  });

  it('fails loudly when the variable is gone', () => {
    expect(() => extractCalendarEvents('<script>let other = [];</script>')).toThrow(/calendarEvents not found/);
  });
});

describe('extractActorNames', () => {
  it('maps option values to trimmed names and skips the placeholder', () => {
    const names = extractActorNames(calendar);
    expect(names.get(576)).toBe('אבי טרמין');
    expect(names.has(0)).toBe(false);
  });
});

describe('parseCalendar', () => {
  const shows = parseCalendar(calendar, NOW);
  const byName = (name: string) => shows.find((s) => s.name === name)!;

  it('groups date entries into shows, and leaves out the academy category', () => {
    expect(shows.map((s) => s.name).sort()).toEqual(['ד"ר סטריינג\'לאב', 'ורד פיקר והפסנתר', 'זינגר', 'קברט']);
  });

  it('builds showtimes from the tuples: Pres Global id, hall, subtitles, no past dates', () => {
    expect(byName('זינגר').showtimes).toEqual([
      { id: 'cameri-45391', startsAt: '2026-09-17T18:30:00', purchaseUrl: 'https://tickets.cameri.co.il/order/45391', hall: 'קאמרי 1', subtitles: 'כתוביות בעברית' },
      { id: 'cameri-45589', startsAt: '2026-10-22T21:00:00', purchaseUrl: 'https://tickets.cameri.co.il/order/45589', hall: 'קאמרי 1' },
    ]);
    expect(byName('קברט').showtimes.map((s) => [s.startsAt, s.subtitles])).toEqual([
      ['2026-11-06T12:00:00', 'English subtitles'],
      ['2026-11-06T20:00:00', undefined],
    ]);
  });

  it('fills show details from the JSON alone', () => {
    const singer = byName('זינגר');
    expect(singer.id).toBe('cameri-זינגר');
    expect(singer.synopsis).toBe('אפוס ססגוני, פרוע וסוחף, בהשראת סיפורו האמיתי של פיטר רחמן, איל הנדל"ן הלונדוני הידוע לשמצה');
    expect(singer.images.map((u) => decodeURI(u))).toEqual([
      'https://s-cameri-pull-zone.b-cdn.net/wp-content/uploads/2025/10/אתר-חדש-3.jpg',
      'https://s-cameri-pull-zone.b-cdn.net/wp-content/uploads/2025/10/זינג-אתר.jpg',
    ]);
    expect(singer.performers.map((p) => p.name)).toEqual(['אבי טרמין', 'אלינור וייל', 'אסתי קוסוביצקי']);
    expect(singer.credits).toEqual([
      { name: 'פיטר פלאנרי', role: 'מאת' },
      { name: 'גלעד קמחי', role: 'בימוי' },
    ]);
  });

  it('decodes HTML entities in names and maps the summary line to categories', () => {
    const strangelove = byName('ד"ר סטריינג\'לאב');
    expect(strangelove.id).toBe('cameri-דר-סטריינגלאב');
    expect(strangelove.categories).toEqual(['קומדיה']);
  });
});

describe('parseCameriShowPage + mergeCameriDetails', () => {
  const details = parseCameriShowPage(fixture('cameri-show.html'));

  it('reads synopsis, team with roles, cast with photos, and the gallery', () => {
    expect(details.synopsis.startsWith('אחרי ששרד את אושוויץ')).toBe(true);
    expect(details.synopsis).toContain('\nאפוס ססגוני');
    expect(details.credits).toEqual([
      { name: 'פיטר פלאנרי', role: 'מאת' },
      { name: 'שחר פנקס', role: 'תרגום' },
      { name: 'תום חודורוב', role: 'תרגום' },
      { name: 'גלעד קמחי', role: 'בימוי' },
    ]);
    expect(details.performers.map((p) => p.name)).toEqual(['עמוס תמם', 'נדב נייטס']);
    expect(decodeURI(details.performers[0]!.photoUrl!)).toBe('https://s-cameri-pull-zone.b-cdn.net/wp-content/uploads/2026/01/עמוס-תמם-1.jpg');
    expect(details.gallery).toHaveLength(3);
  });

  it('prefers page data but keeps the calendar images first and deduplicated', () => {
    const singer = parseCalendar(calendar, NOW).find((s) => s.name === 'זינגר')!;
    const merged = mergeCameriDetails(singer, details);
    expect(merged.synopsis).toBe(details.synopsis);
    expect(merged.performers[0]!.name).toBe('עמוס תמם');
    expect(merged.images.map((u) => decodeURI(u))).toEqual([
      'https://s-cameri-pull-zone.b-cdn.net/wp-content/uploads/2025/10/אתר-חדש-3.jpg',
      'https://s-cameri-pull-zone.b-cdn.net/wp-content/uploads/2025/10/זינג-אתר.jpg',
      'https://s-cameri-pull-zone.b-cdn.net/wp-content/uploads/2025/10/תמונות-לאתר-7.jpg',
      'https://s-cameri-pull-zone.b-cdn.net/wp-content/uploads/2025/10/תמונות-לאתר2-7.jpg',
    ]);
    expect(merged.showtimes).toBe(singer.showtimes);
  });

  it('falls back to calendar data when the page has none', () => {
    const singer = parseCalendar(calendar, NOW).find((s) => s.name === 'זינגר')!;
    const merged = mergeCameriDetails(singer, { synopsis: '', credits: [], performers: [], gallery: [] });
    expect(merged).toEqual(singer);
  });
});
