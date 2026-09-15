import { GlassView } from 'expo-glass-effect';
import { type TabListProps } from 'expo-router/ui';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from './themed-text';

import { Spacing, WebSidebarWidth } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Wide-viewport (tablet/desktop web, >= `WebNavBreakpoint`) navigation
 * chrome: the same 4 items as a fixed sidebar rail instead of a bottom bar.
 * See the write-up (README / task response) for why a sidebar was chosen
 * over a top navbar for wide web.
 *
 * The whole app is RTL (Hebrew content — see `index.js`/`src/app/+html.tsx`),
 * so the rail sits on the right, not the left, with its divider border on
 * the left edge facing the content. These are hardcoded rather than
 * computed from an RTL check because the app has exactly one direction —
 * there's no LTR mode to branch on.
 *
 * Like `WebBottomTabBar`, this only supplies the chrome — the tab buttons
 * are passed in as `children` by `app-tabs.web.tsx`.
 */
export function WebSideNav({ children, style, ...rest }: TabListProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View {...rest} style={[styles.wrapper, style]}>
      {/* See WebBottomTabBar for why both a GlassView *and* an explicit
          translucent background + backdrop-filter blur are used together. */}
      <GlassView
        glassEffectStyle="regular"
        tintColor={theme.background}
        style={[
          styles.rail,
          { backgroundColor: theme.background + 'CC', borderLeftColor: theme.backgroundElement },
          { paddingTop: insets.top + Spacing.five, paddingBottom: insets.bottom + Spacing.three },
          webBlurStyle,
        ]}>
        <ThemedText type="smallBold" style={styles.brand}>
          Showmi
        </ThemedText>
        <View style={styles.items}>{children}</View>
      </GlassView>
    </View>
  );
}

const webBlurStyle =
  Platform.OS === 'web' ? ({ backdropFilter: 'blur(20px)' } as unknown as object) : null;

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: WebSidebarWidth,
  },
  rail: {
    flex: 1,
    borderLeftWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
  },
  brand: {
    fontSize: 20,
    paddingHorizontal: Spacing.three,
    marginBottom: Spacing.five,
  },
  items: {
    gap: Spacing.one,
  },
});
