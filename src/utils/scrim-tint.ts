/**
 * Darkens an arbitrary color until white text is guaranteed to stay legible
 * on top of it.
 *
 * The featured card's scrim can be tinted with a color sampled from the
 * show's poster, which looks far better than a flat black wash — but a
 * sampled color is, by definition, unknown at build time. A pale poster
 * yields a pale tint, and white text on a pale scrim is unreadable. So the
 * sampled color is treated as a *hue suggestion* only: this module keeps its
 * hue and scales it toward black until the worst realistic composite still
 * clears the contrast target.
 *
 * "Worst realistic composite" is the tint laid over a pure *white* image at
 * the scrim's strongest alpha — the least favourable photo that can load.
 * Clamping against that means the result holds for every darker poster too.
 */

/** Relative luminance, WCAG 2.1. */
function luminance([r, g, b]: readonly [number, number, number]): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Contrast ratio between two colors. */
export function contrastRatio(
  a: readonly [number, number, number],
  b: readonly [number, number, number],
): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

/** `#RRGGBB` → `[r, g, b]`. Returns `undefined` for anything malformed. */
export function parseHex(hex: string): [number, number, number] | undefined {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return undefined;
  const value = match[1];
  return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16)) as [number, number, number];
}

export function toHex([r, g, b]: readonly [number, number, number]): string {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;
}

const WHITE: readonly [number, number, number] = [255, 255, 255];

/** The tint at `alpha`, composited over a pure-white image. */
function compositeOverWhite(
  tint: readonly [number, number, number],
  alpha: number,
): [number, number, number] {
  return tint.map((c) => c * alpha + 255 * (1 - alpha)) as [number, number, number];
}

export type ScrimTintOptions = {
  /** The scrim's strongest alpha — where the text actually sits. */
  alpha: number;
  /** Minimum contrast for white text over the worst-case composite. */
  minContrast: number;
};

/**
 * Scales `tint` toward black until white text clears `minContrast` over it.
 *
 * Scaling all three channels by the same factor is what preserves the hue:
 * it walks the color straight down its own ray toward the origin in RGB
 * space, so the ratios between channels — and therefore the hue — are
 * unchanged, while the brightness falls. Converting to HSL and dropping
 * lightness would shift the perceived hue of saturated colors instead.
 *
 * Returns black if even a very dark version of the color can't reach the
 * target, which cannot normally happen but keeps the return type total.
 */
export function safeScrimTint(
  tint: readonly [number, number, number],
  { alpha, minContrast }: ScrimTintOptions,
): [number, number, number] {
  // 65 steps from the original color down to black. The search is coarse on
  // purpose: a finer one would return imperceptibly different colors at a
  // cost paid on every card render.
  const STEPS = 64;

  for (let step = 0; step <= STEPS; step++) {
    const scale = 1 - step / STEPS;
    // Rounded *before* the check, not after: the returned color is what gets
    // rendered, so it has to be the one that was verified. Checking the
    // unrounded value and rounding the winner lets a color that passed by a
    // hair ship at a ratio fractionally below the target (gold #C79A3B
    // measured 6.99:1 against a 7:1 target that way).
    const scaled = tint.map((c) => Math.round(c * scale)) as [number, number, number];
    if (contrastRatio(WHITE, compositeOverWhite(scaled, alpha)) >= minContrast) {
      return scaled;
    }
  }

  return [0, 0, 0];
}

/**
 * The whole job in one call: a poster's dominant color in, a scrim base
 * color out, or `undefined` if the input wasn't a usable color.
 *
 * `undefined` is the signal for callers to fall back to the theme's plain
 * black scrim, so an unavailable or malformed color degrades to exactly the
 * behaviour the card had before tinting existed.
 */
export function scrimTintFromHex(hex: string | undefined, options: ScrimTintOptions): string | undefined {
  if (!hex) return undefined;
  const parsed = parseHex(hex);
  if (!parsed) return undefined;
  return toHex(safeScrimTint(parsed, options));
}
