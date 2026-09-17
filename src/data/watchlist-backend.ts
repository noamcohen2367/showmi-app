/**
 * The one place the watchlist is actually stored.
 *
 * Everything above this file (the `useWatchlist` context, the Home filter
 * bar, the watchlist screen) talks only to `WatchlistBackend` — it never
 * knows where the data physically lives. That's deliberate: this app is
 * getting user accounts with everything persisted in Supabase, and when
 * that happens the *only* file that should need rewriting is this one.
 *
 * Today's implementation is in-memory, which means:
 *
 *   THE WATCHLIST IS CLEARED WHEN THE APP IS CLOSED.
 *
 * That is a known, temporary limitation, not a bug — there is no storage
 * dependency in this project yet (no AsyncStorage, no SQLite, no Supabase),
 * and adding one before the account system exists would mean writing a
 * local schema that Supabase would immediately replace.
 *
 * To swap in Supabase later: keep `WatchlistBackend`'s shape, replace
 * `inMemoryBackend` with one whose methods await the Supabase client, and
 * change the single `export const watchlistBackend =` line at the bottom.
 * `load()` is already async precisely so that swap needs no caller changes.
 */

/** Whether a saved show is one the user still wants to see, or has seen. */
export type WatchStatus = 'want' | 'seen';

/**
 * A show the user typed in by hand, because it isn't in the catalogue — a
 * production seen abroad, at a private theatre, or anything the app doesn't
 * aggregate.
 *
 * Deliberately *not* a partial `Show`. A `Show` promises a venue, a synopsis,
 * a cast, posters and bookable showtimes, and every screen that renders one
 * relies on those being there. A hand-typed memory has a name and, at most, a
 * note about where it was — so it gets its own small shape rather than a
 * `Show` with most of its fields faked or left empty.
 */
export type CustomEntry = {
  /** Free text, as typed. */
  name: string;
  /** Optional "where" — a theatre, a city, a country. */
  note?: string;
};

export type WatchlistEntry = {
  status: WatchStatus;
  /** Present only on hand-typed entries; absent means a catalogue show. */
  custom?: CustomEntry;
};

/**
 * Entry id → entry. For a catalogue show the id *is* the `Show.id`; for a
 * hand-typed one it's locally generated and prefixed (see `CUSTOM_ID_PREFIX`)
 * so the two can never collide in this one map.
 */
export type WatchlistState = Readonly<Record<string, WatchlistEntry>>;

/**
 * Marks ids this app minted rather than ids that came from the catalogue.
 * Keeping both in one map is what lets the watchlist screen render a single
 * ordered list instead of stitching two sources together at every read.
 */
export const CUSTOM_ID_PREFIX = 'custom:';

/** A collision-resistant id for a hand-typed entry. */
export function createCustomId(): string {
  return `${CUSTOM_ID_PREFIX}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export type WatchlistBackend = {
  /** Full current state. Async so a network-backed impl can drop straight in. */
  load(): Promise<WatchlistState>;
  /**
   * Persist the full state. Called after every mutation.
   *
   * Takes the whole map rather than a delta because that's what an
   * in-memory store wants; a Supabase impl would translate this into
   * per-row upserts/deletes internally rather than changing this signature.
   */
  save(state: WatchlistState): Promise<void>;
};

function createInMemoryBackend(): WatchlistBackend {
  // Module-level, not component-level, so the list survives navigation and
  // remounts within a session — just not a process restart.
  let state: WatchlistState = {};

  return {
    async load() {
      return state;
    },
    async save(next) {
      state = next;
    },
  };
}

export const watchlistBackend: WatchlistBackend = createInMemoryBackend();
