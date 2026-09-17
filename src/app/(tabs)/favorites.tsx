import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AddSeenSheet } from '@/components/add-seen-sheet';
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
  const result = useHomeFeed();
  const { wantIds, seenIds, customWant, customSeen, setStatus, addCustom, remove, ready } =
    useWatchlist();
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

        {segment === 'want' ? (
          <WantList shows={want} ready={ready} onMarkSeen={(id) => setStatus(id, 'seen')} />
        ) : (
          <SeenList
            shows={seen}
            custom={customSeen}
            ready={ready}
            onAdd={() => setAddSheetOpen(true)}
            onRemoveCustom={remove}
          />
        )}
      </SafeAreaView>

      <AddSeenSheet
        visible={addSheetOpen}
        onClose={() => setAddSheetOpen(false)}
        shows={allShows}
        seenIds={seenIds}
        onAdd={(ids) => ids.forEach((id) => setStatus(id, 'seen'))}
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

      {shows.map((show) => (
        <SwipeToSeen key={show.id} onTriggered={() => onMarkSeen(show.id)}>
          <ThemedView style={styles.row}>
            <ShowListItem show={show} />
          </ThemedView>
        </SwipeToSeen>
      ))}
    </ScrollView>
  );
}

function SeenList({
  shows,
  custom,
  ready,
  onAdd,
  onRemoveCustom,
}: {
  shows: Show[];
  custom: readonly CustomWatchlistItem[];
  ready: boolean;
  onAdd: () => void;
  onRemoveCustom: (id: string) => void;
}) {
  const theme = useTheme();
  const isEmpty = shows.length === 0 && custom.length === 0;

  return (
    <>
      {/* Above the list rather than floating over it: this list can be empty
          on a first visit, and a button that only appears once there is
          something to scroll would hide the one action that fills it. */}
      <Pressable
        onPress={onAdd}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.addButton,
          { borderColor: theme.primary },
          pressed && styles.pressed,
        ]}>
        <Ionicons name="add" size={18} color={theme.primary} />
        <ThemedText type="smallBold" themeColor="primary">
          הוספת הצגה שראיתי
        </ThemedText>
      </Pressable>

      {isEmpty ? (
        <EmptyState
          icon="checkmark-done-outline"
          title={ready ? 'עדיין לא סימנת הצגות' : 'טוען…'}
          text="החליקו הצגה מרשימת הצפייה, או הוסיפו אחת ידנית."
        />
      ) : (
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {shows.map((show) => (
            // Deliberately not swipeable: the gesture only moves shows
            // forward, and a swipe here would have to guess whether the user
            // meant "un-see" or "remove".
            <View key={show.id} style={styles.seenRow}>
              <ShowListItem show={show} />
            </View>
          ))}

          {custom.map((item) => (
            <CustomSeenRow key={item.id} item={item} onRemove={() => onRemoveCustom(item.id)} />
          ))}
        </ScrollView>
      )}
    </>
  );
}

/**
 * A hand-typed entry in the seen list.
 *
 * Its own row rather than `ShowListItem`, because there is no `Show` behind
 * it — no poster, no venue record, no showtimes, and nowhere to navigate to.
 * A glyph stands in for the missing artwork instead of a broken image, and
 * the row carries a delete button since a typo here can't be fixed by
 * un-saving a catalogue entry.
 */
function CustomSeenRow({
  item,
  onRemove,
}: {
  item: CustomWatchlistItem;
  onRemove: () => void;
}) {
  const theme = useTheme();

  return (
    <View style={styles.customRow}>
      <View style={[styles.customThumb, { backgroundColor: theme.backgroundElement }]}>
        <Ionicons name="ticket-outline" size={22} color={theme.textSecondary} />
      </View>

      <View style={styles.customRowText}>
        <ThemedText type="smallBold" numberOfLines={2}>
          {item.name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {item.note ?? 'נוסף ידנית'}
        </ThemedText>
      </View>

      <Pressable
        onPress={onRemove}
        accessibilityRole="button"
        accessibilityLabel={`הסרת ${item.name}`}
        hitSlop={Spacing.three}
        style={({ pressed }) => [pressed && styles.pressed]}>
        <Ionicons name="close" size={20} color={theme.textSecondary} />
      </Pressable>
    </View>
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
  listContent: {
    gap: Spacing.four,
    paddingBottom: Spacing.five,
  },
  row: {
    borderRadius: Spacing.three,
  },
  seenRow: {
    opacity: 0.6,
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    opacity: 0.6,
  },
  customThumb: {
    // Matches ShowListItem's poster footprint, so hand-typed rows line up
    // with catalogue ones instead of sitting at a different indent.
    width: 72,
    aspectRatio: 2 / 3,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customRowText: {
    flex: 1,
    gap: 2,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
    // Dashed, so it reads as "add something here" rather than as the screen's
    // primary action — the primary action is still saving shows from Home.
    borderStyle: 'dashed',
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
