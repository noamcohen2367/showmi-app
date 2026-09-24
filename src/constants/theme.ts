/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

/* ─────────────────────────────────────────────────────────────────────────
 * BRAND ACCENT — the app's one accent color. Edit only this block to
 * re-tint the entire app; nothing outside this file hardcodes the accent.
 *
 * Two shades, not one, for the same reason the previous purple had two: a
 * single hex cannot clear 4.5:1 against both a white and a near-black
 * background. `Accent.onLight` is the deep shade used on light backgrounds,
 * `Accent.onDark` the soft peach used on dark ones. Both are shades of the
 * same warm peachy-orange ramp.
 *
 * The alphas are the "soft wash" strength for the selected-pill background
 * (`primarySoft`). Kept here beside the hexes so the wash can never drift
 * out of sync with the accent it is a wash *of* — `withAlpha` below derives
 * it rather than restating the channels by hand, which is how the old
 * `rgba(109, 40, 217, 0.14)` could (and did) have to be hand-edited in
 * lockstep with the hex above it.
 *
 * If you change these hexes, re-run the contrast derivation documented in
 * `src/constants/gradient-palette.ts` — the ambient gradient's alpha ranges
 * are tuned to this specific hue's luminance and are not hue-agnostic.
 * ───────────────────────────────────────────────────────────────────────── */
const Accent = {
  onLight: '#9A3412',
  onDark: '#FFB380',
  softAlphaOnLight: 0.14,
  softAlphaOnDark: 0.2,
} as const;

/* ─────────────────────────────────────────────────────────────────────────
 * ON-PHOTO COLORS — text and scrim that sit on top of an image rather than
 * on the app's own background.
 *
 * Identical in light and dark on purpose, and that is not an oversight:
 * legibility here is decided by the photo's pixels, which no theme controls.
 * A card overlay has to stay readable over a poster that might be almost
 * white or almost black, so it commits to white text over a dark scrim in
 * both themes instead of inverting with the UI around it.
 *
 * The scrim is what makes that safe rather than hopeful. Measured worst
 * case — white text over the scrim at its strongest, composited over a pure
 * *white* photo, which is the least favourable image that can load:
 *
 *   alpha 0.85 → bg rgb(38,38,38) → 15.13:1
 *
 * Over any darker photo the ratio only rises, so the overlay clears AA by a
 * wide margin whatever image the API returns. Weakening the scrim below
 * ~0.55 (4.74:1) would put that guarantee at risk.
 * ───────────────────────────────────────────────────────────────────────── */
const OnPhoto = {
  text: '#FFFFFF',
  /** Base color of the overlay gradient; alpha is applied where it's used. */
  scrim: '#000000',
} as const;

/* ─────────────────────────────────────────────────────────────────────────
 * SEEN BADGE — the green chip on a show the user has already watched.
 *
 * One value for both themes, which is the exception the reasoning earns: the
 * chip sits on show artwork, so what is behind it is whatever poster the API
 * returned, not any surface the theme controls. It therefore has to carry its
 * own contrast, and does — the glyph is `OnPhoto.text` white on this green,
 * measured at 5.02:1, past the 3:1 WCAG asks of non-text graphics and past
 * the 4.5:1 text minimum too.
 *
 * Lightening it is the thing to avoid, and by more than it looks. White on
 * `#16A34A` — the obvious next step up — is 3.30:1, which fails text
 * outright and leaves nothing spare for graphics; on `#22C55E` it is 2.28:1
 * and fails both.
 * ───────────────────────────────────────────────────────────────────────── */
const Seen = '#15803D';

/* ─────────────────────────────────────────────────────────────────────────
 * CATEGORY TINTS — the gradients behind the Search screen's category cards.
 *
 * These are the one place the app uses colours that are NOT the brand accent,
 * and that is a deliberate exception, not drift. Their job is to make six
 * cards in a grid tellable apart at a glance; six shades of one accent would
 * read as six copies of the same card. They are identity colours for content,
 * never UI state — nothing selected, active, or interactive is ever tinted
 * with one.
 *
 * Deliberately no purple in the set.
 *
 * Every pair is dark enough for white label text: the lightest stop of the
 * lightest pair still clears 4.5:1 against `OnPhoto.text`. If you add a pair,
 * check it the same way before shipping it.
 *
 * Identical in light and dark for the same reason `OnPhoto` is — the label
 * sits on the gradient, not on the app's background.
 * ───────────────────────────────────────────────────────────────────────── */
