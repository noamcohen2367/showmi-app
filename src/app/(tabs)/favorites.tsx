import Ionicons from '@expo/vector-icons/Ionicons';
import { GlassView } from 'expo-glass-effect';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  LinearTransition,
  ReduceMotion,
  ZoomOut,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AddSeenSheet } from '@/components/add-seen-sheet';
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
  const result = useHomeFeed();
  const {
    wantIds,
    seenIds,
    customWant,
    customSeen,
    setStatus,
    setStatusMany,
    addCustom,
    remove,
    ready,
    loadFailed,
  } = useWatchlist();
  const [segment, setSegment] = useState<Segment>('want');
  const [addSheetOpen, setAddSheetOpen] = useState(false);

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

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
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
          <ThemedText themeColor="textSecondary" style={styles.loadFailed}>
            לא הצלחנו לטעון את הרשימה. בדוק את החיבור ונסה שוב.
          </ThemedText>
        ) : segment === 'want' ? (
          <WantList shows={want} ready={ready} onMarkSeen={(id) => setStatus(id, 'seen')} />
        ) : (
          <SeenList
            shows={seen}
            custom={customSeen}
            ready={ready}
            onUnsee={(id) => setStatus(id, 'want')}
            onRemoveCustom={remove}
          />
        )}
      </SafeAreaView>

      {/* Floating, and only over the "seen" list — it is the one place where
          adding by hand makes sense, and a button that persisted across both
          segments would imply it did something different in each.

          `left`, not `insetInlineStart`: this one is pinned to a physical
          side because that is what was asked for, and under `forceRTL` the
          logical property would put it on the right. */}
      {segment === 'seen' && !loadFailed ? (
        <GlassView
          glassEffectStyle="regular"
          tintColor={theme.background}
          style={[styles.fab, { backgroundColor: theme.background + 'D9' }]}>
          <Pressable
            onPress={() => setAddSheetOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="הוספת הצגה שראיתי"
            style={({ pressed }) => [styles.fabPress, pressed && styles.pressed]}>
            <Ionicons name="add" size={28} color={theme.primary} />
          </Pressable>
        </GlassView>
      ) : null}

      <AddSeenSheet
        visible={addSheetOpen}
        onClose={() => setAddSheetOpen(false)}
        shows={allShows}
        seenIds={seenIds}
        onAdd={(ids) => setStatusMany(ids, 'seen')}
        onAddCustom={(name, note) => addCustom({ name, note }, 'seen')}
      />
    </ThemedView>
  );
}

function WantList({
  shows,
  ready,
  onMarkSeen,
}: {
  shows: Show[];
  ready: boolean;
  onMarkSeen: (showId: string) => void;
}) {
  if (shows.length === 0) {
    return (
      <EmptyState
        icon="bookmark-outline"
        title={ready ? 'אין כאן עדיין הצגות' : 'טוען…'}
        text="שמרו הצגה מהבית או מהחיפוש והיא תופיע כאן."
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
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
  onUnsee,
  onRemoveCustom,
}: {
  shows: Show[];
  custom: readonly CustomWatchlistItem[];
  ready: boolean;
  onUnsee: (showId: string) => void;
  onRemoveCustom: (id: string) => void;
}) {
  if (shows.length === 0 && custom.length === 0) {
    return (
      <EmptyState
        icon="checkmark-done-outline"
        title={ready ? 'עדיין לא סימנת הצגות' : 'טוען…'}
        text="החליקו הצגה מרשימת הצפייה, או הוסיפו אחת ידנית."
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.gridContent} showsVerticalScrollIndicator={false}>
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
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  text: string;
}) {
  const theme = useTheme();
  return (
    <ThemedView style={styles.emptyState}>
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
    paddingBottom: BottomTabInset + Spacing.three,
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
    paddingBottom: Spacing.five,
  },
  gridContent: {
    // Clears the floating button, so the last row is never stuck underneath it.
    paddingBottom: Spacing.six + Spacing.four,
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
    // Physically left, as asked. `insetInlineStart` would put it on the right
    // under `forceRTL`, which is the opposite of what was wanted.
    left: Spacing.four,
    bottom: BottomTabInset + Spacing.four,
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
  },
  fabPress: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
