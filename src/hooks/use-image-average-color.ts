import { Image } from 'expo-image';
import { useEffect, useState } from 'react';

import { averageColorFromBlurhash } from '@/utils/blurhash-color';

/**
 * Results already computed, keyed by image URL.
 *
 * Module-level rather than per-component: the same poster appears in several
 * rows of the Home feed, and a card is remounted every time the list
 * recycles it. Without this, scrolling back and forth would ask the native
 * side to re-encode the same image over and over.
 *
 * `null` is a cached *failure* — remembered deliberately, so an image that
 * can't produce a hash (web, an unsupported format, a dead URL) is asked
 * about once rather than on every remount.
 */
const cache = new Map<string, string | null>();

/**
 * The average color of a remote image, as `#RRGGBB`, or `undefined` while it
 * is unknown.
 *
 * Uses `expo-image`'s own `generateBlurhashAsync` and reads the color out of
 * the hash's DC term (see `utils/blurhash-color.ts`). That avoids adding a
 * native color-extraction library: the image is decoded once, natively, by
 * the library already doing the decoding for the `<Image>` on screen.
 *
 * Asks for `[1, 1]` components — the smallest legal blurhash, which is
 * nothing *but* the average color. Larger values would spend time encoding
 * blur detail this hook then throws away.
 *
 * iOS and Android only: `generateBlurhashAsync` is a no-op on web (see its
 * `@platform` tags). On web this stays `undefined`, and callers fall back to
 * whatever they use when no color is available.
 */
export function useImageAverageColor(imageUrl: string | undefined): string | undefined {
  const [resolved, setResolved] = useState<string | null | undefined>(undefined);

  // Reset when the card is recycled onto a different show. Setting state
  // during render (rather than in an effect) is the supported way to do
  // this: React re-runs this render immediately instead of committing one
  // frame that still shows the previous image's color.
  const [lastUrl, setLastUrl] = useState(imageUrl);
  if (imageUrl !== lastUrl) {
    setLastUrl(imageUrl);
    setResolved(undefined);
  }

  // Read straight through on a cache hit. A remounted card whose color is
  // already known renders with it on its very first frame, and never
  // schedules a state update at all.
  const cached = imageUrl ? cache.get(imageUrl) : undefined;

  useEffect(() => {
    // `has`, not `get`: a cached failure is stored as `null`, which must
    // count as "already asked" rather than "unknown".
    if (!imageUrl || cache.has(imageUrl)) return;

    let cancelled = false;

    Image.generateBlurhashAsync(imageUrl, [1, 1])
      .then((blurhash) => {
        const result = averageColorFromBlurhash(blurhash) ?? null;
        cache.set(imageUrl, result);
        if (!cancelled) setResolved(result);
      })
      .catch(() => {
        // Web's stub, an unreachable URL, an unsupported format — all end up
        // here, and all mean the same thing to the caller: no color. Cached
        // so the failure isn't retried on every remount.
        cache.set(imageUrl, null);
        if (!cancelled) setResolved(null);
      });

    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  return (cached !== undefined ? cached : resolved) ?? undefined;
}
