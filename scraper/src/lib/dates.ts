/**
 * Theater sites print "15.09 20:00" — no year, and always Israel time.
 * These helpers turn that into the app's `startsAt` format.
 */

const ISRAEL_TZ = 'Asia/Jerusalem';

/** Today's date parts in Israel, regardless of where the scraper runs (GitHub runners are UTC). */
export function israelNowParts(now: Date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ISRAEL_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute') };
}

/**
 * A schedule only ever looks forward a few months, but pages also keep
 * showing dates from the last few days. So a month more than 2 months
 * *behind* today can only mean next year ("02.01" seen in September),
 * while anything closer is this year (including "15.09" seen on the 17th).
 */
export function inferYear(month: number, now: Date = new Date()): number {
  const today = israelNowParts(now);
  return month < today.month - 2 ? today.year + 1 : today.year;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function toLocalIso(year: number, month: number, day: number, hour: number, minute: number): string {
  return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00`;
}

/** Current Israel wall-clock time in the same string format, so plain string comparison works. */
export function israelNowIso(now: Date = new Date()): string {
  const t = israelNowParts(now);
  return toLocalIso(t.year, t.month, t.day, t.hour, t.minute);
}

/** Matches "15.09 20:00" (also "5.9 20:00") anywhere in a string. */
const DAY_MONTH_TIME = /(\d{1,2})\.(\d{1,2})\s+(\d{1,2}):(\d{2})/;

export function parseDayMonthTime(text: string, now: Date = new Date()): string | null {
  const m = text.match(DAY_MONTH_TIME);
  if (!m) return null;
  const [day, month, hour, minute] = m.slice(1).map(Number) as [number, number, number, number];
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  return toLocalIso(inferYear(month, now), month, day, hour, minute);
}
