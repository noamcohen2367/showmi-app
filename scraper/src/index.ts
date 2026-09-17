/**
 * Entry point.
 *
 *   npm run scrape:dry -- --theater habima   → writes out/habima.json, touches no database
 *   npm run scrape -- --theater habima       → syncs to Supabase
 *   npm run scrape                            → every registered theater
 *   add --force to write even when the sanity checks object
 *
 * Exits non-zero if any theater fails, so a scheduled GitHub Action goes red
 * (and emails you) instead of failing silently.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';

import { habimaAdapter } from './adapters/habima.js';
import { activeShowCount, createDb, syncTheater } from './db.js';
import { sanityProblems } from './lib/sanity.js';
import type { Adapter } from './types.js';

const ADAPTERS: Adapter[] = [habimaAdapter];

const { values } = parseArgs({
  options: {
    theater: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
    force: { type: 'boolean', default: false },
  },
});

const selected = values.theater ? ADAPTERS.filter((a) => a.theaterId === values.theater) : ADAPTERS;
if (selected.length === 0) {
  console.error(`Unknown theater "${values.theater}". Known: ${ADAPTERS.map((a) => a.theaterId).join(', ')}`);
  process.exit(2);
}

const db = values['dry-run'] ? null : createDb();
let failed = false;

for (const adapter of selected) {
  const id = adapter.theaterId;
  try {
    const started = Date.now();
    const shows = await adapter.scrape();
    const showtimes = shows.reduce((sum, show) => sum + show.showtimes.length, 0);
    console.log(`[${id}] scraped ${shows.length} shows, ${showtimes} upcoming showtimes in ${Math.round((Date.now() - started) / 1000)}s`);

    const previous = db ? await activeShowCount(db, id) : 0;
    const problems = sanityProblems(shows, previous);
    problems.forEach((problem) => console.warn(`[${id}] sanity: ${problem}`));

    if (!db) {
      await mkdir('out', { recursive: true });
      await writeFile(`out/${id}.json`, JSON.stringify(shows, null, 2));
      console.log(`[${id}] dry run → out/${id}.json`);
      if (problems.length) failed = true;
      continue;
    }

    if (problems.length && !values.force) {
      console.error(`[${id}] NOT writing to the database (use --force to override)`);
      failed = true;
      continue;
    }

    const written = await syncTheater(db, id, shows);
    console.log(`[${id}] synced ${written.shows} shows, ${written.showtimes} showtimes`);
  } catch (error) {
    failed = true;
    console.error(`[${id}] failed:`, error);
  }
}

process.exit(failed ? 1 : 0);
