import { useEffect } from 'react';
import { AppState } from 'react-native';
import {
  cancelAnimation,
  Easing,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { CROSSFADE_DURATION_MS, LOOP_LEG_DURATION_MS } from '@/constants/gradient-palette';

/**
 * Drives `<AnimatedGradientBackground>`'s two shared values. Identical on
 * every platform — reanimated shared values/worklets behave the same on
 * native and web — so both `animated-gradient-background.tsx` (iOS/Android)
 * and `.web.tsx` (web) call this same hook and only differ in how they turn
 * the resulting numbers into a rendered gradient (see those files' comments
 * for why that last step can't be shared too).
 */
export function useGradientMotion(isDark: boolean) {
  const reduceMotionEnabled = useReducedMotion();

  // Ambient "clock", shared by both the light and dark gradient layers, so
  // switching theme never resets or jumps the animation's phase — only
  // which layer is *visible* changes (via `themeProgress` below).
  const progress = useSharedValue(0);

  // 0 = light layer fully visible, 1 = dark layer fully visible. Animated
  // (never snapped) whenever `isDark` changes, producing the light↔dark
  // crossfade. This is the one piece of "theme transition" logic in the
  // app today — there's no separate app-wide theme-transition system yet
  // to hook into, so it's self-contained here, driven by the same
  // `useColorScheme` signal every other themed component already uses.
  const themeProgress = useSharedValue(isDark ? 1 : 0);

  useEffect(() => {
    themeProgress.value = withTiming(isDark ? 1 : 0, {
      duration: CROSSFADE_DURATION_MS,
      easing: Easing.inOut(Easing.ease),
    });
  }, [isDark, themeProgress]);

  useEffect(() => {
    // Reduce Motion: freeze on one static (and still visually pleasant)
    // frame rather than animating at all. This only affects the continuous
    // ambient loop — the brief light/dark crossfade above still plays, since
    // that's a discrete, user-triggered UI transition rather than the kind
    // of decorative, unbounded motion Reduce Motion targets.
    if (reduceMotionEnabled) {
      cancelAnimation(progress);
      progress.value = 0.5;
      return;
    }

    const start = () => {
      progress.value = withRepeat(
        withTiming(1, { duration: LOOP_LEG_DURATION_MS, easing: Easing.inOut(Easing.ease) }),
        -1, // repeat indefinitely
        true, // ...reversing each leg, i.e. a 0→1→0 ping-pong
      );
    };
    const stop = () => cancelAnimation(progress);

    start();

    // "For as long as the app is in the foreground": nothing is visible
    // while backgrounded, so pause the animation there instead of burning
    // cycles, and resume on return.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') start();
      else stop();
    });

    return () => {
      stop();
      subscription.remove();
    };
  }, [reduceMotionEnabled, progress]);

  return { progress, themeProgress };
}
