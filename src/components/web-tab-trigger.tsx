import { type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from './themed-text';

import { TabRouteConfig } from '@/constants/tabs';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type WebTabTriggerProps = TabTriggerSlotProps & {
  tab: TabRouteConfig;
  /**
   * `'bottom'`  — compact, icon-over-label button for the narrow mobile-web
   *              bottom bar (`web-bottom-tab-bar.tsx`).
   * `'sidebar'` — roomier, icon-beside-label row for the wide desktop-web
   *              sidebar rail (`web-side-nav.tsx`).
   */
  variant: 'bottom' | 'sidebar';
};

/**
 * One tappable tab item, shared by both web nav layouts.
 *
 * Rendered as the `asChild` target of an `expo-router/ui` `<TabTrigger>`, so
 * `isFocused` and the navigation `onPress`/`onLongPress` handlers below are
 * injected by expo-router itself — this component only owns how the item
 * *looks*. That's what keeps the bottom bar and the sidebar visually in sync:
 * both point the same `tab` config and the same focus state through the same
 * icon/label/color logic, just arranged differently via `variant`.
 */
export function WebTabTrigger({ tab, variant, isFocused, ...pressableProps }: WebTabTriggerProps) {
  const theme = useTheme();
  // `family` is Ionicons for most tabs, but a tab can opt into a different
  // vector-icon family when Ionicons has no matching glyph (see Profile in
  // `constants/tabs.ts`) — this is what keeps that tab's web icon in sync
  // with the one Android renders via `NativeTabs.Trigger.VectorIcon`.
  const Icon = tab.vectorIcon.family;
  const iconName = isFocused ? tab.vectorIcon.selected : tab.vectorIcon.default;
  // Purple brand tint for the active tab, matching the native tab bars.
  const tintColor = isFocused ? theme.primary : theme.textSecondary;

  return (
    // Spread first, then declare `style` explicitly below so our own
    // (function) style always wins over whatever `TabTrigger`'s `asChild`
    // slot injected into `pressableProps.style`.
    <Pressable
      {...pressableProps}
      accessibilityRole="tab"
      accessibilityLabel={tab.label}
      accessibilityState={{ selected: isFocused }}
      style={({ pressed }) => [
        variant === 'bottom' ? styles.bottomItem : styles.sidebarItem,
        isFocused && { backgroundColor: theme.primarySoft },
        pressed && styles.pressed,
      ]}>
      <Icon name={iconName} size={variant === 'bottom' ? 22 : 20} color={tintColor} />
      <ThemedText
        type={variant === 'bottom' ? 'small' : 'default'}
        themeColor={isFocused ? 'primary' : 'textSecondary'}
        style={variant === 'bottom' ? styles.bottomLabel : styles.sidebarLabel}
        numberOfLines={1}>
        {tab.label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bottomItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.half,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
  },
  bottomLabel: {
    fontSize: 11,
    lineHeight: 14,
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  sidebarLabel: {
    flexShrink: 1,
  },
  pressed: {
    opacity: 0.7,
  },
});
