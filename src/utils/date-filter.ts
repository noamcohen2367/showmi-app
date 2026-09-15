/**
 * The Home screen's date filter: its shape, the presets behind the three
 * quick buttons, and the one function that decides whether a show survives
 * the filter.
 *
 * Kept out of the UI so the calendar sheet, the quick buttons and the feed
 * all agree on what "this show is on that day" means — there's exactly one
 * implementation of that comparison, below.
 */

import type { Show } from '@/types/show';

/** A calendar day as `YYYY-MM-DD`, in local time — never a `Date` object. */
export type DayKey = string;

export type DateFilter =
  | { kind: 'none' }
  | { kind: 'day'; day: DayKey }
  | { kind: 'range'; from: DayKey; to: DayKey };

export const NO_DATE_FILTER: DateFilter = { kind: 'none' };

/**
 * `YYYY-MM-DD` for a `Date`, in the device's local timezone.
 *
 * Deliberately not `toISOString().slice(0, 10)`: that converts to UTC first,
 * so for anywhere east of Greenwich (Israel included) an evening showtime
 * lands on the *previous* day, and a 21:00 performance would vanish from a
 * filter on its own date.
 */
export function toDayKey(date: Date): DayKey {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Adds `days` to a day key, staying in local time. */
export function addDays(day: DayKey, days: number): DayKey {
  const [year, month, date] = day.split('-').map(Number);
  // Month is 0-indexed here, and `Date` normalises overflow for us, so this
  // is also what makes "+1 day" correct across month and year boundaries.
  return toDayKey(new Date(year, month - 1, date + days));
}

export function todayKey(): DayKey {
  return toDayKey(new Date());
}

/**
 * The coming weekend, as a range.
 *
 * In Israel the weekend is Friday–Saturday, which is what this returns —
 * not the Saturday–Sunday a western-locale calendar library would assume.
 * If today *is* Friday or Saturday, "this weekend" means the one already in
 * progress rather than the next one, which is what someone tapping it on a
 * Friday evening is asking for.
 */
export function weekendRange(from: Date = new Date()): { from: DayKey; to: DayKey } {
  const FRIDAY = 5;
  const SATURDAY = 6;
  const weekday = from.getDay();

  if (weekday === FRIDAY) return { from: toDayKey(from), to: addDays(toDayKey(from), 1) };
  if (weekday === SATURDAY) return { from: addDays(toDayKey(from), -1), to: toDayKey(from) };

  const friday = toDayKey(new Date(from.getFullYear(), from.getMonth(), from.getDate() + (FRIDAY - weekday)));
  return { from: friday, to: addDays(friday, 1) };
}

/** Inclusive on both ends; `from`/`to` are ordered by the caller. */
function dayInRange(day: DayKey, from: DayKey, to: DayKey) {
  // Zero-padded `YYYY-MM-DD` sorts chronologically as a plain string, so no
  // parsing is needed for the comparison itself.
  return day >= from && day <= to;
}

/** Puts a range's two ends in chronological order, whichever was tapped first. */
export function orderRange(a: DayKey, b: DayKey): { from: DayKey; to: DayKey } {
  return a <= b ? { from: a, to: b } : { from: b, to: a };
}

/**
 * Does this show have at least one performance matching the filter?
 *
 * A show with no showtimes at all never matches an active date filter —
 * there's no date on which you could go see it.
 */
export function showMatchesDateFilter(show: Show, filter: DateFilter): boolean {
  if (filter.kind === 'none') return true;

  return show.showtimes.some((showtime) => {
    const day = toDayKey(new Date(showtime.startsAt));
    return filter.kind === 'day'
      ? day === filter.day
      : dayInRange(day, filter.from, filter.to);
  });
}

/** Short Hebrew summary of the active filter, for the chip's own label. */
export function describeDateFilter(filter: DateFilter): string | null {
  if (filter.kind === 'none') return null;

  const short = (day: DayKey) => {
    const [, month, date] = day.split('-');
    return `${Number(date)}.${Number(month)}`;
  };

  if (filter.kind === 'day') {
    if (filter.day === todayKey()) return 'היום';
    if (filter.day === addDays(todayKey(), 1)) return 'מחר';
    return short(filter.day);
  }

  const weekend = weekendRange();
  if (filter.from === weekend.from && filter.to === weekend.to) return 'סופ״ש';
  return `${short(filter.from)}–${short(filter.to)}`;
}
