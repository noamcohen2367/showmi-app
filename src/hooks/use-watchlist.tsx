import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Alert } from 'react-native';

import {
  createCustomId,
  createSupabaseWatchlistBackend,
  inMemoryWatchlistBackend,
  type CustomEntry,
  type WatchlistState,
  type WatchStatus,
} from '@/data/watchlist-backend';
import { useAuth } from '@/hooks/use-auth';

export type { CustomEntry, WatchStatus };

/** One hand-typed entry, paired with the id it lives under. */
export type CustomWatchlistItem = CustomEntry & { id: string };

type WatchlistContextValue = {
  /** `undefined` means the show isn't on the list at all. */
  statusOf: (showId: string) => WatchStatus | undefined;
  /** Adds to the list as "want to see", or removes it if already saved. */
  toggleSaved: (showId: string) => void;
  /** Moves a saved show between the two sections. */
  setStatus: (showId: string, status: WatchStatus) => void;
  /**
   * Moves several shows at once.
   *
   * Not sugar for calling `setStatus` in a loop: that would be one network
   * write per show, and each would have to be rolled back separately if the
   * next one failed. This is a single change and a single write.
   */
  setStatusMany: (showIds: readonly string[], status: WatchStatus) => void;
  /**
   * Records a show that isn't in the catalogue. Returns the id it was filed
   * under, so a caller can act on it straight away.
   */
  addCustom: (entry: CustomEntry, status: WatchStatus) => string;
  remove: (showId: string) => void;
  /** Catalogue-show ids in each section. */
  wantIds: readonly string[];
  seenIds: readonly string[];
  /** Hand-typed entries in each section. */
  customWant: readonly CustomWatchlistItem[];
  customSeen: readonly CustomWatchlistItem[];
  /** False until the backend's first `load()` resolves. */
  ready: boolean;
  /**
   * True when the list could not be fetched.
   *
   * Separate from an empty list on purpose: over a network those are
   * completely different situations, and rendering "you have not saved
   * anything yet" to somebody whose list simply failed to load is a lie the
   * in-memory version could never tell.
   */
  loadFailed: boolean;
};

const WatchlistContext = createContext<WatchlistContextValue | null>(null);

/** Shared so that "no list yet" is a stable reference and not a new object per render. */
const EMPTY: WatchlistState = {};

/**
 * The list and how it got here, as one value.
 *
 * Deliberately not three booleans beside the data: "loading", "failed" and
 * "the entries" have to agree with each other, and the only way to guarantee
 * that is to make them impossible to set separately.
 */
type Loaded =
  | { phase: 'loading' }
  | { phase: 'ready'; entries: WatchlistState }
  | { phase: 'failed' };

/**
 * Holds the watchlist for the whole app.
 *
 * Mounted once in the root layout, above the router outlet, so the list is
 * shared by every screen that reads it — the Home save buttons and the
 * watchlist screen — rather than each keeping its own copy.
 *
 * Which store it talks to depends on the session; see `watchlist-backend.ts`.
 */
