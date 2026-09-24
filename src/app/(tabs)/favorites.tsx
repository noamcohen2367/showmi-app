import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  LinearTransition,
  ReduceMotion,
  ZoomOut,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { SeenCustomCard, SeenShowCard } from '@/components/seen-show-card';
import { SegmentedPill } from '@/components/segmented-pill';
import { ShowListItem } from '@/components/show-list-item';
import { SwipeToSeen } from '@/components/swipe-to-seen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useHomeFeed } from '@/hooks/use-home-feed';
import { useTheme } from '@/hooks/use-theme';
import { useWatchlist, type CustomWatchlistItem } from '@/hooks/use-watchlist';
import type { Show } from '@/types/show';

type Segment = 'want' | 'seen';

const ENTER_MS = 180;
const EXIT_MS = 200;

/**
 * How the surviving cards close the gap a removed one leaves.
 *
 * A spring rather than a duration: the cards are settling into a new
 * position, and a spring is what that reads as. Damped hard enough not to
 * overshoot visibly — a grid of posters bouncing would be the "exaggerated
 * animation" this project deliberately avoids.
 */
const REFLOW = LinearTransition.springify().damping(20).stiffness(180).reduceMotion(ReduceMotion.System);

/** Diameter of the floating add button, needed to keep content clear of it. */
const FAB_SIZE = 56;

/**
 * How far above the screen's bottom edge the tab bar's top sits.
 *
 * `BottomTabInset` is the bar itself and nothing else — a flat 50 on iOS. On
 * any device with a home indicator the system also reserves ~34pt below it,
 * which that constant knows nothing about, so anything positioned with it
 * alone ends up roughly a third of the bar too low. That is why the add
 * button looked glued to the tab bar.
 *
 * `useBottomTabBarHeight` would be the obvious answer and is not available:
 * this app draws its tabs with `expo-router/unstable-native-tabs`, so
 * `@react-navigation/bottom-tabs` is not a dependency at all.
 */
function useTabBarClearance() {
  return BottomTabInset + useSafeAreaInsets().bottom;
}

/**
 * Tab 3 — the watchlist (`app/(tabs)/favorites.tsx`).
 *
 * Two views behind one pill: shows the user still wants to see, and shows
 * they have already seen. They were stacked in a single scroll before; a
 * pill instead, because these are two separate lists a user is in one mood
 * or the other to look at, not two sections of one list.
 *
 * A row in "רשימת צפייה" is swiped towards the start edge to move it into
 * "ראיתי" — see `SwipeToSeen` for why the gesture is defined against the
 * layout's start edge rather than as "swipe right".
 *
 * The list stores *ids*; the shows themselves come from the same
 * `useHomeFeed` every other screen uses, so there's no second source of show
 * data to keep in sync. A saved id with no matching show simply doesn't
 * render rather than erroring.
 */
