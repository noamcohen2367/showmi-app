/**
 * The Search screen's "חיפושים אחרונים" list.
 *
 * Module-level rather than component state, so the list survives switching
 * tabs and coming back — which is the only thing that makes it useful at all.
 *
 * It does NOT survive closing the app. Same limitation and same reason as
 * `watchlist-backend.ts`: there is no storage dependency in this project yet,
 * and Supabase is coming. This module is the single seam to replace when it
 * arrives — nothing above it knows where the list lives.
 */

/** How many queries are kept. Older ones fall off the end. */
const MAX_RECENT = 6;

let recent: readonly string[] = [];

type Listener = () => void;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function getRecentSearches(): readonly string[] {
  return recent;
}

/**
 * Records a query, most recent first.
 *
 * Re-searching something already in the list moves it to the top rather than
 * adding a duplicate — a recents list with the same term three times is worse
 * than useless, it's actively in the way.
 */
export function recordSearch(rawQuery: string) {
  const query = rawQuery.trim();
  if (!query) return;

  const withoutDuplicate = recent.filter((existing) => existing !== query);
  const next = [query, ...withoutDuplicate].slice(0, MAX_RECENT);

  // Bail before notifying if nothing actually moved, so typing the same
  // query twice in a row doesn't re-render every subscriber for no reason.
  if (next.length === recent.length && next.every((value, i) => value === recent[i])) return;

  recent = next;
  emit();
}

export function clearRecentSearches() {
  if (recent.length === 0) return;
  recent = [];
  emit();
}

/** Subscribes to changes; returns the unsubscribe function. */
export function subscribeToRecentSearches(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
