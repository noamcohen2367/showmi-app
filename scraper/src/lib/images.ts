/**
 * Copies show posters into our own Supabase Storage bucket, and works out
 * each show's dominant colour on the way past.
 *
 * Why re-host rather than link straight to the theaters' URLs:
 *
 *  - Lessin's CDN returns 403 to any request without a `Referer`. That is
 *    hotlink protection, and the app is exactly the third party it exists to
 *    stop. Sending a referer from a user's phone — where the user is not on
 *    lessin.co.il — would be a forged one. Fetching the image here, from the
 *    show page we genuinely scraped it from, is not.
 *  - A few images are served over plain `http://`, which iOS blocks outright.
 *  - Serving from our own bucket means the theaters' servers see one batch
 *    job twice a day instead of every app user.
 *
 * Nothing here is allowed to fail a run: an image that cannot be fetched is
 * skipped and the show keeps whatever else succeeded. `lib/sanity.ts`'s
 * existing ">half the shows have no images" guard is what catches a systemic
 * breakage.
 */

import { createHash } from 'node:crypto';

import type { SupabaseClient } from '@supabase/supabase-js';
import sharp from 'sharp';

import { fetchBinary } from './http.js';
import type { ScrapedShow } from '../types.js';

export const POSTER_BUCKET = 'posters';

const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
};

/**
 * A stable object key for a source image URL.
 *
 * Hashed rather than derived from the show id or the original filename:
 * show ids contain raw Hebrew and the filenames are percent-encoded Hebrew
 * too, neither of which makes a safe or stable storage key. The same source
 * URL always maps to the same object, which is what lets a repeat run skip
 * work it already did.
 */
export function objectKeyFor(theaterId: string, sourceUrl: string, contentType: string): string {
  const digest = createHash('sha256').update(sourceUrl).digest('hex').slice(0, 32);
  const extension = EXTENSIONS[contentType] ?? 'bin';
  return `${theaterId}/${digest}.${extension}`;
}

