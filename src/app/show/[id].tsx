import Ionicons from '@expo/vector-icons/Ionicons';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SaveButton } from '@/components/save-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { withAlpha } from '@/constants/gradient-palette';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useHomeFeed } from '@/hooks/use-home-feed';
import { useTheme } from '@/hooks/use-theme';
import type { Show } from '@/types/show';
import { formatShowtime, nextUpcomingShowtime } from '@/utils/date';

/** How hard the background poster is blurred, in points. Tune by eye. */
const POSTER_BLUR_RADIUS = 60;

/**
 * Roughly where the hero's bottom edge falls, as a fraction of screen
 * height. The hero is `min(width, MaxContentWidth) * 0.9` tall, which works
 * out to ~42% of a phone screen (51% on an SE).
 */
const HERO_FRACTION = 0.42;

/**
 * The background gradient: barely there at the top, half-strength where the
 * hero ends, solid by the bottom of the block.
 *
 * The middle stop is pinned to `HERO_FRACTION` because that is the exact
 * point the poster stops being hidden and starts being seen. An earlier
 * version ramped to full strength by 40% — *above* the hero's bottom edge —
 * which meant the entire fade happened behind an opaque image and the blur
 * was never visible at all, on any device. That is the bug this replaces.
 *
 * Starting at 0.12 rather than 0 is free: that band sits behind the hero and
 * is never seen. It is what lifts dark mode's info row — the first text
 * below the hero, and the tightest case — from 3.49:1 to 4.64:1.
 *
 * Measured worst case (a near-black poster under light theme, a near-white
 * one under dark), for `theme.text` at the four places body copy sits:
 *
 *            info row   synopsis   detail rows   last row
 *   light      6.12       8.43        12.04       17.22
 *   dark       4.64       6.79        11.20       18.01
 *
 * `textSecondary` does NOT clear 4.5:1 against these — see `DetailRow` and
 * the info row for why body copy on this screen uses `theme.text` instead.
 */
const SCRIM_LOCATIONS = [0, HERO_FRACTION, 1] as const;
const SCRIM_ALPHAS = [0.12, 0.5, 0.98] as const;

/**
 * Show detail (`/show/[id]`).
 *
 * Lives outside the `(tabs)` group deliberately, so it pushes over the tab
 * bar as a full screen rather than inside a tab — a show reached from Home,
 * Search or the watchlist is the same screen either way, and shouldn't
 * appear to belong to whichever tab you came from.
 *
 * The show is read out of the same `useHomeFeed` every other screen uses
 * rather than a per-screen `fetchShowById`, so navigating here never
 * triggers a second load of data the app already has.
 */
export default function ShowDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const result = useHomeFeed();

  const show = useMemo(() => {
    if (result.status !== 'ready') return undefined;
    return result.feed.all.find((candidate) => candidate.id === id);
  }, [result, id]);

  if (result.status === 'loading') {
    return (
      <CenteredState>
        <ActivityIndicator />
      </CenteredState>
    );
  }

  if (result.status === 'error' || !show) {
    return (
      <CenteredState>
        <ThemedText themeColor="textSecondary">
          {result.status === 'error' ? 'אירעה שגיאה בטעינת ההצגה.' : 'ההצגה לא נמצאה.'}
        </ThemedText>
      </CenteredState>
    );
  }

  return <ShowDetail show={show} />;
}