export default function WatchlistScreen() {
  const theme = useTheme();
  const router = useRouter();
  const result = useHomeFeed();
  const {
    wantIds,
    seenIds,
    customWant,
    customSeen,
    setStatus,
    remove,
    ready,
    loadFailed,
  } = useWatchlist();
  const [segment, setSegment] = useState<Segment>('want');

  // Memoised rather than computed inline: the `[]` fallback would be a fresh
  // array on every render, so `byId` below would rebuild its Map every time
  // even when the feed hadn't changed.
  const allShows = useMemo(
    () => (result.status === 'ready' ? result.feed.all : []),
    [result],
  );

  const byId = useMemo(() => new Map(allShows.map((show) => [show.id, show])), [allShows]);
  const resolve = (ids: readonly string[]) =>
    ids.map((id) => byId.get(id)).filter((show): show is Show => !!show);

  const want = resolve(wantIds);
  const seen = resolve(seenIds);
  const clearance = useTabBarClearance();

  return (
    <ThemedView style={styles.container}>
      {/* `edges` excludes the bottom deliberately. Padding the container
          shortens the scroll *viewport*, so the list ends above the tab bar
          and its last row is sliced off in a straight line with dead space
          under it — the same mistake the search screen's category grid made.
          The room the tab bar needs belongs to the scrolled *content*, added
          per-list below, so cards pass under the bar instead of stopping at
          it. */}
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <ThemedText type="title" style={styles.title}>
          רשימת צפייה
        </ThemedText>

        <SegmentedPill
          value={segment}
          onChange={setSegment}
          options={[
            { value: 'want', label: 'רוצה לראות', count: want.length + customWant.length },
            { value: 'seen', label: 'ראיתי', count: seen.length + customSeen.length },
          ]}
        />

        {/* Said out loud rather than falling through to the empty state: an
            account's list that failed to load looks exactly like an empty one,
            and telling somebody they have saved nothing when in fact the
            request failed is worse than showing nothing at all. */}
        {loadFailed ? (
          <ThemedText
            themeColor="textSecondary"
            style={[styles.loadFailed, { paddingBottom: clearance }]}>
            לא הצלחנו לטעון את הרשימה. בדוק את החיבור ונסה שוב.
          </ThemedText>
        ) : segment === 'want' ? (
          <WantList
            shows={want}
            ready={ready}
            clearance={clearance}
            onMarkSeen={(id) => setStatus(id, 'seen')}
          />
        ) : (
          <SeenList
            shows={seen}
            custom={customSeen}
            ready={ready}
            clearance={clearance}
            onUnsee={(id) => setStatus(id, 'want')}
            onRemoveCustom={remove}
          />
        )}
      </SafeAreaView>

      {/* Floating, and only over the "seen" list — it is the one place where
          adding by hand makes sense, and a button that persisted across both
          segments would imply it did something different in each.

          A solid accent disc, not glass. Glass was tried and came out as a
          bare `+` floating on nothing: the tint was the theme background, so
          in light mode it was white-on-white and the button had no visible
          edge at all. A control the user has to guess at is worse than one
          that looks less fashionable.

          The glyph is `background` on `primary`, which inverts correctly by
          itself — dark purple with a white `+` in light mode, light purple
          with a black one in dark. Measured 9.71:1 and 7.95:1. */}
      {segment === 'seen' && !loadFailed ? (
        <Pressable
          onPress={() => router.push('/add-seen')}
          accessibilityRole="button"
          accessibilityLabel="הוספת הצגה שראיתי"
          style={({ pressed }) => [
            styles.fab,
            // Clears the real bar — `BottomTabInset` alone forgets the home
            // indicator, which is what left the disc looking stuck to it.
            { backgroundColor: theme.primary, bottom: clearance + Spacing.three },
            pressed && styles.pressed,
          ]}>
          <Ionicons name="add" size={30} color={theme.background} />
        </Pressable>
      ) : null}

    </ThemedView>
  );
}

function WantList({
  shows,
  ready,
  clearance,
  onMarkSeen,
}: {
  shows: Show[];
  ready: boolean;
  /** Height of the tab bar plus the home indicator below it. */
  clearance: number;
  onMarkSeen: (showId: string) => void;
}) {
  if (shows.length === 0) {
    return (
      <EmptyState
        icon="bookmark-outline"
        title={ready ? 'אין כאן עדיין הצגות' : 'טוען…'}
        text="שמרו הצגה מהבית או מהחיפוש והיא תופיע כאן."
        clearance={clearance}
      />
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[
        styles.listContent,
        { paddingBottom: clearance + Spacing.five },
      ]}
      showsVerticalScrollIndicator={false}>
      <ThemedText type="small" themeColor="textSecondary">
        החליקו שורה הצידה כדי לסמן שראיתם.
      </ThemedText>

      {/* No `exiting` here, unlike the grid: `SwipeToSeen` already slides the
          row off screen under the user's finger before this unmounts, and a
          second exit animation would play after it had already gone. What is
          missing is the other half — `layout`, so the rows below close the
          gap instead of jumping up into it. */}
      {shows.map((show) => (
        <Animated.View key={show.id} layout={REFLOW}>
          <SwipeToSeen onTriggered={() => onMarkSeen(show.id)}>
            <ThemedView style={styles.row}>
              <ShowListItem show={show} />
            </ThemedView>
          </SwipeToSeen>
        </Animated.View>
      ))}
    </ScrollView>
  );
}

