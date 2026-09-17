import type { Actor, Show, Showtime } from '@/types/show';

/**
 * The show catalogue, read from Supabase.
 *
 * The tables are filled by the scraper (`scraper/`, run twice a day by
 * GitHub Actions) with the real schedules of Habima, Cameri and Beit Lessin.
 * This file only reads them, through the publishable key — row-level
 * security on those tables allows `select` and nothing else.
 *
 * The exported functions keep exactly the shapes the mock version had, so
 * no screen changed when this file did.
 *
 * Plain `fetch` against Supabase's REST endpoint rather than
 * `@supabase/supabase-js`: one read-only query needs no client library, no
 * polyfills and no session storage. When user accounts arrive (see
 * `watchlist-backend.ts`), that is the moment to add the client — and this
 * file can move onto it or stay as it is.
 */

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** How long one loaded catalogue is reused. The data itself only changes twice a day. */
const CACHE_TTL_MS = 10 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 15_000;

/** How many shows each curated Home row shows. */
const ROW_SIZE = 8;

// ---------------------------------------------------------------------------
// Public API — same shapes as before
// ---------------------------------------------------------------------------

/** One slide of the promotional banner at the top of the Home screen. */
export type Promo = {
  id: string;
  imageUrl: string;
};

export type HomeFeed = {
  promos: Promo[];
  suggested: Show[];
  fresh: Show[];
  trending: Show[];
  categories: string[];
  all: Show[];
};

/**
 * Every screen calls `useHomeFeed`, and each call lands here. With mock data
 * that was free; over the network it would mean one request per screen
 * mounted. So the first call starts the request and every call within
 * `CACHE_TTL_MS` shares it — including calls that arrive while it's still
 * in flight. A failed request isn't cached, so the next screen retries.
 */
let cached: { at: number; feed: Promise<HomeFeed> } | null = null;

export function fetchHomeFeed(): Promise<HomeFeed> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.feed;

  const feed = fetchCatalog().then((entries) => buildHomeFeed(entries, new Date()));
  const entry = { at: Date.now(), feed };
  cached = entry;
  feed.catch(() => {
    if (cached === entry) cached = null;
  });
  return feed;
}

export async function fetchShowById(id: string): Promise<Show | undefined> {
  const feed = await fetchHomeFeed();
  return feed.all.find((show) => show.id === id);
}

// ---------------------------------------------------------------------------
// Supabase
// ---------------------------------------------------------------------------

/** A `shows` row as the query below returns it, with its theater and showtimes embedded. */
export type ShowRow = {
  id: string;
  name: string;
  synopsis: string;
  images: string[] | null;
  dominant_color: string | null;
  categories: string[] | null;
  performers: { name: string; role?: string; photoUrl?: string }[] | null;
  first_seen_at: string;
  theater: { id: string; name: string; city: string } | null;
  showtimes: { id: string; starts_at: string; purchase_url: string }[] | null;
};

/** A show plus the one fact the curated rows need that `Show` doesn't carry. */
export type CatalogEntry = { show: Show; firstSeenAt: string };

async function fetchCatalog(): Promise<CatalogEntry[]> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error(
      'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY. ' +
        'Add them to .env.local in the project root and restart with `npx expo start --clear`.',
    );
  }

  // Showtimes are stored as Israel wall-clock time without a zone. "Now" as a
  // UTC wall-clock string is 2–3 hours *behind* Israel, so this cutoff keeps a
  // show that started a moment ago and drops everything older — and needs no
  // time-zone database on the device. The scraper also prunes past dates on
  // every run; this only covers the hours between runs.
  const cutoff = new Date().toISOString().slice(0, 19);

  const query = [
    [
      'select',
      'id,name,synopsis,images,dominant_color,categories,performers,first_seen_at,' +
        'theater:theaters(id,name,city),showtimes(id,starts_at,purchase_url)',
    ],
    ['is_active', 'eq.true'],
    ['showtimes.starts_at', `gte.${cutoff}`],
    ['showtimes.order', 'starts_at.asc'],
    ['order', 'name.asc'],
  ]
    // Built by hand rather than with URLSearchParams, whose React Native
    // implementation has historically been incomplete.
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/shows?${query}`, {
      headers: { apikey: SUPABASE_KEY, Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Supabase responded ${response.status}: ${await response.text()}`);
    }
    const rows = (await response.json()) as ShowRow[];
    return rows.flatMap((row) => {
      const show = rowToShow(row);
      return show ? [{ show, firstSeenAt: row.first_seen_at }] : [];
    });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * One row → the app's `Show`. Returns null for a row no screen could render:
 * every card and the detail hero read `images[0]`, and `Show` promises a
 * theater, so a show missing either is left out rather than half-drawn.
 */
