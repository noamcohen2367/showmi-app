/**
 * Writes one theater's scrape result to Supabase, as a full replacement of
 * what that theater had: upsert everything seen now, then retire whatever
 * wasn't seen in this run.
 *
 * "Retire" differs by table on purpose:
 *  - showtimes that vanished are deleted (cancelled, sold out, or past —
 *    none of them are bookable, and the app has no use for them);
 *  - shows that vanished are only marked inactive, because a user may have
 *    them on their watchlist, which references `shows.id`.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { ScrapedShow, TheaterId } from './types.js';

export function createDb(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required (or run with --dry-run)');
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function activeShowCount(db: SupabaseClient, theaterId: TheaterId): Promise<number> {
  const { count, error } = await db
    .from('shows')
    .select('id', { count: 'exact', head: true })
    .eq('theater_id', theaterId)
    .eq('is_active', true);
  if (error) throw error;
  return count ?? 0;
}

const CHUNK = 500;
function chunks<T>(items: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += CHUNK) out.push(items.slice(i, i + CHUNK));
  return out;
}

export async function syncTheater(db: SupabaseClient, theaterId: TheaterId, shows: ScrapedShow[]) {
  const runAt = new Date().toISOString();

  const showRows = shows.map((show) => ({
    id: show.id,
    theater_id: theaterId,
    source_url: show.sourceUrl,
    name: show.name,
    synopsis: show.synopsis,
    images: show.images,
    genre_label: show.genreLabel ?? null,
    categories: show.categories,
    performers: show.performers,
    credits: show.credits,
    is_active: true,
    last_seen_at: runAt,
  }));
  for (const batch of chunks(showRows)) {
    const { error } = await db.from('shows').upsert(batch, { onConflict: 'id' });
    if (error) throw error;
  }

  const showtimeRows = shows.flatMap((show) =>
    show.showtimes.map((showtime) => ({
      id: showtime.id,
      show_id: show.id,
      theater_id: theaterId,
      starts_at: showtime.startsAt,
      purchase_url: showtime.purchaseUrl,
      hall: showtime.hall ?? null,
      subtitles: showtime.subtitles ?? null,
      last_seen_at: runAt,
    })),
  );
  for (const batch of chunks(showtimeRows)) {
    const { error } = await db.from('showtimes').upsert(batch, { onConflict: 'id' });
    if (error) throw error;
  }

  const { error: deleteError } = await db
    .from('showtimes')
    .delete()
    .eq('theater_id', theaterId)
    .lt('last_seen_at', runAt);
  if (deleteError) throw deleteError;

  const { error: retireError } = await db
    .from('shows')
    .update({ is_active: false })
    .eq('theater_id', theaterId)
    .eq('is_active', true)
    .lt('last_seen_at', runAt);
  if (retireError) throw retireError;

  return { shows: showRows.length, showtimes: showtimeRows.length };
}
