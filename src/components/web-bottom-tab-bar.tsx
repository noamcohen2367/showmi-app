import { GlassView } from 'expo-glass-effect';
import { type TabListProps } from 'expo-router/ui';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MaxContentWidth, Spacing, WebBottomTabBarHeight } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Narrow-viewport (mobile web, < `WebNavBreakpoint`) navigation chrome: a
 * fixed bottom tab bar visually consistent with the native tab bars —
 * same 4 items, same purple active tint, same glass background.
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
    <View {...rest} style={[styles.wrapper, style]}>
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
          { backgroundColor: theme.background + 'CC', height: WebBottomTabBarHeight + insets.bottom },
          { paddingBottom: insets.bottom, borderTopColor: theme.backgroundElement },
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

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  bar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  content: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.two,
    paddingTop: Spacing.two,
  },
});
