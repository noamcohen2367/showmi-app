import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ShowListItem } from '@/components/show-list-item';
import { SwipeToSeen } from '@/components/swipe-to-seen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useHomeFeed } from '@/hooks/use-home-feed';
import { useTheme } from '@/hooks/use-theme';
import { useWatchlist } from '@/hooks/use-watchlist';
import type { Show } from '@/types/show';

/**
 * Tab 3 — the watchlist (`app/(tabs)/favorites.tsx`).
 *
 * Split in two, as the Home screen's "רשימת צפייה" chip promises: shows the
 * user still wants to see, and shows they've already seen. A row in the
 * first section is swiped towards the start edge to move it into the second
 * — see `SwipeToSeen` for why the gesture is defined against the layout's
 * start edge rather than as "swipe right".
 *
 * The list stores *ids*; the shows themselves come from the same
 * `useHomeFeed` every other screen uses, so there's no second source of show
 * data to keep in sync. A saved id with no matching show (deleted upstream,
 * say) simply doesn't render rather than erroring.
 */
export default function WatchlistScreen() {
  const theme = useTheme();
  const result = useHomeFeed();
  const { wantIds, seenIds, setStatus, ready } = useWatchlist();

  const byId = useMemo(() => {
    if (result.status !== 'ready') return new Map<string, Show>();
    return new Map(result.feed.all.map((show) => [show.id, show]));
  }, [result]);

  const want = wantIds.map((id) => byId.get(id)).filter((show): show is Show => !!show);
  const seen = seenIds.map((id) => byId.get(id)).filter((show): show is Show => !!show);
  const isEmpty = want.length === 0 && seen.length === 0;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title" style={styles.title}>
          רשימת צפייה
        </ThemedText>

        {isEmpty ? (
          <ThemedView style={styles.emptyState}>
            <Ionicons name="heart-outline" size={40} color={theme.textSecondary} />
            <ThemedText type="smallBold" style={styles.emptyStateTitle}>
              {ready ? 'הרשימה ריקה' : 'טוען…'}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.emptyStateText}>
              שמרו הצגה מהבית או מהחיפוש והיא תופיע כאן.
            </ThemedText>
          </ThemedView>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {want.length > 0 ? (
              <View style={styles.section}>
                <ThemedText type="subtitle" style={styles.sectionTitle}>
                  רוצה לראות
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  החליקו שורה הצידה כדי לסמן שראיתם.
                </ThemedText>

                {want.map((show) => (
                  <SwipeToSeen key={show.id} onTriggered={() => setStatus(show.id, 'seen')}>
                    <ThemedView style={styles.row}>
                      <ShowListItem show={show} />
                    </ThemedView>
                  </SwipeToSeen>
                ))}
              </View>
            ) : null}

            {seen.length > 0 ? (
              <View style={styles.section}>
                <ThemedText type="subtitle" style={styles.sectionTitle}>
                  ראיתי
                </ThemedText>
                {seen.map((show) => (
                  // Deliberately not swipeable: the reference's gesture only
                  // moves shows forward, and a swipe here would have to guess
                  // whether the user meant "un-see" or "remove".
                  <View key={show.id} style={styles.seenRow}>
                    <ShowListItem show={show} />
                  </View>
                ))}
              </View>
            ) : null}
          </ScrollView>
        )}
      </SafeAreaView>
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
    gap: Spacing.four,
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
  },
  scrollContent: {
    gap: Spacing.five,
    paddingBottom: Spacing.five,
  },
  section: {
    gap: Spacing.three,
  },
  sectionTitle: {
    fontSize: 20,
    lineHeight: 26,
  },
  row: {
    // Opaque, so the swipe reveal behind it stays hidden until the row moves.
    borderRadius: Spacing.three,
  },
  seenRow: {
    opacity: 0.6,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    backgroundColor: 'transparent',
  },
  emptyStateTitle: {
    textAlign: 'center',
  },
  emptyStateText: {
    textAlign: 'center',
  },
});