/** `#RRGGBB` for an image's average colour, or undefined if it can't be read. */
export async function averageColor(body: Buffer): Promise<string | undefined> {
  try {
    // Resizing to a single pixel *is* the average — one call, no pixel loop,
    // and sharp does it in native code. Average rather than "most vibrant" on
    // purpose: a vibrant pick latches onto a small saturated detail and tints
    // a whole card after something barely visible in the artwork.
    const { data } = await sharp(body).resize(1, 1, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    // Three channels after `removeAlpha`, but the buffer is untyped as far as
    // the compiler is concerned — check rather than assert, since a decoder
    // that returned something unexpected should degrade, not throw.
    if (data.length < 3) return undefined;
    return `#${Array.from(data.subarray(0, 3), (c) => c.toString(16).padStart(2, '0')).join('')}`;
  } catch {
    // An SVG, a truncated download, a format sharp won't decode — none of
    // which should cost the show its poster.
    return undefined;
  }
}

/**
 * Creates the poster bucket if it isn't there yet.
 *
 * Public, because the app reads posters with the publishable key and no user
 * session — the same "catalogue is public" stance the RLS policies take for
 * the tables. Nothing user-owned is ever stored here.
 *
 * Idempotent: an existing bucket is left exactly as it is, including its
 * visibility, so this never quietly re-opens a bucket someone deliberately
 * made private.
 */
export async function ensurePosterBucket(db: SupabaseClient): Promise<void> {
  const { data } = await db.storage.getBucket(POSTER_BUCKET);
  if (data) return;

  const { error } = await db.storage.createBucket(POSTER_BUCKET, { public: true });
  // A parallel run can win the race between the check and the create; that
  // is success, not failure.
  if (error && !/already exists/i.test(error.message)) throw error;
  console.log(`storage: created public bucket "${POSTER_BUCKET}"`);
}

export type RehostCounts = { copied: number; reused: number; lost: number };

/**
 * Re-hosts every show in a run, rewriting each one's `images` in place so
 * `syncTheater` writes our URLs rather than the theater's.
 *
 * Mutating rather than returning new shows keeps this a single step in
 * `index.ts` between the sanity gate and the write, with nothing else in the
 * pipeline needing to know it happened.
 */
export async function rehostAll(
  db: SupabaseClient,
  theaterId: string,
  shows: ScrapedShow[],
): Promise<RehostCounts> {
  const totals: RehostCounts = { copied: 0, reused: 0, lost: 0 };

  // What the database already knows. Load it up front, because a colour is
  // only computed on the run that first *copies* an image — and from the
  // second run onward every image is already stored, so nothing would be
  // computed and `db.ts`'s `dominantColor ?? null` would wipe every colour
  // the first run worked out. Carrying the stored value forward is what
  // makes a repeat run idempotent instead of destructive.
  const stored = await storedDominantColors(db, theaterId);

  for (const show of shows) {
    const result = await rehostShowImages(db, theaterId, show);
    totals.copied += result.counts.copied;
    totals.reused += result.counts.reused;
    totals.lost += result.counts.lost;

    // Only overwrite when something survived. A show whose every image
    // failed keeps the theater's URLs, which at worst behaves exactly as it
    // did before this existed rather than losing the poster entirely.
    if (result.images.length > 0) show.images = result.images;

    const colour = result.dominantColor ?? stored.get(show.id);
    if (colour) {
      show.dominantColor = colour;
      continue;
    }

    // No fresh colour and none on record — which happens when a show's hero
    // image was deduplicated against one another show had already uploaded,
    // so this run never held its bytes. Read it back from our own bucket.
    // Only ever runs while a show still has no colour, so it costs nothing
    // on the steady-state twice-daily run.
    const hero = show.images[0];
    if (hero?.includes('/storage/v1/object/public/')) {
      try {
        const { body } = await fetchBinary(hero);
        const computed = await averageColor(body);
        if (computed) show.dominantColor = computed;
      } catch {
        // Leave it unset; the app derives a tint on device in that case.
      }
    }
  }

  return totals;
}

/** `showId → '#RRGGBB'` for the colours already recorded for this theater. */
async function storedDominantColors(
  db: SupabaseClient,
  theaterId: string,
): Promise<Map<string, string>> {
  const { data, error } = await db
    .from('shows')
    .select('id,dominant_color')
    .eq('theater_id', theaterId)
    .not('dominant_color', 'is', null);
  if (error) throw error;
  return new Map((data ?? []).map((row) => [row.id as string, row.dominant_color as string]));
}

type RehostResult = { images: string[]; dominantColor?: string; counts: RehostCounts };

/**
 * Mirrors one show's images into the bucket, returning our URLs.
 *
 * Images already in the bucket are neither re-downloaded nor re-uploaded.
 * Without that, a twice-daily run would pull every poster from all three
 * theaters forever, which is the opposite of what `lib/http.ts` exists to
 * guarantee.
 */
export async function rehostShowImages(
  db: SupabaseClient,
  theaterId: string,
  show: ScrapedShow,
): Promise<RehostResult> {
  const storage = db.storage.from(POSTER_BUCKET);
  const images: string[] = [];
  const counts: RehostCounts = { copied: 0, reused: 0, lost: 0 };
  let dominantColor: string | undefined;

  for (const sourceUrl of show.images) {
    try {
      // The extension depends on the content type, which we only know after
      // fetching — so probe for an already-stored object under any known
      // extension before spending a request.
      const existing = await findExisting(storage, theaterId, sourceUrl);
      if (existing) {
        images.push(publicUrl(storage, existing));
        counts.reused++;
        continue;
      }

      const { body, contentType } = await fetchBinary(sourceUrl, { referer: show.sourceUrl });
      if (!contentType.startsWith('image/')) throw new Error(`not an image (${contentType})`);

      const key = objectKeyFor(theaterId, sourceUrl, contentType);
      const { error } = await storage.upload(key, body, { contentType, upsert: true });
      if (error) throw error;

      images.push(publicUrl(storage, key));
      counts.copied++;
      // Only the hero image decides the tint, matching what the app reads.
      if (!dominantColor && images.length === 1) dominantColor = await averageColor(body);
    } catch (error) {
      counts.lost++;
      console.warn(`[${theaterId}] image skipped (${sourceUrl}):`, (error as Error).message);
    }
  }

  return { images, counts, ...(dominantColor ? { dominantColor } : {}) };
}

function publicUrl(storage: ReturnType<SupabaseClient['storage']['from']>, key: string): string {
  return storage.getPublicUrl(key).data.publicUrl;
}

/** The stored object for this source URL, whichever extension it landed under. */
async function findExisting(
  storage: ReturnType<SupabaseClient['storage']['from']>,
  theaterId: string,
  sourceUrl: string,
): Promise<string | undefined> {
  const digest = createHash('sha256').update(sourceUrl).digest('hex').slice(0, 32);
  const { data } = await storage.list(theaterId, { search: digest, limit: 1 });
  return data?.[0] ? `${theaterId}/${data[0].name}` : undefined;
}
