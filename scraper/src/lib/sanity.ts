/**
 * Guards against the classic scraper failure: the site changes its layout,
 * the parser quietly finds nothing, and the sync "correctly" deletes the
 * whole catalogue. Any of these stops the write for that theater.
 */

import type { ScrapedShow } from '../types.js';

export function sanityProblems(shows: ScrapedShow[], previousActiveShows: number): string[] {
  const problems: string[] = [];
  const showtimes = shows.reduce((sum, show) => sum + show.showtimes.length, 0);

  if (shows.length === 0) problems.push('no shows found');
  if (showtimes === 0) problems.push('no upcoming showtimes found across all shows');

  // Losing more than half the catalogue overnight is far likelier a parsing bug than reality.
  if (previousActiveShows >= 4 && shows.length < previousActiveShows * 0.5) {
    problems.push(`only ${shows.length} shows, down from ${previousActiveShows} active`);
  }

  const nameless = shows.filter((show) => !show.name).length;
  if (nameless > 0) problems.push(`${nameless} shows without a name`);

  const imageless = shows.filter((show) => show.images.length === 0).length;
  if (shows.length > 0 && imageless > shows.length * 0.5) {
    problems.push(`${imageless}/${shows.length} shows without an image`);
  }

  return problems;
}
