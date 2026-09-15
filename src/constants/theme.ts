/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
    // Brand purple used as the active/selected tint for navigation everywhere
    // (native tab bars, the web bottom bar, and the web sidebar rail).
    primary: '#6D28D9',
    // A translucent wash of `primary`, used behind the active item on the
    // Android native tab bar and the web nav (sidebar/bottom bar) so the
    // selected tab gets a soft "pill" background instead of just a tint.
    primarySoft: 'rgba(109, 40, 217, 0.14)',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
    // Lighter than the light theme's `primary` so the same brand purple
    // keeps enough contrast against a near-black background.
    primary: '#A78BFA',
    primarySoft: 'rgba(167, 139, 250, 0.20)',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

/**
 * Viewport width (in dp/px) at which the web navigation chrome switches from
 * a narrow "mobile web" bottom tab bar to a wide "tablet/desktop web" sidebar
 * rail. See `src/components/app-tabs.web.tsx` for the single place that
 * consumes this to pick a layout.
 */
export const WebNavBreakpoint = 768;

/** Height of the custom web bottom tab bar (mobile web, width < WebNavBreakpoint). */
export const WebBottomTabBarHeight = 64;

/** Width of the custom web sidebar rail (tablet/desktop web, width >= WebNavBreakpoint). */
export const WebSidebarWidth = 240;
