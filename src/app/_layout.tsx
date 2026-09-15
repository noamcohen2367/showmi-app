import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedGradientBackground } from '@/components/animated-gradient-background';
import { AnimatedSplashOverlay } from '@/components/animated-icon';

SplashScreen.preventAutoHideAsync();

/**
 * Root layout for the whole app.
 *
 * This only owns the top-level `Stack` (so screens like a future show-detail
 * page can be pushed on top of the tabs) and app-wide theming/splash. The
 * actual bottom-tab navigation lives one level down, in the `(tabs)` route
 * group, so it can be swapped per platform without touching this file — see
 * `src/app/(tabs)/_layout.tsx`.
 *
 * `AnimatedGradientBackground` is mounted here — above/behind the `Stack`,
 * not inside any individual screen or the `(tabs)` group — so it's created
 * exactly once for the app's entire lifetime and never remounts (and its
 * animation never resets/jumps) as the user navigates or switches tabs.
 *
 * Two separate opaque layers otherwise sit on top of it, and both need to go
 * transparent for it to actually show through:
 *  - `contentStyle: { backgroundColor: 'transparent' }` on the `Stack`
 *    stops each individual *screen's* content container from painting over
 *    it (screens themselves also need a transparent root container — see
 *    the component's own doc comment).
 *  - React Navigation's `theme.colors.background` (from React Navigation's
 *    stock `DefaultTheme`/`DarkTheme`, `rgb(242,242,242)`/black) is applied
 *    separately, to the *navigator's own* root container — a layer above
 *    the screens but still above the gradient. `navigationTheme` below
 *    overrides just that one color to transparent; everything else about
 *    the stock theme (used by e.g. any future header) is untouched.
 */
export default function RootLayout() {
  const colorScheme = useColorScheme();
  const baseTheme = colorScheme === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme = { ...baseTheme, colors: { ...baseTheme.colors, background: 'transparent' } };

  return (
    <ThemeProvider value={navigationTheme}>
      <AnimatedGradientBackground />
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }} />
    </ThemeProvider>
  );
}