function SeenList({
  shows,
  custom,
  ready,
  clearance,
  onUnsee,
  onRemoveCustom,
}: {
  shows: Show[];
  custom: readonly CustomWatchlistItem[];
  ready: boolean;
  /** Height of the tab bar plus the home indicator below it. */
  clearance: number;
  onUnsee: (showId: string) => void;
  onRemoveCustom: (id: string) => void;
}) {
  if (shows.length === 0 && custom.length === 0) {
    return (
      <EmptyState
        icon="checkmark-done-outline"
        title={ready ? 'עדיין לא סימנת הצגות' : 'טוען…'}
        text="החליקו הצגה מרשימת הצפייה, או הוסיפו אחת ידנית."
        clearance={clearance}
      />
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[
        styles.gridContent,
        // Tab bar, then the floating button sitting above it, then a gap on
        // each side of it — so the last row clears the button rather than
        // hiding behind it.
        { paddingBottom: clearance + FAB_SIZE + Spacing.four + Spacing.four },
      ]}
      showsVerticalScrollIndicator={false}>
      {/* The mirror of the swipe hint on the other list. Without it the tick
          reads as a label rather than a control, and there would be no way
          back out of this list at all. */}
      {shows.length > 0 ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>
          לחצו על הוי כדי להחזיר לרוצה לראות.
        </ThemedText>
      ) : null}

      <View style={styles.grid}>
        {/* Deliberately not swipeable, unlike the other list: that gesture
            only moves shows forward, and a swipe in a grid has no obvious
            direction to begin with.

            `layout` is the half that makes removal read as removal: without
            it the card vanishes and everything after it teleports into the
            gap. `ZoomOut` shrinks the card away rather than fading it, which
            in a grid looks like it was picked up off the shelf.

            `ReduceMotion.System` on every one of them — the same as the
            search screen's chips. Someone who has asked the OS for less
            motion gets the result instantly instead of the movement. */}
        {shows.map((show) => (
          <Animated.View
            key={show.id}
            style={styles.cell}
            entering={FadeIn.duration(ENTER_MS).reduceMotion(ReduceMotion.System)}
            exiting={ZoomOut.duration(EXIT_MS).reduceMotion(ReduceMotion.System)}
            layout={REFLOW}>
            <SeenShowCard show={show} onUnsee={() => onUnsee(show.id)} />
          </Animated.View>
        ))}

        {custom.map((item) => (
          <Animated.View
            key={item.id}
            style={styles.cell}
            entering={FadeIn.duration(ENTER_MS).reduceMotion(ReduceMotion.System)}
            exiting={ZoomOut.duration(EXIT_MS).reduceMotion(ReduceMotion.System)}
            layout={REFLOW}>
            <SeenCustomCard item={item} onRemove={() => onRemoveCustom(item.id)} />
          </Animated.View>
        ))}
      </View>
    </ScrollView>
  );
}

function EmptyState({
  icon,
  title,
  text,
  clearance,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  text: string;
  /**
   * Height of the tab bar plus the home indicator. This view fills the
   * screen and centres itself, and the screen now runs under the tab bar —
   * without this the text would be centred against the full height and sit
   * visibly low, partly behind the bar.
   */
  clearance: number;
}) {
  const theme = useTheme();
  return (
    <ThemedView style={[styles.emptyState, { paddingBottom: clearance }]}>
      <Ionicons name={icon} size={40} color={theme.textSecondary} />
      <ThemedText type="smallBold" style={styles.centered}>
        {title}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
        {text}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // Transparent so the app-wide <AnimatedGradientBackground/> (mounted in
    // the root layout, behind every screen) shows through.
    backgroundColor: 'transparent',
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    // No `paddingBottom`, on purpose. Padding here shortens the scroll
    // viewport rather than the scrolled content, which cuts the last row off
    // in a straight line above the tab bar and leaves dead space beneath it.
    // Each list adds its own bottom padding to its `contentContainerStyle`.
    gap: Spacing.three,
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
  },
  loadFailed: {
    paddingTop: Spacing.five,
    textAlign: 'center',
  },
  listContent: {
    gap: Spacing.four,
    // `paddingBottom` is applied at the call site — it depends on the device's
    // home indicator, which no static value knows about.
  },
  gridContent: {
    // `paddingBottom` is applied at the call site, for the same reason as
    // `listContent` — plus it has to clear the floating button too.
    gap: Spacing.three,
  },
  hint: {
    paddingBottom: Spacing.one,
  },
  cell: {
    // 48% twice plus `space-between`, rather than 50% and a gap: two 50%
    // columns and any gap between them overflow the row and wrap to one card
    // per line, which is how the search grid once collapsed on every device.
    width: '48%',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    // `space-between` plus 48% cards rather than a `columnGap`: two columns
    // and a gap overflow the row and wrap to one card per line.
    justifyContent: 'space-between',
    rowGap: Spacing.three,
  },
  fab: {
    position: 'absolute',
    // `insetInlineEnd`, not `left`. React Native's `doLeftAndRightSwapInRTL`
    // defaults to true, so a plain `left` is mirrored to the right under
    // `forceRTL` — which is exactly what it did, putting this button on the
    // wrong side. In RTL the inline-end edge IS the physical left one.
    insetInlineEnd: Spacing.four,
    // `bottom` is set at the call site from the measured tab bar clearance.
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    // Lifts the disc off the posters it floats over.
    shadowColor: '#000000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  row: {
    borderRadius: Spacing.three,
  },
  pressed: {
    opacity: 0.6,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    backgroundColor: 'transparent',
  },
  centered: {
    textAlign: 'center',
  },
});
