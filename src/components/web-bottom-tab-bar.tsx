import { GlassView } from 'expo-glass-effect';
import { type TabListProps } from 'expo-router/ui';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MaxContentWidth, Spacing, WebBottomTabBarHeight } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Narrow-viewport (mobile web, < `WebNavBreakpoint`) navigation chrome: a
 * floating bottom tab bar visually consistent with the native tab bars —
 * same 4 items, same accent active tint, same glass background.
 *
 * Floats inset from the screen edges with fully rounded ends, rather than
 * spanning the full width pinned to the bottom. That matches what iOS 26
 * does with the *native* bar on its own — see `app-tabs.tsx`, which is left
 * alone precisely because the OS already draws it this way there. This file
 * is the only place the shape has to be reproduced by hand.
 *
 * This component only supplies the *chrome* (positioning, background,
 * safe-area handling). The actual tab buttons are passed in as `children`
 * by `app-tabs.web.tsx` (each one a `<TabTrigger asChild><WebTabTrigger .../>
 * </TabTrigger>`) — see that file for why they have to be passed down
 * this way rather than rendered here directly.
 */
export function WebBottomTabBar({ children, style, ...rest }: TabListProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      {...rest}
      // `pointerEvents="box-none"` so the inset gutters either side of the
      // floating bar don't swallow clicks on the page beneath them — the
      // wrapper still spans the full width, but only the bar itself is solid
      // to the pointer now that it no longer fills that width.
      pointerEvents="box-none"
      style={[styles.wrapper, { paddingBottom: insets.bottom + FLOAT_INSET }, style]}>
      {/*
        `GlassView` renders true iOS Liquid Glass only on iOS; the very same
        component degrades to a plain `View` on Android and web (see
        `expo-glass-effect`'s own fallback implementation), which is why we
        also set an explicit translucent `backgroundColor` + a CSS
        `backdropFilter` blur below — that's the "solid/blurred" graceful
        degradation for browsers, layered so it also survives browsers that
        don't support `backdrop-filter` (they just get the solid tint).
      */}
      <GlassView
        glassEffectStyle="regular"
        tintColor={theme.background}
        style={[
          styles.bar,
          {
            backgroundColor: theme.background + 'CC',
            height: WebBottomTabBarHeight,
            borderColor: theme.backgroundElement,
          },
          webBlurStyle,
        ]}>
        <View style={styles.content}>{children}</View>
      </GlassView>
    </View>
  );
}

// `backdropFilter` isn't part of React Native's style types (it's a
// web-only CSS property), but react-native-web forwards unrecognized
// camelCase style keys straight through to the DOM element's inline style,
// so this still produces a real blur in browsers that support it and is
// simply ignored elsewhere.
const webBlurStyle =
  Platform.OS === 'web' ? ({ backdropFilter: 'blur(20px)' } as unknown as object) : null;

/** How far the floating bar sits in from the screen's edges. */
const FLOAT_INSET = Spacing.three;

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingHorizontal: FLOAT_INSET,
  },
  bar: {
    // Fully rounded: half the bar's own height, so the ends are true
    // semicircles at any height rather than a fixed radius that would stop
    // matching if `WebBottomTabBarHeight` changed.
    borderRadius: WebBottomTabBarHeight / 2,
    borderWidth: StyleSheet.hairlineWidth,
    // Clips the glass to the rounded ends — without it the effect renders as
    // a rectangle behind the curve on the plain-`View` fallback path.
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  content: {
    flexDirection: 'row',
    width: '100%',
    paddingHorizontal: Spacing.two,
  },
});
