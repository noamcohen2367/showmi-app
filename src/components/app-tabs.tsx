import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { Platform, useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';
import { TAB_ROUTES } from '@/constants/tabs';

/**
 * iOS + Android bottom tab bar.
 *
 * This renders the *real* native tab bar via `expo-router/unstable-native-tabs`
 * (a SwiftUI `TabView` on iOS, a Material bottom navigation bar on Android) —
 * not a JS re-implementation. Web gets a completely separate implementation
 * in `app-tabs.web.tsx`; see that file's header comment for why, and
 * `app/(tabs)/_layout.tsx` for how the two are wired up per platform.
 *
 * The 4 tabs themselves (route name, label, icons) come from `TAB_ROUTES`,
 * the single shared config also used by the web nav, so all platforms are
 * guaranteed to point at the same routes in the same order.
 */
export default function AppTabs() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  return (
    <NativeTabs
      // Brand accent tint for the selected icon + label, on both platforms.
      tintColor={colors.primary}
      // iOS: leave `backgroundColor` unset so the system tab bar keeps its
      // native translucent material — on iOS 26+ that's the automatic
      // "Liquid Glass" style; on older iOS it's a regular blur. There is no
      // JS-level `GlassView` to add here: unlike the web nav, this bar is
      // drawn entirely by the OS, so the glass effect is already "free".
      // Android's Material bottom nav has no translucency concept, so it
      // needs an explicit solid background matching the current theme.
      backgroundColor={Platform.OS === 'android' ? colors.background : undefined}
      // iOS-only: which system blur material to use for the (non-Liquid-Glass)
      // translucent tab bar background.
      blurEffect="systemChromeMaterial"
      // Android-only: soft accent "pill" behind the selected tab's icon.
      indicatorColor={colors.primarySoft}>
      {TAB_ROUTES.map((tab) => (
        <NativeTabs.Trigger key={tab.name} name={tab.name}>
          <NativeTabs.Trigger.Label>{tab.label}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon
            // iOS: real SF Symbols, outline by default and filled when selected.
            sf={{ default: tab.sfSymbol.default, selected: tab.sfSymbol.selected }}
            // Android: the same shape rendered from `@expo/vector-icons`
            // (`tab.vectorIcon.family` — Ionicons for most tabs, but a tab
            // can opt into a different family; see `constants/tabs.ts`), so
            // Android and web (see WebTabTrigger) show visually equivalent
            // icons to iOS's SF Symbols. `sf` above takes priority on iOS,
            // `src` is what Android actually uses.
            src={{
              default: (
                <NativeTabs.Trigger.VectorIcon
                  family={tab.vectorIcon.family}
                  name={tab.vectorIcon.default}
                />
              ),
              selected: (
                <NativeTabs.Trigger.VectorIcon
                  family={tab.vectorIcon.family}
                  name={tab.vectorIcon.selected}
                />
              ),
            }}
          />
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}