export function rowToShow(row: ShowRow): Show | null {
  const images = (row.images ?? []).filter(Boolean);
  if (!row.theater || images.length === 0) return null;

  // The scraper keeps one person per (name, role), so someone listed twice —
  // a double role, or both a card and a text line — would repeat here.
  const seen = new Set<string>();
  const actors: Actor[] = [];
  for (const [index, performer] of (row.performers ?? []).entries()) {
    if (!performer?.name || seen.has(performer.name)) continue;
    seen.add(performer.name);
    actors.push({
      id: `${row.id}:actor-${index}`,
      name: performer.name,
      ...(performer.photoUrl ? { photoUrl: performer.photoUrl } : {}),
    });
  }

  const showtimes: Showtime[] = (row.showtimes ?? [])
    .map((s) => ({ id: s.id, startsAt: s.starts_at.slice(0, 19), purchaseUrl: s.purchase_url }))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  return {
    id: row.id,
    name: row.name,
    theater: row.theater,
    synopsis: row.synopsis,
    actors,
    images,
    ...(row.dominant_color ? { dominantColor: row.dominant_color } : {}),
    categories: row.categories ?? [],
    showtimes,
  };
}

// ---------------------------------------------------------------------------
// Curated rows
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;
const localKey = (date: Date) => date.toISOString().slice(0, 19);

function showtimesWithin(show: Show, from: string, to: string) {
  return show.showtimes.filter((s) => s.startsAt >= from && s.startsAt < to).length;
}

/**
 * There's no personalisation or analytics backend, so each row is a plain,
 * explainable rule over the data that *does* exist:
 *
 * - suggested: most performances in the next month — what theaters are
 *   betting on, and what's easiest to actually get into.
 * - fresh: most recently added to the catalogue. Right after the first sync
 *   every show was added at once, so until new ones appear it falls back to
 *   the productions whose run starts latest.
 * - trending: most performances in the coming week.
 * - promos: the second image (usually a production photo) of the shows
 *   playing soonest — real imagery, but nothing to tap yet, as before.
 *
 * Only shows with upcoming dates are eligible for the rows; "all" keeps
 * everything, dated shows first.
 */
export function buildHomeFeed(entries: CatalogEntry[], now: Date): HomeFeed {
  const shows = entries.map((entry) => entry.show);
  const addedAt = new Map(entries.map((entry) => [entry.show.id, entry.firstSeenAt]));
  const nowKey = localKey(now);
  const weekKey = localKey(new Date(now.getTime() + 7 * DAY_MS));
  const monthKey = localKey(new Date(now.getTime() + 30 * DAY_MS));

  const dated = shows.filter((show) => show.showtimes.length > 0);
  const firstDate = (show: Show) => show.showtimes[0]?.startsAt ?? '9999';

  const suggested = [...dated]
    .sort((a, b) => showtimesWithin(b, nowKey, monthKey) - showtimesWithin(a, nowKey, monthKey) || a.name.localeCompare(b.name))
    .slice(0, ROW_SIZE);

  const fresh = [...dated]
    .sort((a, b) => (addedAt.get(b.id) ?? '').localeCompare(addedAt.get(a.id) ?? '') || firstDate(b).localeCompare(firstDate(a)))
    .slice(0, ROW_SIZE);

  const trending = dated
    .filter((show) => showtimesWithin(show, nowKey, weekKey) > 0)
    .sort((a, b) => showtimesWithin(b, nowKey, weekKey) - showtimesWithin(a, nowKey, weekKey) || firstDate(a).localeCompare(firstDate(b)))
    .slice(0, ROW_SIZE);

  const promos = [...dated]
    .sort((a, b) => firstDate(a).localeCompare(firstDate(b)))
    .filter((show) => show.images.length > 1)
    .slice(0, 4)
    .map((show) => ({ id: `promo-${show.id}`, imageUrl: show.images[1]! }));

  const all = [
    ...[...dated].sort((a, b) => a.name.localeCompare(b.name, 'he')),
    ...shows.filter((show) => show.showtimes.length === 0),
  ];

  return {
    promos,
    suggested,
    fresh,
    trending,
    categories: Array.from(new Set(all.flatMap((show) => show.categories))),
    all,
  };
}