function ShowDetail({ show }: { show: Show }) {
  const theme = useTheme();
  const router = useRouter();
  const next = nextUpcomingShowtime(show.showtimes);

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Inside the ScrollView, not pinned to the screen, so it scrolls away
            with the content. That is what makes the long fade safe: every
            paragraph sits at a fixed point on the gradient instead of sliding
            through it, so its contrast is a constant rather than a function of
            scroll position. First child, so everything after it paints on top. */}
        <PosterBackground show={show} />

        <Hero show={show} onBack={() => router.back()} />

        <View style={styles.body}>
          <View style={styles.infoRow}>
            <Image
              source={{ uri: show.images[0] }}
              style={styles.thumbnail}
              contentFit="cover"
              transition={150}
              cachePolicy="memory-disk"
              recyclingKey={show.id}
            />
            <View style={styles.infoText}>
              <ThemedText type="title" style={styles.name} numberOfLines={2}>
                {show.name}
              </ThemedText>
              {/* `theme.text`, not `textSecondary`, and that is a legibility
                  requirement rather than a style preference — see
                  `SCRIM_ALPHAS`. This line is the first text below the hero,
                  where the gradient is weakest and the blurred poster shows
                  through most; `textSecondary` measures 1.30:1 there. The
                  smaller size still separates it from the name above. */}
              <ThemedText type="small">
                {show.theater.name}, {show.theater.city}
              </ThemedText>
              {next ? (
                <ThemedText type="small" themeColor="primary">
                  {formatShowtime(next.startsAt)}
                </ThemedText>
              ) : null}
            </View>
          </View>

          {/* Same reason as the venue line above: this sits over the visible
              part of the blurred poster, where `textSecondary` doesn't clear
              AA. Hierarchy comes from the line height and the section titles
              around it instead of from a dimmer colour. */}
          <ThemedText style={styles.synopsis}>{show.synopsis}</ThemedText>

          <ThemedText type="subtitle" style={styles.sectionTitle}>
            פרטים
          </ThemedText>

          <DetailRow icon="location-outline">
            <ThemedText type="small">
              {show.theater.name}, {show.theater.city}
            </ThemedText>
          </DetailRow>

          <DetailRow icon="pricetags-outline">
            <View style={styles.tags}>
              {show.categories.map((category, index) => (
                <Pressable
                  key={category}
                  accessibilityRole="link"
                  accessibilityLabel={`הצגות בקטגוריה ${category}`}
                  // Sends the category through to Search rather than filtering
                  // in place: a tag on a detail screen means "show me more like
                  // this", which is a search, not a change to this screen.
                  onPress={() => router.push({ pathname: '/search', params: { category } })}>
                  <ThemedText type="small" themeColor="primary" style={styles.tag}>
                    {category}
                    {index < show.categories.length - 1 ? ',' : ''}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </DetailRow>

          {show.actors.length > 0 ? (
            <DetailRow icon="people-outline">
              <ThemedText type="small">{show.actors.map((actor) => actor.name).join(', ')}</ThemedText>
            </DetailRow>
          ) : null}

          <DetailRow icon="calendar-outline">
            <ThemedText type="small">
              {show.showtimes.length > 0
                ? `${show.showtimes.length} מועדים קרובים`
                : 'אין מועדים זמינים כרגע'}
            </ThemedText>
          </DetailRow>
        </View>
      </ScrollView>

      {/* Pinned outside the ScrollView so it stays reachable without scrolling
          to the bottom — the reference's sticky purchase bar.

          Glass rather than an opaque fill, so the poster scrolling underneath
          stays faintly visible. Same layering as `WebBottomTabBar`: a
          `GlassView` for real Liquid Glass on iOS, plus an explicit
          translucent `backgroundColor` underneath, because the component
          degrades to a plain `View` on Android and web and would otherwise
          leave the text sitting on whatever scrolled behind it. */}
      <GlassView
        glassEffectStyle="regular"
        tintColor={theme.background}
        style={[
          styles.bottomBar,
          { backgroundColor: theme.background + 'D9', borderTopColor: theme.backgroundElement },
        ]}>
        <SafeAreaView edges={['bottom']} style={styles.bottomBarInner}>
          <View style={styles.bottomBarText}>
            {next ? (
              <>
                <ThemedText type="small" themeColor="textSecondary">
                  המועד הקרוב
                </ThemedText>
                <ThemedText type="smallBold">{formatShowtime(next.startsAt)}</ThemedText>
              </>
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                אין מועדים זמינים
              </ThemedText>
            )}
          </View>

          <Pressable
            disabled={!next}
            accessibilityRole="button"
            accessibilityLabel="הזמנת כרטיסים באתר המכירה"
            // Opens the ticketing site in an in-app browser rather than
            // leaving the app entirely — `purchaseUrl` is per-showtime, so
            // this is the link for the exact date shown beside it.
            onPress={() => next && WebBrowser.openBrowserAsync(next.purchaseUrl)}
            style={({ pressed }) => [
              styles.cta,
              { backgroundColor: theme.primary },
              pressed && styles.pressed,
              !next && styles.ctaDisabled,
            ]}>
            <ThemedText type="smallBold" style={{ color: theme.background }}>
              הזמנת כרטיסים
            </ThemedText>
          </Pressable>
        </SafeAreaView>
      </GlassView>
    </ThemedView>
  );
}

/**
 * The hero: every one of the show's images as a paged carousel, with the
 * back/save/share controls floating over it.
 *
 * The reference's "View all photos" pill opens a separate gallery; this
 * shows the count as a position indicator instead and makes the hero itself
 * swipeable. Same information, one screen fewer, and no gallery route that
 * would exist only to show three images the user can already reach.
 */
function Hero({ show, onBack }: { show: Show; onBack: () => void }) {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);

  const heroWidth = Math.min(width, MaxContentWidth);
  const heroHeight = Math.round(heroWidth * 0.9);

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    setIndex(Math.round(event.nativeEvent.contentOffset.x / heroWidth));
  }

  return (
    <View style={{ height: heroHeight }}>
      <FlatList
        data={show.images}
        keyExtractor={(uri) => uri}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        getItemLayout={(_, i) => ({ length: heroWidth, offset: heroWidth * i, index: i })}
        renderItem={({ item }) => (
          <Image
            source={{ uri: item }}
            style={{ width: heroWidth, height: heroHeight }}
            contentFit="cover"
            transition={150}
            cachePolicy="memory-disk"
            recyclingKey={item}
          />
        )}
      />

      <SafeAreaView edges={['top']} style={styles.heroControls} pointerEvents="box-none">
        <GlassControl>
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="חזרה"
            style={({ pressed }) => [styles.controlHitArea, pressed && styles.pressed]}>
            {/* `arrow-forward`, not `back`: the app is RTL, so "back" points
                rightwards. */}
            <Ionicons name="arrow-forward" size={20} color={theme.onImage} />
          </Pressable>
        </GlassControl>

        <GlassControl>
          <SaveButton showId={show.id} showName={show.name} onImage size={20} />
        </GlassControl>
      </SafeAreaView>

      {show.images.length > 1 ? (
        <View style={[styles.counter, { backgroundColor: theme.scrim }]} pointerEvents="none">
          <Ionicons name="images-outline" size={14} color={theme.onImage} />
          <ThemedText type="small" style={{ color: theme.onImage }}>
            {index + 1}/{show.images.length}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

/**
 * The screen's background: the show's own poster, blurred past recognition,
 * under a gradient that fades from clear at the top to solid at the bottom.
 *
 * Replaces the app-wide `AnimatedGradientBackground` on this screen only —
 * by covering it, never by unmounting it. That component is deliberately
 * mounted once for the app's lifetime so its animation never resets on
 * navigation, so hiding it conditionally would defeat the reason it lives in
 * the root layout at all.
 *
 * Three layers, and none of them is optional:
 *
 * 1. An opaque `theme.background` fill. Semi-transparent layers composite
 *    against *white* on both platforms when nothing opaque sits behind them
 *    — the exact bug documented in `animated-gradient-background.tsx`, which
 *    made dark mode's gradient look mostly-light. It also covers the window
 *    while the poster is still downloading, so opening the screen on a slow
 *    connection never flashes white.
 * 2. The blurred poster.
 * 3. The gradient, built from `theme.background` rather than `theme.scrim`.
 *    That difference is load-bearing: `theme.scrim` is fixed black in both
 *    themes because the text over it (`theme.onImage`) is always white. The
 *    text over *this* gradient is the theme's own `text`/`textSecondary`,
 *    which invert — so a fixed black scrim would leave light mode's dark
 *    body text sitting on near-black.
 */
function PosterBackground({ show }: { show: Show }) {
  const theme = useTheme();
  const { height } = useWindowDimensions();

  return (
    // One screen tall, anchored to the top of the scroll content. An explicit
    // height, not `absoluteFill`: the content container is taller than the
    // screen, so filling it would stretch the gradient over the whole article
    // and put the fade nowhere near where it was measured.
    <View style={[styles.posterBackground, { height }]} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.background }]} />

      <Image
        source={{ uri: show.images[0] }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={150}
        cachePolicy="memory-disk"
        recyclingKey={show.id}
        // Heavy on purpose. The posters are ~300x450 stretched to fill a
        // phone screen, so they arrive soft already; this pushes them the
        // rest of the way to a pure colour field, which is the point — the
        // background should read as the show's palette, not as a picture
        // competing with the sharp hero directly above it.
        blurRadius={POSTER_BLUR_RADIUS}
      />

      <LinearGradient
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
        colors={[
          withAlpha(theme.background, SCRIM_ALPHAS[0]),
          withAlpha(theme.background, SCRIM_ALPHAS[1]),
          withAlpha(theme.background, SCRIM_ALPHAS[2]),
        ]}
        locations={SCRIM_LOCATIONS}
      />
    </View>
  );
}

/**
 * The circular glass puck behind a control floating over the hero image.
 *
 * `isInteractive` is what makes iOS treat it as a control rather than a
 * decorative panel — it gets the platform's own press response and the
 * Liquid Glass highlight, instead of a flat disc that merely looks like a
 * button.
 *
 * The `scrim` fallback underneath is not redundant: `GlassView` degrades to
 * a plain, fully transparent `View` on Android and web, and a white icon
 * floating directly on a pale poster with nothing behind it is invisible.
 */
function GlassControl({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <GlassView
      glassEffectStyle="regular"
      isInteractive
      style={[
        styles.controlBackdrop,
        !isLiquidGlassAvailable() && { backgroundColor: withAlpha(theme.scrim, 0.45) },
      ]}>
      {children}
    </GlassView>
  );
}

function DetailRow({ icon, children }: { icon: keyof typeof Ionicons.glyphMap; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.detailRow, { borderBottomColor: theme.backgroundElement }]}>
      <Ionicons name={icon} size={20} color={theme.textSecondary} />
      <View style={styles.detailRowContent}>{children}</View>
    </View>
  );
}

