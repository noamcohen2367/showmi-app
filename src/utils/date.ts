/**
 * Hebrew-locale date/time formatting for showtimes. Kept in one place so
 * every screen that displays a `Showtime` (Home cards now; the show-detail
 * screen and its date picker later) formats it identically.
 */

const weekdayDayMonth = new Intl.DateTimeFormat('he-IL', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

const timeOnly = new Intl.DateTimeFormat('he-IL', {
  hour: '2-digit',
  minute: '2-digit',
});

/** e.g. "יום ג׳, 17 בספט׳ · 20:00" */
export function formatShowtime(iso: string): string {
  const date = new Date(iso);
  return `${weekdayDayMonth.format(date)} · ${timeOnly.format(date)}`;
}

/** The next showtime that hasn't happened yet, or `undefined` if none. */
export function nextUpcomingShowtime<T extends { startsAt: string }>(showtimes: readonly T[]): T | undefined {
  const now = Date.now();
  return showtimes.find((showtime) => new Date(showtime.startsAt).getTime() >= now) ?? showtimes[0];
}
