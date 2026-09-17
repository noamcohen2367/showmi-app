import { describe, expect, it } from 'vitest';

import { inferYear, israelNowIso, parseDayMonthTime } from '../src/lib/dates.js';

// 17 Sep 2026, 05:30 UTC = 08:30 in Israel (IDT, UTC+3)
const NOW = new Date('2026-09-17T05:30:00Z');

describe('inferYear', () => {
  it('keeps the current year for this month and recent past months', () => {
    expect(inferYear(9, NOW)).toBe(2026);
    expect(inferYear(7, NOW)).toBe(2026);
    expect(inferYear(12, NOW)).toBe(2026);
  });
  it('rolls far-behind months into next year', () => {
    expect(inferYear(1, NOW)).toBe(2027);
    expect(inferYear(6, NOW)).toBe(2027);
  });
});

describe('parseDayMonthTime', () => {
  it('parses the Habima row format', () => {
    expect(parseDayMonthTime('15.09 20:00 יום שלישי', NOW)).toBe('2026-09-15T20:00:00');
    expect(parseDayMonthTime('02.01 21:00 יום שבת', NOW)).toBe('2027-01-02T21:00:00');
  });
  it('accepts unpadded values and rejects nonsense', () => {
    expect(parseDayMonthTime('5.9 9:30', NOW)).toBe('2026-09-05T09:30:00');
    expect(parseDayMonthTime('32.13 25:00', NOW)).toBeNull();
    expect(parseDayMonthTime('לרכישה', NOW)).toBeNull();
  });
});

describe('israelNowIso', () => {
  it('is Israel wall-clock time even on a UTC machine', () => {
    expect(israelNowIso(NOW)).toBe('2026-09-17T08:30:00');
  });
  it('handles winter time (IST, UTC+2)', () => {
    expect(israelNowIso(new Date('2026-12-01T18:00:00Z'))).toBe('2026-12-01T20:00:00');
  });
});