export const CategoryTints: readonly (readonly [string, string])[] = [
  ['#9A3412', '#C2410C'], // terracotta — the accent's own family
  ['#115E59', '#0F766E'], // teal
  ['#1E3A8A', '#1D4ED8'], // deep blue
  ['#9F1239', '#BE123C'], // crimson
  ['#854D0E', '#A16207'], // amber
  ['#3F6212', '#4D7C0F'], // olive
] as const;

/**
 * Picks a tint for a category name, stably.
 *
 * Hashed from the name rather than taken by array index, so a category keeps
 * its colour when the API returns the list in a different order or adds one
 * in the middle — otherwise every card on the screen would change colour
 * whenever the catalogue changed.
 */
export function categoryTint(name: string): readonly [string, string] {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return CategoryTints[hash % CategoryTints.length];
}

/**
 * `#RRGGBB` + alpha → `rgba(r, g, b, a)`. Used only to derive `primarySoft`
 * from the accent above, so the two can't fall out of sync.
 *
 * Note this is a *different* operation from `withAlpha` in
 * `gradient-palette.ts`, which appends a hex `AA` suffix for the gradient
 * worklets; this one emits the `rgba()` string React Native style props use.
 */
function softWash(hexColor: string, alpha: number): string {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hexColor.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
    // Brand accent used as the active/selected tint for navigation everywhere
    // (native tab bars, the web bottom bar, and the web sidebar rail).
    primary: Accent.onLight,
    onImage: OnPhoto.text,
    scrim: OnPhoto.scrim,
    // A translucent wash of `primary`, used behind the active item on the
    // Android native tab bar and the web nav (sidebar/bottom bar) so the
    // selected tab gets a soft "pill" background instead of just a tint.
    primarySoft: softWash(Accent.onLight, Accent.softAlphaOnLight),
    /** Fill of the "already seen" chip; see the `Seen` block above. */
    seen: Seen,
    // Hyperlink text. Deliberately *not* the brand accent: a link that is
    // the same color as every selected-state tint stops reading as a link.
    // It lives here rather than inline in `ThemedText` (where it used to be
    // hardcoded as `#3c87f7`) so this file stays the only place colors live.
    //
    // KNOWN AA FAILURE, carried over as-is: this blue measures 3.50:1 on
    // `background`, under the 4.5:1 body-text minimum. It is the exact value
    // that was already hardcoded in `ThemedText`, kept byte-identical here so
    // moving it into the theme changed no pixels. It is currently unrendered
    // — `type="linkPrimary"` is used by no screen (only the uncolored
    // `type="link"` is, in `profile.tsx`) — so this is latent, not live.
    // `#1D4ED8` (5.57:1) is the drop-in fix whenever that type gets used.
    link: '#3C87F7',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
    // Lighter than the light theme's `primary` so the same brand accent
    // keeps enough contrast against a near-black background.
    primary: Accent.onDark,
    primarySoft: softWash(Accent.onDark, Accent.softAlphaOnDark),
    /** Fill of the "already seen" chip; see the `Seen` block above. */
    seen: Seen,
    onImage: OnPhoto.text,
    scrim: OnPhoto.scrim,
    // Brightened from the light theme's link blue for the same reason
    // `primary` is — `#3C87F7` on near-black is below 4.5:1.
    link: '#7FB0FF',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

/**
 * Viewport width (in dp/px) at which the web navigation chrome switches from
 * a narrow "mobile web" bottom tab bar to a wide "tablet/desktop web" sidebar
 * rail. See `src/components/app-tabs.web.tsx` for the single place that
 * consumes this to pick a layout.
 */
export const WebNavBreakpoint = 768;

/** Height of the custom web bottom tab bar (mobile web, width < WebNavBreakpoint). */
export const WebBottomTabBarHeight = 64;

/** Width of the custom web sidebar rail (tablet/desktop web, width >= WebNavBreakpoint). */
export const WebSidebarWidth = 240;
