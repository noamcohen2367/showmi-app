import AppTabs from '@/components/app-tabs';

/**
 * Layout for the `(tabs)` route group.
 *
 * `AppTabs` is the ONLY thing that changes per platform:
 *  - On iOS/Android, Metro resolves this import to `app-tabs.tsx`, which
 *    renders `expo-router/unstable-native-tabs` (real native tab bars).
 *  - On web, Metro resolves it to `app-tabs.web.tsx` instead (the `.web.tsx`
 *    extension always wins for web bundles), which renders a custom
 *    responsive nav built from `expo-router/ui` primitives.
 *
 * Every platform mounts the exact same 4 screens below `app/(tabs)/` — only
 * the chrome around them differs.
 */
export default function TabLayout() {
  return <AppTabs />;
}
