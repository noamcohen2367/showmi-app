import { useSyncExternalStore } from 'react';

import {
  clearRecentSearches,
  getRecentSearches,
  recordSearch,
  subscribeToRecentSearches,
} from '@/data/recent-searches';

/**
 * Subscribes to the recent-searches list.
 *
 * `useSyncExternalStore` rather than `useState` + an effect: the list lives
 * outside React (see `data/recent-searches.ts`), and this is the hook built
 * for exactly that — it subscribes, re-renders on change, and reads the value
 * during render, so there is no window where the component shows a stale list.
 * It also avoids the `setState`-inside-an-effect pattern the project's lint
 * rules reject.
 *
 * `getRecentSearches` returns the same frozen array reference until something
 * actually changes, which is what stops this from re-rendering on every pass.
 */
export function useRecentSearches() {
  const recent = useSyncExternalStore(subscribeToRecentSearches, getRecentSearches, getRecentSearches);
  return { recent, record: recordSearch, clear: clearRecentSearches };
}
