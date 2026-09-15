/**
 * Shared math for `<AnimatedGradientBackground>` (see
 * `src/components/animated-gradient-background.tsx` / `.web.tsx`).
 * Framework-agnostic on purpose (no React/reanimated import) so both the
 * native and web implementations read the exact same, already-vetted
 * numbers instead of each hand-rolling their own.
 *
 * Every color below is `theme.primary` (the app's one brand accent)
 * alpha-blended over `theme.background` — never a new hex value. The alpha
 * ranges were chosen, then checked, against WCAG AA (4.5:1) for
 * `textSecondary` (the app's *lowest*-contrast text token) sitting directly
 * on the *peak* of the animation with no card/glass backing underneath it —
 * the worst case that can occur. Ratios found; keep new peaks under these
 * bounds if you tune the ranges further:
 *
 *  - Light, top stop, alpha 0.13 peak → bg ≈ rgb(242,229,224) → 4.82:1
 *  - Dark,  top stop, alpha 0.34 peak → bg ≈ rgb(87,61,44)    → 4.78:1
 *  - Light, mid stop,  alpha 0.06 peak → bg ≈ rgb(249,243,241) → 5.41:1
 *  - Dark,  mid stop,  alpha 0.15 peak → bg ≈ rgb(38,27,19)    → 8.08:1
 *
 * (`theme.text`/`theme.textSecondary` on the *bottom* stop — solid
 * `theme.background` — trivially pass, since that's the same background
 * every screen already renders text on today.)
 *
 * IMPORTANT — these alphas are tuned to the accent's *luminance*, so they do
 * not survive a hue change unedited. When the accent was purple, dark mode
 * ran at a 0.40 top-stop peak; the warm peachy-orange that replaced it is a
 * far more luminous hue, and at that same 0.40 the dark-mode wash lightened
 * to the point that `textSecondary` fell to 3.89:1 — a real AA failure, not
 * a rounding one. The dark ranges below are reduced accordingly (top
 * 0.30→0.26 / 0.40→0.34, mid 0.12→0.10 / 0.18→0.15). Measured headroom for
 * the current accent: light fails above α≈0.165, dark above α≈0.360.
 *
 * To re-derive after changing `Accent` in `theme.ts`: composite
 * `primary` over `background` at each peak alpha, then compute the WCAG 2.1
 * contrast ratio of `textSecondary` against that result.
 */

/** One leg of the ping-pong ambient loop; a full cycle (0→1→0) is 2× this. */
export const LOOP_LEG_DURATION_MS = 10_000; // → ~20s full cycle, within the 15-25s spec.

/** How long the light↔dark gradient crossfade takes when the theme changes. */
export const CROSSFADE_DURATION_MS = 500;

export const LIGHT_TOP_ALPHA: readonly [number, number] = [0.08, 0.13];
export const LIGHT_MID_ALPHA: readonly [number, number] = [0.03, 0.06];
// Lowered from [0.3, 0.4] / [0.12, 0.18] when the accent moved from purple to
// the (much more luminous) peachy-orange — see the AA note in this file's
// doc comment above.
export const DARK_TOP_ALPHA: readonly [number, number] = [0.26, 0.34];
export const DARK_MID_ALPHA: readonly [number, number] = [0.1, 0.15];

/** Gentle drift of where the top→bottom transition sits, for both themes. */
export const MID_LOCATION_RANGE: readonly [number, number] = [0.45, 0.62];

/**
 * Appends an alpha channel to a `#RRGGBB` hex color, producing `#RRGGBBAA`.
 * Both React Native and the web accept 8-digit hex colors, so this needs no
 * color library — just string math on values already in `theme.ts`.
 *
 * Marked `'worklet'`: this is called from inside `useAnimatedProps`/
 * `useAnimatedStyle` worklets in `animated-gradient-background.tsx`/
 * `.web.tsx`. A plain function imported from another file isn't
 * automatically workletized just because it's *called* from a worklet —
 * without this directive, native (not web) throws at the worklet/JSI
 * boundary the moment the animation first runs, before React ever gets a
 * chance to render an error screen (crashes as: splash shows, app closes,
 * no JS error — exactly what happened on-device before this was added).
 */
export function withAlpha(hexColor: string, alpha: number): string {
  'worklet';
  const channel = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hexColor}${channel}`;
}
