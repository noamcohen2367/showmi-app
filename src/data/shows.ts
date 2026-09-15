import type { Show, Showtime } from '@/types/show';

/**
 * Local mock data standing in for a real backend, so the Home screen has
 * something real to render while that backend doesn't exist yet.
 *
 * Names/theaters/actors below are entirely fictional (not real Israeli
 * theaters or performers) — this is placeholder content for development,
 * not a representation of real shows.
 *
 * Everything below the data itself (`fetchHomeFeed`, `fetchAllShows`) is
 * written the way a real API client would be — `async`, returning the same
 * shapes a network call would — specifically so that swapping this file's
 * *implementation* for real `fetch()` calls later shouldn't require
 * changing anything that *calls* these functions (the Home screen, and
 * later the show-detail screen).
 */

const THEATERS = {
  or: { id: 'theater-or', name: 'תיאטרון האור', city: 'תל אביב' },
  stage: { id: 'theater-stage', name: 'הבמה העירונית', city: 'ירושלים' },
  harbor: { id: 'theater-harbor', name: 'תיאטרון הנמל', city: 'חיפה' },
} as const;

const ACTOR_POOL = [
  { id: 'actor-1', name: 'נועה שגיא' },
  { id: 'actor-2', name: 'איתמר בן־דוד' },
  { id: 'actor-3', name: 'מיכל אורן' },
  { id: 'actor-4', name: 'יובל כרמי' },
  { id: 'actor-5', name: 'דנה לביא' },
  { id: 'actor-6', name: 'אורי שחר' },
  { id: 'actor-7', name: 'טליה רוז' },
  { id: 'actor-8', name: 'גיא אברמוב' },
  { id: 'actor-9', name: 'רוני פלד' },
  { id: 'actor-10', name: 'שירה נחמיאס' },
];

function actors(...indexes: number[]) {
  return indexes.map((i) => ACTOR_POOL[i]);
}

/**
 * Deterministic, varied-looking placeholder photos — see the picsum.photos
 * docs for the `/seed/{seed}` form.
 *
 * Sized for the *largest* place an image actually renders at today
 * (`ShowCard`, ~148 logical px wide → ~300px at 2x density) rather than
 * some arbitrary "big enough" size — a real API/CDN would give you
 * right-sized images too, and requesting far more pixels than anything on
 * screen needs is wasted network + decode time on every image, on every
 * screen that uses it (`ShowListItem`'s smaller thumbnail just downscales
 * this same image further, which is cheap; re-fetching a much larger
 * original for it would not be).
 */
function images(showId: string, count: number) {
  return Array.from({ length: count }, (_, i) => `https://picsum.photos/seed/${showId}-${i}/300/450`);
}

/**
 * A handful of upcoming showtimes for a show, starting a few days from now.
 * `purchaseUrl` is intentionally per-showtime (a real ticketing site would
 * give each date+time its own listing/price) and points at an obviously
 * fake domain — there is no real ticketing backend behind it.
 */
function showtimes(showId: string, dayOffsets: number[], hour: number): Showtime[] {
  const now = new Date();
  return dayOffsets.map((offset, i) => {
    const date = new Date(now);
    date.setDate(date.getDate() + offset);
    date.setHours(hour, 0, 0, 0);
    const id = `${showId}-showtime-${i}`;
    return { id, startsAt: date.toISOString(), purchaseUrl: `https://tickets.example.co.il/show/${showId}/${id}` };
  });
}

