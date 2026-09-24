/**
 * The one place the watchlist is actually stored.
 *
 * Everything above this file (the `useWatchlist` context, the Home filter
 * bar, the watchlist screen) talks only to `WatchlistBackend` — it never
 * knows where the data physically lives.
 *
 * There are two implementations, and which one is in use depends on whether
 * anybody is signed in:
 *
 *  - **Signed out** — in memory, and so LOST WHEN THE APP CLOSES. Kept
 *    rather than removed because the catalogue is open to everyone: someone
 *    should be able to save a show before deciding whether to make an
 *    account, and what they saved is carried up when they do.
 *  - **Signed in** — the `watchlist` table, under row-level security that
 *    confines every statement to `auth.uid()`.
 *
 * `WatchlistProvider` picks between them, because it is the only thing that
 * knows about the session.
 */

import { supabase } from './supabase';

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
/**
 * When a hand-typed show was seen, and how precisely that is known.
 *
 * People remember "London, 2019" far more often than an exact day, and a
 * field that only accepts a full date makes them either invent one or leave
 * it blank. `precision` is what lets a year be stored as a real date — that
 * year's 1 January — without the display then claiming a day nobody said.
 */
export type SeenOn = {
  /** ISO `YYYY-MM-DD`. For `year` precision, always the 1st of January. */
  date: string;
  precision: 'year' | 'day';
};

export type CustomEntry = {
  /** Free text, as typed. The only part that is required. */
  name: string;
  /** Optional "where" — a theatre, a city, a country. */
  location?: string;
  /** Optional "when". */
  seenOn?: SeenOn;
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
  /** Full current state. */
  load(): Promise<WatchlistState>;
  /**
   * Persist the full state. Called after every mutation.
   *
   * Takes the whole map rather than a delta because that is what a caller
   * naturally has; the Supabase implementation works out the per-row writes
   * itself. **Rejects if the write did not happen** — callers must treat a
   * rejection as "the change was not saved" and undo their optimistic
   * update, which is the whole reason this returns a promise.
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

/**
 * The signed-out list. A single shared instance, so signing out and back in
 * within one session does not silently resurrect a stale copy.
 */
export const inMemoryWatchlistBackend: WatchlistBackend = createInMemoryBackend();

/** Exactly the columns this app reads; see `supabase/migrations/0002_watchlist.sql`. */
type WatchlistRow = {
  entry_id: string;
  show_id: string | null;
  status: WatchStatus;
  custom_name: string | null;
  custom_location: string | null;
  seen_on: string | null;
  seen_on_precision: 'year' | 'day' | null;
};

const SELECTED_COLUMNS =
  'entry_id, show_id, status, custom_name, custom_location, seen_on, seen_on_precision';

function rowToEntry(row: WatchlistRow): WatchlistEntry {
  // `custom_name` is what distinguishes the two kinds of row — the database
  // enforces that exactly one of them is filled in.
  if (row.custom_name === null) return { status: row.status };

  return {
    status: row.status,
    custom: {
      name: row.custom_name,
      ...(row.custom_location ? { location: row.custom_location } : {}),
      // The database's own constraint guarantees these two are set together,
      // so testing one is enough to trust the other.
      ...(row.seen_on && row.seen_on_precision
        ? { seenOn: { date: row.seen_on, precision: row.seen_on_precision } }
        : {}),
    },
  };
}

function entryToRow(userId: string, entryId: string, entry: WatchlistEntry) {
  return {
    user_id: userId,
    entry_id: entryId,
    // A catalogue entry's id IS the show id — that is the invariant the
    // table's check constraint enforces from the other side.
    show_id: entry.custom ? null : entryId,
    status: entry.status,
    custom_name: entry.custom?.name ?? null,
    custom_location: entry.custom?.location ?? null,
    seen_on: entry.custom?.seenOn?.date ?? null,
    seen_on_precision: entry.custom?.seenOn?.precision ?? null,
  };
}

const sameEntry = (a: WatchlistEntry | undefined, b: WatchlistEntry | undefined) =>
  a?.status === b?.status &&
  a?.custom?.name === b?.custom?.name &&
  a?.custom?.location === b?.custom?.location &&
  a?.custom?.seenOn?.date === b?.custom?.seenOn?.date &&
  a?.custom?.seenOn?.precision === b?.custom?.seenOn?.precision;

/**
 * The signed-in list, in Supabase.
 *
 * Bound to one user id at construction rather than looking the session up
 * per call: the provider rebuilds this when the session changes, so a
 * backend instance can never outlive the user it belongs to and write one
 * person's rows under another's name.
 */
export function createSupabaseWatchlistBackend(userId: string): WatchlistBackend {
  /**
   * What the server is believed to hold. `save` diffs against this to find
   * the rows that actually changed, instead of rewriting the whole list on
   * every heart tap. Only advanced after a write fully succeeds, so a failed
   * save leaves the next diff correct rather than silently dropping the rows
   * it thought it had already sent.
   */
  let known: WatchlistState = {};

  return {
    async load() {
      const { data, error } = await supabase
        .from('watchlist')
        .select(SELECTED_COLUMNS);

      // No `.eq('user_id', ...)`: the select policy already restricts this to
      // the caller's own rows, and a filter here would imply the safety comes
      // from the client, which is exactly the wrong thing to believe.
      if (error) throw error;

      const state: Record<string, WatchlistEntry> = {};
      for (const row of (data ?? []) as WatchlistRow[]) {
        state[row.entry_id] = rowToEntry(row);
      }
      known = state;
      return state;
    },

    async save(next) {
      const changed = Object.keys(next).filter((id) => !sameEntry(next[id], known[id]));
      const removed = Object.keys(known).filter((id) => !(id in next));

      if (changed.length > 0) {
        const { error } = await supabase
          .from('watchlist')
          .upsert(changed.map((id) => entryToRow(userId, id, next[id])), {
            onConflict: 'user_id,entry_id',
          });
        if (error) throw error;
      }

      if (removed.length > 0) {
        // `user_id` is redundant under RLS but stated anyway: delete is the
        // one operation where a mistake is unrecoverable, and RLS refuses a
        // foreign row by matching nothing rather than by failing — a silent
        // no-op is a bad last line of defence.
        const { error } = await supabase
          .from('watchlist')
          .delete()
          .eq('user_id', userId)
          .in('entry_id', removed);
        if (error) throw error;
      }

      known = next;
    },
  };
}
