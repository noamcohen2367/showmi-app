/**
 * Domain types for a show/performance, as aggregated from external sources.
 *
 * These are the shapes the eventual real API is expected to return — kept
 * in their own file, independent of any mock data or UI code, so swapping
 * `src/data/shows.ts`'s local mock implementation for a real network client
 * later should mean touching this file rarely, if ever.
 */

export type Theater = {
  id: string;
  name: string;
  city: string;
};

export type Actor = {
  id: string;
  name: string;
  /** Headshot URL. Optional — not every source provides one. */
  photoUrl?: string;
};

/**
 * One specific, bookable occurrence of a show — a single date *and* time.
 * `purchaseUrl` is per-showtime (not per-show), since that's what actually
 * varies: the same show at two different times can have two different
 * ticketing-site listings/prices.
 */
export type Showtime = {
  id: string;
  /** ISO 8601 date-time (local to the theater), e.g. "2026-10-14T20:00:00". */
  startsAt: string;
  /** Official ticketing-site link for this exact date + time. */
  purchaseUrl: string;
};

export type Show = {
  id: string;
  name: string;
  theater: Theater;
  synopsis: string;
  actors: Actor[];
  /** Poster/production photos, at least one. First image is the "hero" one. */
  images: string[];
  /**
   * Dominant color of `images[0]`, as `#RRGGBB` — used to tint the featured
   * card's scrim so the card picks up the poster's own palette.
   *
   * Optional, and safe to omit: a card with no color (or a malformed one)
   * falls back to the plain black scrim. Never used raw — see
   * `utils/scrim-tint.ts`, which darkens it until white text over it is
   * guaranteed legible, because a sampled color can be arbitrarily pale.
   */
  dominantColor?: string;
  /** e.g. "קומדיה", "מחזמר" — also what the Home screen's category filter groups by. */
  categories: string[];
  /** Sorted ascending; a show past all its dates just has an empty array. */
  showtimes: Showtime[];
};
