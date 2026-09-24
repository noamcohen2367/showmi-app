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
 * the worst case that can occur.
 *
 * IMPORTANT — these alphas are tuned to the accent's *luminance*, so they do
 * not survive a hue change unedited, and the project has already been bitten
 * by that twice. The headroom for each accent, measured:
 *
 *   peachy-orange  light α≈0.165   dark α≈0.360
 *   purple (now)   light α≈0.155   dark α≈0.440
 *
 * Dark mode has far more room under a purple accent than under an orange
 * one — purple is the much less luminous hue, so the same alpha darkens the
 * wash instead of lightening it — which is why the dark ranges below return
 * to the values they held the last time the accent was purple. Light mode
 * has slightly *less* room and keeps its current, already-safe peaks.
 *
 * The four peaks actually shipped below, measured against the purple accent:
 *
 *   Light, top, α 0.13 → bg rgb(233,227,242) → 4.73:1
 *   Light, mid, α 0.06 → bg rgb(245,242,249) → 5.36:1
 *   Dark,  top, α 0.40 → bg rgb( 77, 53,101) → 5.01:1
 *   Dark,  mid, α 0.18 → bg rgb( 35, 24, 45) → 8.13:1
 *
 * (`theme.text`/`theme.textSecondary` on the *bottom* stop — solid
 * `theme.background` — trivially pass, since that's the same background
 * every screen already renders text on today.)
 *
 * To re-derive after changing `Accent` in `theme.ts`: composite `primary`
 * over `background` at each peak alpha, then compute the WCAG 2.1 contrast
 * ratio of `textSecondary` against that result.
 */

/** One leg of the ping-pong ambient loop; a full cycle (0→1→0) is 2× this. */
export const LOOP_LEG_DURATION_MS = 10_000; // → ~20s full cycle, within the 15-25s spec.

/** How long the light↔dark gradient crossfade takes when the theme changes. */
export const CROSSFADE_DURATION_MS = 500;

export const LIGHT_TOP_ALPHA: readonly [number, number] = [0.08, 0.13];
export const LIGHT_MID_ALPHA: readonly [number, number] = [0.03, 0.06];
// Back to the pre-orange values now that the accent is purple again: the
// 0.40 peak measures well inside the α≈0.440 ceiling derived above, where
// under the orange accent it had fallen to 3.89:1.
export const DARK_TOP_ALPHA: readonly [number, number] = [0.3, 0.4];
export const DARK_MID_ALPHA: readonly [number, number] = [0.12, 0.18];

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
