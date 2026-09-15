import Ionicons from '@expo/vector-icons/Ionicons';
import SimpleLineIcons from '@expo/vector-icons/SimpleLineIcons';
import type { ComponentType } from 'react';
import type { SFSymbol } from 'sf-symbols-typescript';

/**
 * Any `@expo/vector-icons` icon set component (Ionicons, SimpleLineIcons, …)
 * — matches the `family` shape `NativeTabs.Trigger.VectorIcon` expects, and
 * what a plain `<Family name=.../>` element needs on web.
 *
 * Typed as `ComponentType<any>` on purpose: each real family (e.g. Ionicons)
 * types its own `name` prop as a huge string-literal union specific to that
 * family, and TypeScript's structural checking is invariant enough on class
 * component props that no single supertype can describe "some family's
 * glyph-name prop" once several different families need to sit in the same
 * array — see e.g. https://github.com/microsoft/TypeScript/issues/48856 for
 * the general shape of this limitation. `default`/`selected` below are
 * plain strings as a result, so double-check a new glyph name against the
 * family's own typings/icons.expo.fyi when changing one — see also the
 * comment on `TAB_ROUTES`'s `profile` entry for the family actually used.
 */
type IconFamily = ComponentType<any> & {
  getImageSource: (name: any, size: number, color: any) => Promise<any>;
};

/**
 * Single source of truth for the 4 bottom-tab destinations.
 *
 * Both the native tab bar (`app-tabs.tsx`, iOS/Android) and the web nav
 * chrome (`app-tabs.web.tsx` + `web-bottom-tab-bar.tsx` + `web-side-nav.tsx`)
 * import this array instead of hard-coding routes/labels/icons themselves.
 * That keeps every platform pointed at the exact same route group
 * (`app/(tabs)/*`) and guarantees the label/icon shown for a tab can never
 * drift between iOS, Android, and web.
 *
 * - `name` is the route file name inside `app/(tabs)/` (what expo-router's
 *   `<NativeTabs.Trigger name>` expects).
 * - `href` is the resolved URL path (what `expo-router/ui`'s `<TabTrigger
 *   href>` and plain `<Link href>` expect) — the `(tabs)` group segment is
 *   not part of the URL.
 * - `sfSymbol` is used on iOS only, via real SF Symbols.
 * - `vectorIcon` is used on Android (through `NativeTabs.Trigger.VectorIcon`)
 *   and on web (through a plain `<family name=.../>` element) so both
 *   non-iOS targets render the exact same glyph for a given tab. Most tabs
 *   use Ionicons, the app's default icon set — but a tab can point at a
 *   different family when Ionicons has no matching glyph (see Profile).
 */
export type TabRouteConfig = {
  name: 'index' | 'search' | 'favorites' | 'profile';
  href: '/' | '/search' | '/favorites' | '/profile';
  label: string;
  sfSymbol: { default: SFSymbol; selected: SFSymbol };
  vectorIcon: { family: IconFamily; default: string; selected: string };
};

export const TAB_ROUTES: readonly TabRouteConfig[] = [
  {
    name: 'index',
    href: '/',
    label: 'בית',
    sfSymbol: { default: 'house', selected: 'house.fill' },
    vectorIcon: { family: Ionicons, default: 'home-outline', selected: 'home' },
  },
  {
    name: 'search',
    href: '/search',
    label: 'חיפוש',
    sfSymbol: { default: 'magnifyingglass', selected: 'magnifyingglass' },
    vectorIcon: { family: Ionicons, default: 'search-outline', selected: 'search' },
  },
  {
    name: 'favorites',
    href: '/favorites',
    label: 'מועדפים',
    sfSymbol: { default: 'heart', selected: 'heart.fill' },
    vectorIcon: { family: Ionicons, default: 'heart-outline', selected: 'heart' },
  },
  {
    name: 'profile',
    href: '/profile',
    label: 'פרופיל',
    // Real SF Symbol mustache glyphs exist on iOS, outline vs. filled.
    sfSymbol: { default: 'mustache', selected: 'mustache.fill' },
    // Ionicons has no mustache glyph, so Android + web fall back to
    // SimpleLineIcons for this one tab — its whole set is a single
    // thin-line style, so there's no separate selected/filled variant;
    // the purple tint alone communicates the selected state instead.
    vectorIcon: { family: SimpleLineIcons, default: 'mustache', selected: 'mustache' },
  },
] as const;
