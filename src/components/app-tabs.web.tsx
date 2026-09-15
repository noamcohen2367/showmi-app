import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { WebBottomTabBar } from './web-bottom-tab-bar';
import { WebSideNav } from './web-side-nav';
import { WebTabTrigger } from './web-tab-trigger';

import { TAB_ROUTES } from '@/constants/tabs';
import { WebBottomTabBarHeight, WebNavBreakpoint, WebSidebarWidth } from '@/constants/theme';

/**
 * Web navigation shell.
 *
 * `expo-router/unstable-native-tabs` (used by `app-tabs.tsx` on iOS/Android)
 * has no web renderer worth shipping — it can't produce a real SwiftUI
 * TabView or Material bottom nav in a browser — so web gets its own,
 * fully custom implementation built from the headless `expo-router/ui`
 * primitives (`Tabs`/`TabList`/`TabTrigger`/`TabSlot`). Metro picks this file
 * automatically for web bundles because of the `.web.tsx` extension; iOS and
 * Android keep using `app-tabs.tsx`. See `app/(tabs)/_layout.tsx`.
 *
 * Both this file and `app-tabs.tsx` read the same `TAB_ROUTES` config, so
 * the routes/labels/icons can never drift between platforms — only the
 * chrome around them differs.
 */
export default function AppTabs() {
  // -------------------------------------------------------------------
  // THE single decision point for which web nav layout to render.
  //
  // `useWindowDimensions` (unlike a one-off `Dimensions.get('window')` read)
  // subscribes to resize events, so this re-evaluates on every browser
  // resize — dragging the window across the breakpoint flips the layout
  // live, no reload needed.
  //
  //   width <  WebNavBreakpoint (~768px, phone-width browsers) -> bottom bar
  //   width >= WebNavBreakpoint (tablet/desktop browsers)      -> sidebar
  //
  // 768px mirrors the common tablet-portrait breakpoint used by the rest of
  // the responsive web ecosystem; see the accompanying write-up for the
  // full tradeoff discussion (why 768, and why a sidebar over a top navbar
  // for the wide case).
  // -------------------------------------------------------------------
  const { width } = useWindowDimensions();
  const isWideLayout = width >= WebNavBreakpoint;

  // The 4 tab triggers themselves are identical either way — only the
  // container they render inside (bottom bar vs sidebar) and the button
  // `variant` (compact-stacked vs roomy-inline) change.
  const triggers = TAB_ROUTES.map((tab) => (
    <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
      <WebTabTrigger tab={tab} variant={isWideLayout ? 'sidebar' : 'bottom'} />
    </TabTrigger>
  ));

  return (
    <Tabs style={styles.tabs}>
      <TabList asChild>
        {isWideLayout ? <WebSideNav>{triggers}</WebSideNav> : <WebBottomTabBar>{triggers}</WebBottomTabBar>}
      </TabList>

      {/* Reserve space for whichever nav is currently showing so its fixed
          position never overlaps the active screen's content. Screens under
          app/(tabs)/ stay 100% platform-agnostic — this is the only place
          that compensates for the web-only chrome around them. The sidebar
          sits on the right (the app is RTL — see `web-side-nav.tsx`), so
          this reserves `paddingRight`, not `paddingLeft`. */}
      <View
        style={[
          styles.content,
          isWideLayout ? { paddingRight: WebSidebarWidth } : { paddingBottom: WebBottomTabBarHeight },
        ]}>
        <TabSlot style={styles.slot} />
      </View>
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  slot: {
    flex: 1,
  },
});