export const SHOWS: readonly Show[] = [
  {
    id: 'show-lila-bli-kochavim',
    name: 'לילה בלי כוכבים',
    theater: THEATERS.or,
    synopsis: 'משפחה אחת, ערב אחד, וסוד ישן שסוף־סוף עולה על פני השטח. דרמה קאמרית על מה שנשאר כשהאורות כבים.',
    actors: actors(0, 1, 2),
    images: images('show-lila-bli-kochavim', 3),
    categories: ['דרמה'],
    showtimes: showtimes('show-lila-bli-kochavim', [3, 5, 10, 12], 20),
  },
  {
    id: 'show-malon-ksum',
    name: 'מלון קסום',
    theater: THEATERS.stage,
    synopsis: 'מלון בוטיק, פקיד קבלה חדש, ואורח אחד שמסרב לעזוב. קומדיה על טעויות מצחיקות מדי בשביל להיות מקריות.',
    actors: actors(3, 4, 5, 6),
    images: images('show-malon-ksum', 4),
    categories: ['קומדיה'],
    showtimes: showtimes('show-malon-ksum', [2, 4, 6, 9, 11], 21),
  },
  {
    id: 'show-hamelech-hatzochek',
    name: 'המלך הצוחק',
    theater: THEATERS.harbor,
    synopsis: 'מחזמר גדול על מלך שמאבד את הכתר שלו — ומגלה שהוא לא צריך אותו כדי להצחיק את הממלכה.',
    actors: actors(1, 4, 7, 8),
    images: images('show-hamelech-hatzochek', 5),
    categories: ['מחזמר'],
    showtimes: showtimes('show-hamelech-hatzochek', [1, 4, 8, 15], 20),
  },
  {
    id: 'show-habait-barechov-hashaket',
    name: 'הבית ברחוב השקט',
    theater: THEATERS.or,
    synopsis: 'שכונה שקטה, שכן חדש, ולילה אחד שמשנה הכול. מותחן שלא נותן לנחש עד הסוף.',
    actors: actors(2, 6, 9),
    images: images('show-habait-barechov-hashaket', 3),
    categories: ['מותחן'],
    showtimes: showtimes('show-habait-barechov-hashaket', [6, 7, 13, 14, 20], 21),
  },
  {
    id: 'show-cafe-beshaa-shmone',
    name: 'קפה בשעה שמונה',
    theater: THEATERS.stage,
    synopsis: 'שני זרים, בית קפה אחד, ופגישה שהייתה אמורה להימשך חמש דקות. קומדיה רומנטית עם הפתעה בכל שולחן.',
    actors: actors(0, 5, 7),
    images: images('show-cafe-beshaa-shmone', 3),
    categories: ['קומדיה'],
    showtimes: showtimes('show-cafe-beshaa-shmone', [2, 3, 9, 16], 20),
  },
  {
    id: 'show-kochavim-batzohorayim',
    name: 'כוכבים בצהריים',
    theater: THEATERS.harbor,
    synopsis: 'להקת רחוב חולמת על במה גדולה. מחזמר משפחתי על חלומות שלא מוותרים למרות הכול.',
    actors: actors(3, 8, 9, 2),
    images: images('show-kochavim-batzohorayim', 4),
    categories: ['מחזמר', 'ילדים'],
    showtimes: showtimes('show-kochavim-batzohorayim', [1, 2, 8, 9, 15, 16], 17),
  },
  {
    id: 'show-hashir-haacharon',
    name: 'השיר האחרון',
    theater: THEATERS.or,
    synopsis: 'זמרת ותיקה חוזרת לבמה אחרונה. דרמה מוזיקלית על קול שלא מפסיק לשיר גם כשקשה.',
    actors: actors(4, 1),
    images: images('show-hashir-haacharon', 3),
    categories: ['דרמה', 'מחזמר'],
    showtimes: showtimes('show-hashir-haacharon', [5, 12, 19], 20),
  },
  {
    id: 'show-pingvin-bechalifa',
    name: 'פינגווין בחליפה',
    theater: THEATERS.stage,
    synopsis: 'פינגווין שרוצה לעבוד במשרד. הצגת ילדים עליזה על להיות בדיוק מי שאתה, איפה שלא תהיה.',
    actors: actors(6, 9, 5),
    images: images('show-pingvin-bechalifa', 3),
    categories: ['ילדים'],
    showtimes: showtimes('show-pingvin-bechalifa', [3, 4, 10, 11, 17, 18], 10),
  },
  {
    id: 'show-tzel-bagan',
    name: 'צל בגן',
    theater: THEATERS.harbor,
    synopsis: 'גנן שרואה משהו שהוא לא אמור לראות. מותחן אינטימי שכולו מתח עד המשפט האחרון.',
    actors: actors(8, 0, 3),
    images: images('show-tzel-bagan', 3),
    categories: ['מותחן', 'דרמה'],
    showtimes: showtimes('show-tzel-bagan', [7, 14, 21], 21),
  },
] as const;

/** One slide of the promotional banner at the top of the Home screen. */
export type Promo = {
  id: string;
  imageUrl: string;
};

// Wide (2:1), banner-shaped placeholder images — a real API would give
// these as flat ad-campaign images too, likely with their own destination
// link; not modeled yet since the banner isn't wired to navigate anywhere
// yet (same "not built yet" note as `ShowCard`/`ShowListItem`).
const PROMOS: readonly Promo[] = [
  { id: 'promo-1', imageUrl: 'https://picsum.photos/seed/promo-1/800/400' },
  { id: 'promo-2', imageUrl: 'https://picsum.photos/seed/promo-2/800/400' },
  { id: 'promo-3', imageUrl: 'https://picsum.photos/seed/promo-3/800/400' },
  { id: 'promo-4', imageUrl: 'https://picsum.photos/seed/promo-4/800/400' },
] as const;

export type HomeFeed = {
  promos: Promo[];
  suggested: Show[];
  fresh: Show[];
  trending: Show[];
  categories: string[];
  all: Show[];
};

/**
 * Stands in for a `GET /home` call. "Suggested for you" would really come
 * from a personalization backend; here it's just a fixed, plausible-looking
 * subset — the point is the shape callers get, not the selection logic.
 */
export async function fetchHomeFeed(): Promise<HomeFeed> {
  const categories = Array.from(new Set(SHOWS.flatMap((show) => show.categories)));
  return {
    promos: [...PROMOS],
    suggested: [SHOWS[2], SHOWS[4], SHOWS[6], SHOWS[0]],
    fresh: [SHOWS[7], SHOWS[8], SHOWS[1]],
    trending: [SHOWS[5], SHOWS[3], SHOWS[2], SHOWS[6]],
    categories,
    all: [...SHOWS],
  };
}

export async function fetchShowById(id: string): Promise<Show | undefined> {
  return SHOWS.find((show) => show.id === id);
}
