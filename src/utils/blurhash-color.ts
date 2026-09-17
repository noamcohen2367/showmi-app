/**
 * Reads the average color of an image straight out of its blurhash.
 *
 * A blurhash is a tiny string that already contains the information we want:
 * its first coefficient — the "DC term" — *is* the image's average color,
 * stored as a plain 24-bit sRGB value. So there is no need to download the
 * image again, decode a JPEG in JavaScript, or add a native color-extraction
 * library: `expo-image` (already a dependency) can produce the blurhash
 * using the decoder it already has, and the four characters below turn it
 * into a color.
 *
 * Format, from the blurhash spec:
 *   char 0    — number of components, packed
 *   char 1    — maximum AC value
 *   chars 2-5 — the DC term: 4 base83 digits = one 24-bit sRGB color
 *   chars 6+  — the AC terms (the actual blur), which we ignore
 */

const BASE83 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz#$%*+,-.:;=?@[]^_{|}~';

/** Decodes a base83 string to an integer, or `undefined` on any bad digit. */
function decodeBase83(value: string): number | undefined {
  let result = 0;
  for (const char of value) {
    const digit = BASE83.indexOf(char);
    if (digit === -1) return undefined;
    result = result * 83 + digit;
  }
  return result;
}

/**
 * `#RRGGBB` for the blurhash's average color, or `undefined` if the string
 * isn't a usable blurhash.
 *
 * Note this is the image's *average*, not its most vibrant color. For a
 * scrim that is the better of the two: the average of a poster is what the
 * poster "feels like" overall, whereas a vibrant pick can latch onto a small
 * saturated detail and tint the whole card after something barely visible in
 * the artwork.
 */
export function averageColorFromBlurhash(blurhash: string | null | undefined): string | undefined {
  // 6 is the minimum that can contain a DC term at all; a real blurhash is
  // always longer, but anything shorter is definitely malformed.
  if (!blurhash || blurhash.length < 6) return undefined;

  const dc = decodeBase83(blurhash.slice(2, 6));
  if (dc === undefined) return undefined;

  // The DC term stores sRGB bytes directly — no linear-light conversion is
  // needed to read them back out.
  const r = dc >> 16;
  const g = (dc >> 8) & 255;
  const b = dc & 255;

  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}