export function WatchlistProvider({ children }: { children: ReactNode }) {
  const { user, ready: authReady } = useAuth();
  const [loaded, setLoaded] = useState<Loaded>({ phase: 'loading' });

  const state = loaded.phase === 'ready' ? loaded.entries : EMPTY;
  const ready = loaded.phase !== 'loading';
  const loadFailed = loaded.phase === 'failed';

  /**
   * The same entries as `state`, readable synchronously.
   *
   * React state is a snapshot of the render that read it, which is the wrong
   * thing for a mutation to build on: two changes in one tick would both
   * start from the same snapshot and the second would discard the first.
   * Every mutation goes through `commit`, which reads and writes this.
   */
  const entriesRef = useRef<WatchlistState>(EMPTY);

  // `user.id`, not `user`: `onAuthStateChange` hands back a fresh user object
  // on every token refresh, so depending on the object itself would rebuild
  // the backend and refetch the whole list roughly once an hour, forever.
  const userId = user?.id ?? null;

  const backend = useMemo(
    () => (userId ? createSupabaseWatchlistBackend(userId) : inMemoryWatchlistBackend),
    [userId],
  );

  useEffect(() => {
    // Waiting on `authReady` is what stops a returning user being shown an
    // empty list for a few frames and then having it replaced.
    if (!authReady) return;

    let cancelled = false;

    (async () => {
      setLoaded({ phase: 'loading' });
      try {
        // Anything saved before signing in belongs to the person who saved
        // it, so it is carried up rather than discarded. Read before the
        // remote load so a failure there aborts before anything is cleared.
        const pending = userId ? await inMemoryWatchlistBackend.load() : {};
        const remote = await backend.load();

        let merged = remote;
        if (Object.keys(pending).length > 0) {
          // Local wins a collision: it is the more recent deliberate act,
          // and the alternative is silently undoing what someone just did.
          merged = { ...remote, ...pending };
          await backend.save(merged);
          // Emptied only once the upload succeeded, so a failed merge can be
          // retried on the next sign-in instead of losing the entries.
          await inMemoryWatchlistBackend.save({});
        }

        if (cancelled) return;
        entriesRef.current = merged;
        setLoaded({ phase: 'ready', entries: merged });
      } catch {
        if (cancelled) return;
        entriesRef.current = EMPTY;
        setLoaded({ phase: 'failed' });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authReady, userId, backend]);

  /**
   * One writer for every mutation, so persistence can never be forgotten at
   * a call site: each helper below just describes the next state.
   *
   * The update is optimistic and then **undone if the write fails**. That
   * matters far more against a network than it did in memory, where `save`
   * could not fail: without the rollback the UI would show a show as saved
   * that no server has ever heard of, and the user would only find out on
   * their next device.
   *
   * Takes a function of the *current* list rather than a ready-made next
   * state, and reads that current list from a ref rather than from render
   * state. That is what makes several mutations fired in the same tick
   * compose instead of overwriting each other — marking three shows seen
   * from the add sheet used to keep only one of them, because all three
   * built their result from the same render-time snapshot.
   */
  const commit = useCallback(
    async (change: (current: WatchlistState) => WatchlistState) => {
      const previous = entriesRef.current;
      const next = change(previous);
      entriesRef.current = next;
      setLoaded({ phase: 'ready', entries: next });
      try {
        await backend.save(next);
      } catch {
        entriesRef.current = previous;
        setLoaded({ phase: 'ready', entries: previous });
        Alert.alert('השינוי לא נשמר', 'בדוק את החיבור ונסה שוב.');
      }
    },
    [backend],
  );

  const value = useMemo<WatchlistContextValue>(() => {
    const ids = Object.keys(state);
    const inSection = (status: WatchStatus, custom: boolean) =>
      ids.filter((id) => state[id].status === status && !!state[id].custom === custom);

    const asItems = (matched: string[]): CustomWatchlistItem[] =>
      // The `custom` field is guaranteed present here — `inSection` selected
      // on exactly that — but the compiler can't see through the filter.
      matched.map((id) => ({ id, ...(state[id].custom as CustomEntry) }));

    return {
      ready,
      loadFailed,
      wantIds: inSection('want', false),
      seenIds: inSection('seen', false),
      customWant: asItems(inSection('want', true)),
      customSeen: asItems(inSection('seen', true)),
      statusOf: (showId) => state[showId]?.status,
      toggleSaved: (showId) =>
        void commit((current) => {
          const next = { ...current };
          if (next[showId]) delete next[showId];
          else next[showId] = { status: 'want' };
          return next;
        }),
      setStatus: (showId, status) =>
        void commit((current) => ({
          ...current,
          // Spreads the existing entry so moving a hand-typed show between
          // sections doesn't drop the name the user typed.
          [showId]: { ...current[showId], status },
        })),
      setStatusMany: (showIds, status) =>
        void commit((current) => {
          const next = { ...current };
          for (const showId of showIds) next[showId] = { ...next[showId], status };
          return next;
        }),
      addCustom: (entry, status) => {
        const id = createCustomId();
        void commit((current) => ({ ...current, [id]: { status, custom: entry } }));
        return id;
      },
      remove: (showId) =>
        void commit((current) => {
          const next = { ...current };
          delete next[showId];
          return next;
        }),
    };
  }, [state, ready, loadFailed, commit]);

  return <WatchlistContext.Provider value={value}>{children}</WatchlistContext.Provider>;
}

export function useWatchlist(): WatchlistContextValue {
  const context = useContext(WatchlistContext);
  if (!context) {
    throw new Error('useWatchlist must be used inside <WatchlistProvider> (mounted in the root layout).');
  }
  return context;
}
