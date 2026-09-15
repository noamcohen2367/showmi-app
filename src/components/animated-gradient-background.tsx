import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, type ViewProps } from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedProps,
  useAnimatedStyle,
} from 'react-native-reanimated';

import {
  DARK_MID_ALPHA,
  DARK_TOP_ALPHA,
  LIGHT_MID_ALPHA,
  LIGHT_TOP_ALPHA,
  MID_LOCATION_RANGE,
  withAlpha,
} from '@/constants/gradient-palette';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useGradientMotion } from '@/hooks/use-gradient-motion';

/**
 * `expo-linear-gradient`'s `colors`/`locations` are plain component props,
 * not style props — `useAnimatedStyle` can't touch them. Wrapping it with
 * `createAnimatedComponent` lets `useAnimatedProps` drive them from a shared
 * value on the UI thread instead, same as any other worklet-animated value.
 * This genuinely works on iOS/Android: reanimated updates native props
 * through Fabric directly, with no DOM involved — see `.web.tsx` for why
 * the *web* build can't use this same technique on this component.
 */
const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

/**
 * The 3 gradient stops (top → middle → bottom) for one theme, at rest.
 * Marked `'worklet'` — called from inside `useAnimatedProps` below (as well
 * as plainly, for the static initial `colors` prop); see `withAlpha`'s doc
 * comment for why that's required on native.
 */
function baseStops(
  theme: { primary: string; background: string },
  topAlpha: number,
  midAlpha: number,
) {
  'worklet';
  return [
    withAlpha(theme.primary, topAlpha),
    withAlpha(theme.primary, midAlpha),
    theme.background,
  ] as const;
}

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
  const [r, g, b] = rgba
    .slice(rgba.indexOf('(') + 1, rgba.indexOf(')'))
    .split(',');
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
function blendStop(
  lightHex: string,
  lightAlpha: number,
  darkHex: string,
  darkAlpha: number,
  t: number,
) {
  'worklet';
  const hue = interpolateColor(t, [0, 1], [lightHex, darkHex]);
  const alpha = interpolate(t, [0, 1], [lightAlpha, darkAlpha]);
  return withOverriddenAlpha(hue, alpha);
}

export type AnimatedGradientBackgroundProps = ViewProps;

/**
 * A full-bleed, ambiently-animated purple gradient meant to sit once behind
 * the entire app (see the root layout snippet in the project write-up) —
 * never per-screen. Screens render on top of it with transparent
 * backgrounds, so it must be mounted above the router outlet, not inside it,
 * or it will simply remount/reset on every navigation.
 *
 * - Reads light/dark from the app's existing `useColorScheme` hook — it does
 *   not track theme state of its own.
 * - Purely decorative: `pointerEvents="none"` everywhere, so it never steals
 *   taps from content or the tab bar rendered above it.
 *
 * iOS/Android only — Metro resolves this file for those platforms and
 * `animated-gradient-background.web.tsx` for web (see that file for why web
 * needs a different rendering technique for the exact same animation).
 *
 * A single `LinearGradient`, not two crossfading gradient layers: an earlier
 * version had a separate always-mounted, always-animating *gradient* layer
 * per theme, each recomputing + repainting its own full-screen shader
 * continuously — confirmed on a real device to cost enough of the UI
 * thread's per-frame budget to visibly stutter scrolling and the native
 * tab-switch transition, even though the same code never showed a problem
 * in this environment's own testing (web only — there's no device/simulator
 * available here to catch a cost like this ahead of time). One gradient,
 * computing its own light↔dark blend per stop via `interpolateColor`, does
 * one shader redraw instead of two. `interpolateColor` blends in HSV space
 * by default, which is exactly what avoids the "muddy grey halfway between
 * light and dark" result plain RGB blending would give two very different
 * lightness colors.
 *
 * There's still a plain solid-color `backdrop` behind the gradient,
 * crossfaded the same way — cheap (a `backgroundColor` style update, not a
 * shader redraw) so it doesn't reintroduce the cost above. It's load-bearing,
 * not decoration: the gradient's own stops are semi-transparent everywhere
 * except the very last pixel of its bottom stop, so without an opaque
 * backdrop of its own, most of the gradient composites against whatever
 * happens to be further behind it — which on both platforms defaults to
 * white, not `theme.background`. That's invisible in light mode purely by
 * coincidence (white already *is* the light background), and was the exact
 * bug that made dark mode's gradient look mostly-light everywhere except a
 * sliver at the very bottom before this was added back in.
 */
export function AnimatedGradientBackground({
  style,
  ...rest
}: AnimatedGradientBackgroundProps) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const { progress, themeProgress } = useGradientMotion(isDark);

  const animatedProps = useAnimatedProps(() => {
    'worklet';
    const midLocation = interpolate(progress.value, [0, 1], MID_LOCATION_RANGE);
    const lightTopAlpha = interpolate(progress.value, [0, 1], LIGHT_TOP_ALPHA);
    const lightMidAlpha = interpolate(progress.value, [0, 1], LIGHT_MID_ALPHA);
    const darkTopAlpha = interpolate(progress.value, [0, 1], DARK_TOP_ALPHA);
    const darkMidAlpha = interpolate(progress.value, [0, 1], DARK_MID_ALPHA);
    const t = themeProgress.value;
    return {
      colors: [
        blendStop(
          Colors.light.primary,
          lightTopAlpha,
          Colors.dark.primary,
          darkTopAlpha,
          t,
        ),
        blendStop(
          Colors.light.primary,
          lightMidAlpha,
          Colors.dark.primary,
          darkMidAlpha,
          t,
        ),
        interpolateColor(
          t,
          [0, 1],
          [Colors.light.background, Colors.dark.background],
        ),
      ] as const,
      locations: [0, midLocation, 1] as const,
    };
  });

  const backdropStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      themeProgress.value,
      [0, 1],
      [Colors.light.background, Colors.dark.background],
    ),
  }));

  return (
    <View
      style={[StyleSheet.absoluteFill, style]}
      pointerEvents="none"
      {...rest}
    >
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, backdropStyle]}
      />
      <AnimatedLinearGradient
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
        colors={baseStops(Colors.light, LIGHT_TOP_ALPHA[0], LIGHT_MID_ALPHA[0])}
        locations={[0, MID_LOCATION_RANGE[0], 1]}
        animatedProps={animatedProps}
      />
    </View>
  );
}