function CenteredState({ children }: { children: React.ReactNode }) {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.centered}>{children}</SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // Deliberately NOT `backgroundColor: 'transparent'`, unlike every other
    // screen in the app. The others are transparent so the app-wide
    // <AnimatedGradientBackground/> shows through; this one replaces it with
    // the show's own poster. `ThemedView` fills with `theme.background` by
    // default, which is exactly what's wanted — without an opaque base the
    // orange ambient gradient reappears below the poster block as soon as the
    // content scrolls past it. The root gradient stays mounted, only covered.
  },
  posterBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingBottom: Spacing.five,
  },
  body: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    gap: Spacing.three,
  },
  heroControls: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: Spacing.three,
  },
  controlBackdrop: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    // Clips the glass to the circle. Without it the effect renders as a
    // square behind the round border on Android's fallback path.
    overflow: 'hidden',
  },
  // Fills the puck, so the whole circle is tappable rather than just the
  // glyph — the icon alone is well under the 44pt minimum target.
  controlHitArea: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: {
    position: 'absolute',
    bottom: Spacing.three,
    insetInlineEnd: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.three,
  },
  infoRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'flex-start',
  },
  thumbnail: {
    width: 72,
    aspectRatio: 2 / 3,
    borderRadius: Spacing.two,
  },
  infoText: {
    flex: 1,
    gap: Spacing.one,
  },
  name: {
    fontSize: 26,
    lineHeight: 32,
  },
  synopsis: {
    lineHeight: 22,
  },
  sectionTitle: {
    fontSize: 20,
    lineHeight: 26,
    paddingTop: Spacing.two,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  detailRowContent: {
    flex: 1,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  tag: {
    textDecorationLine: 'underline',
  },
  bottomBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  bottomBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  bottomBarText: {
    flexShrink: 1,
  },
  cta: {
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
  },
  ctaDisabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.7,
  },
});
