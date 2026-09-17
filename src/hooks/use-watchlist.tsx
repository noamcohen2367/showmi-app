import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import {
  createCustomId,
  watchlistBackend,
  type CustomEntry,
  type WatchlistState,
  type WatchStatus,
} from '@/data/watchlist-backend';

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
};

const WatchlistContext = createContext<WatchlistContextValue | null>(null);

/**
 * Holds the watchlist for the whole app.
 *
 * Mounted once in the root layout, above the router outlet, so the list is
 * shared by every screen that reads it (the Home filter bar's chip, the
 * watchlist screen, and later a save button on show cards) rather than each
 * keeping its own copy.
 *
 * All reads/writes go through `watchlistBackend` — see that file for why the
 * storage is deliberately behind a seam, and for the current in-memory
 * limitation.
 */
export function WatchlistProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WatchlistState>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    watchlistBackend.load().then((loaded) => {
      if (cancelled) return;
      setState(loaded);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // One writer for every mutation, so persistence can never be forgotten at
  // a call site: each helper below just describes the next state.
  const commit = useCallback((next: WatchlistState) => {
    setState(next);
    void watchlistBackend.save(next);
  }, []);

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
      wantIds: inSection('want', false),
      seenIds: inSection('seen', false),
      customWant: asItems(inSection('want', true)),
      customSeen: asItems(inSection('seen', true)),
      statusOf: (showId) => state[showId]?.status,
      toggleSaved: (showId) => {
        const next = { ...state };
        if (next[showId]) delete next[showId];
        else next[showId] = { status: 'want' };
        commit(next);
      },
      setStatus: (showId, status) =>
        // Spreads the existing entry so moving a hand-typed show between
        // sections doesn't drop the name the user typed.
        commit({ ...state, [showId]: { ...state[showId], status } }),
      addCustom: (entry, status) => {
        const id = createCustomId();
        commit({ ...state, [id]: { status, custom: entry } });
        return id;
      },
      remove: (showId) => {
        const next = { ...state };
        delete next[showId];
        commit(next);
      },
    };
  }, [state, ready, commit]);

  return <WatchlistContext.Provider value={value}>{children}</WatchlistContext.Provider>;
}

export function useWatchlist(): WatchlistContextValue {
  const context = useContext(WatchlistContext);
  if (!context) {
    throw new Error('useWatchlist must be used inside <WatchlistProvider> (mounted in the root layout).');
  }
  return context;
}
