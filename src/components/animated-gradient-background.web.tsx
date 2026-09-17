import { StyleSheet, View, type ViewProps, type ViewStyle } from 'react-native';
import Animated, { interpolate, interpolateColor, useAnimatedStyle } from 'react-native-reanimated';

import {
  DARK_MID_ALPHA,
  DARK_TOP_ALPHA,
  LIGHT_MID_ALPHA,
  LIGHT_TOP_ALPHA,
  MID_LOCATION_RANGE,
} from '@/constants/gradient-palette';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useGradientMotion } from '@/hooks/use-gradient-motion';

/**
 * Web needs a different rendering technique than iOS/Android
 * (`animated-gradient-background.tsx`) for the same animation — two
 * unrelated reasons, both hit as real crashes before landing on this:
 *
 * 1. React Native core's own gradient style (`experimental_backgroundImage`)
 *    is wired up for Android in this RN version but not for iOS, and
 *    react-native-web doesn't implement it at all — so it can't be the one
 *    shared technique across platforms.
 * 2. `expo-linear-gradient` + reanimated's `useAnimatedProps` (what the
 *    native file uses) crashes on web specifically: reanimated-web's
 *    fallback for animating non-style *props* on a plain component (not a
 *    Touchable) reaches into a `_touchableNode` ref that `LinearGradient`'s
 *    web implementation never sets, throwing
 *    `Cannot read properties of undefined (reading 'setAttribute')`.
 *    Animating a *style* prop instead avoids that code path entirely.
 *
 * So instead of `expo-linear-gradient`, this renders a plain `Animated.View`
 * whose `backgroundImage` **style** is a hand-built CSS `linear-gradient()`
 * string, recomputed every frame by `useAnimatedStyle`. That hits
 * react-native-web's normal (and correctly supported) DOM style-diffing
 * path — the same one every other animated style in this app already goes
 * through — so no native module and no prop-animation shim is involved.
 * `backgroundImage` isn't one of React Native's own style keys (that's
 * `experimental_backgroundImage`, unavailable on web per point 1 above), so
 * it's cast through as a raw CSS passthrough the same way `backdropFilter`
 * is elsewhere in this app's web nav chrome.
 */

/**
 * Overwrites the alpha component of an `interpolateColor` result.
 * `interpolateColor` always returns `"rgba(r, g, b, a)"` (see reanimated's
 * `rgbaColor`), never a hex string, so `withAlpha` (which only knows how to
 * append a hex alpha *suffix*) can't be reused here directly — this just
 * keeps the r/g/b it already computed and swaps in the alpha we actually
 * want. Plain string ops only (no regex) since worklets run in a
 * restricted JS engine.
 */
function withOverriddenAlpha(rgba: string, alpha: number) {
  'worklet';
  const [r, g, b] = rgba.slice(rgba.indexOf('(') + 1, rgba.indexOf(')')).split(',');
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Blends a stop's light↔dark *hue* and *alpha* independently, then
 * recombines them — rather than handing `interpolateColor` the two already
 * alpha-baked `#RRGGBBAA` strings directly.
 *
 * That more obvious approach was tried first and produced a real, visible
 * bug: at `themeProgress === 1` (fully dark), the *bottom* stop — plain
 * opaque `#000000`/`#ffffff`, no alpha channel — blended correctly, but the
 * top/middle stops — `#RRGGBBAA` with a real alpha channel — stayed stuck
 * showing mostly the *light* color. `interpolateColor` evidently doesn't
 * treat the alpha channel of an 8-digit hex input the way `withAlpha`
 * writes it. Interpolating the (already fully numeric) alpha with a plain
 * `interpolate` — the same function already used for the ambient
 * light/dark drift — sidesteps that entirely.
 */
function blendStop(lightHex: string, lightAlpha: number, darkHex: string, darkAlpha: number, t: number) {
  'worklet';
  const hue = interpolateColor(t, [0, 1], [lightHex, darkHex]);
  const alpha = interpolate(t, [0, 1], [lightAlpha, darkAlpha]);
  return withOverriddenAlpha(hue, alpha);
}

export type AnimatedGradientBackgroundProps = ViewProps;

/**
 * Web implementation of `<AnimatedGradientBackground>` — see the file-level
 * comment above for why this can't share the native file's rendering code,
 * and the native file's doc comment for the overall component contract
 * (mount point, theme source, `pointerEvents`, single-layer-not-crossfaded
 * design, etc.), which is identical here.
 */
export function AnimatedGradientBackground({ style, ...rest }: AnimatedGradientBackgroundProps) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const { progress, themeProgress } = useGradientMotion(isDark);

  const animatedStyle = useAnimatedStyle(() => {
    const midLocation = interpolate(progress.value, [0, 1], MID_LOCATION_RANGE) * 100;
    const lightTopAlpha = interpolate(progress.value, [0, 1], LIGHT_TOP_ALPHA);
    const lightMidAlpha = interpolate(progress.value, [0, 1], LIGHT_MID_ALPHA);
    const darkTopAlpha = interpolate(progress.value, [0, 1], DARK_TOP_ALPHA);
    const darkMidAlpha = interpolate(progress.value, [0, 1], DARK_MID_ALPHA);

    // Blend each stop's light/dark color in HSV space (`interpolateColor`'s
    // default) rather than crossfading two whole overlapping gradients —
    // see the native file's doc comment for why (a real, on-device
    // performance problem with the two-layer version, not a hypothetical).
    const t = themeProgress.value;
    const top = blendStop(Colors.light.primary, lightTopAlpha, Colors.dark.primary, darkTopAlpha, t);
    const mid = blendStop(Colors.light.primary, lightMidAlpha, Colors.dark.primary, darkMidAlpha, t);
    const bottom = interpolateColor(t, [0, 1], [Colors.light.background, Colors.dark.background]);

    return {
      // `backgroundColor` matters here, not just `backgroundImage`: CSS
      // paints a `background-image` *over* `background-color` on the same
      // element, and the gradient's own stops are semi-transparent
      // everywhere except the very last pixel of `bottom` — without an
      // opaque `backgroundColor` behind it, most of the gradient would
      // composite against whatever's further behind on the page instead of
      // `theme.background` (invisible in light mode, since that default
      // happens to already be white — very visible in dark mode, where it
      // isn't). See the native file's doc comment for the fuller version of
      // this same bug.
      backgroundColor: bottom,
      // `0deg` is bottom-to-top in CSS, matching the `start`/`end` flip on
      // the native implementation — see its comment for why the accent is
      // anchored to the bottom edge rather than the top. Keep the two in
      // step: the whole point of this file is that it looks identical to
      // the native one.
      backgroundImage: `linear-gradient(0deg, ${top} 0%, ${mid} ${midLocation}%, ${bottom} 100%)`,
    } as ViewStyle;
  });

  return (
    <View style={[StyleSheet.absoluteFill, style]} pointerEvents="none" {...rest}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, animatedStyle]} />
    </View>
  );
}
