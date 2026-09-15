import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import {
  watchlistBackend,
  type WatchlistState,
  type WatchStatus,
} from '@/data/watchlist-backend';

export type { WatchStatus };

type WatchlistContextValue = {
  /** `undefined` means the show isn't on the list at all. */
  statusOf: (showId: string) => WatchStatus | undefined;
  /** Adds to the list as "want to see", or removes it if already saved. */
  toggleSaved: (showId: string) => void;
  /** Moves a saved show between the two sections. */
  setStatus: (showId: string, status: WatchStatus) => void;
  remove: (showId: string) => void;
  /** Ids in each section. Stable references while the state doesn't change. */
  wantIds: readonly string[];
  seenIds: readonly string[];
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
    const wantIds = Object.keys(state).filter((id) => state[id] === 'want');
    const seenIds = Object.keys(state).filter((id) => state[id] === 'seen');

    return {
      ready,
      wantIds,
      seenIds,
      statusOf: (showId) => state[showId],
      toggleSaved: (showId) => {
        const next = { ...state };
        if (next[showId]) delete next[showId];
        else next[showId] = 'want';
        commit(next);
      },
      setStatus: (showId, status) => commit({ ...state, [showId]: status }),
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
