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

/** `showId` → status. A show absent from this map isn't on the list at all. */
export type WatchlistState = Readonly<Record<string, WatchStatus>>;

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
