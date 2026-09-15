import { useEffect, useState } from 'react';

import { fetchHomeFeed, type HomeFeed } from '@/data/shows';

export type UseHomeFeedResult =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; feed: HomeFeed };

/**
 * Loads the Home screen's data. Written with a real network call in mind —
 * `loading`/`error`/`ready` states, not just "the array" — even though
 * `fetchHomeFeed` (`src/data/shows.ts`) is local mock data today, so the
 * Home screen itself won't need to change shape when that becomes a real
 * `fetch()`.
 */
export function useHomeFeed(): UseHomeFeedResult {
  const [result, setResult] = useState<UseHomeFeedResult>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    // No need to reset to `{ status: 'loading' }` here — the initial
    // `useState` above already covers it, and this effect only re-runs if
    // its dependencies (none) change anyway.
    fetchHomeFeed()
      .then((feed) => {
        if (!cancelled) setResult({ status: 'ready', feed });
      })
      .catch(() => {
        if (!cancelled) setResult({ status: 'error' });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return result;
}
