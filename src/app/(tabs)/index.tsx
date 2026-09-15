import { useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CategoryFilterSheet } from '@/components/category-filter-sheet';
import { DateFilterSheet } from '@/components/date-filter-sheet';
import { HomeTopBar } from '@/components/home-top-bar';
import { HorizontalShowSection } from '@/components/horizontal-show-section';
import { PromoBanner } from '@/components/promo-banner';
import { ShowListItem } from '@/components/show-list-item';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useHomeFeed } from '@/hooks/use-home-feed';
import { NO_DATE_FILTER, showMatchesDateFilter, type DateFilter } from '@/utils/date-filter';
import type { HomeFeed } from '@/data/shows';

/**
 * Tab 1 — Home/Discover (`app/(tabs)/index.tsx`).
 *
 * This is the feature itself, not a stub: `useHomeFeed` (backed today by
 * local mock data in `src/data/shows.ts`) returns 3 curated horizontal
 * sections ("suggested for you" / "new" / "trending"), the set of
 * categories, and the full show list — this screen just lays that out and
 * owns the one piece of local state (which category, if any, is selected).
 *
 * Tapping a show doesn't navigate anywhere yet — the show-detail screen
 * (hero image, synopsis, a "book" button into a date picker) is next
 * phase's work, deliberately not built here yet.
 */
export default function DiscoverScreen() {
  const result = useHomeFeed();
  const [dateFilter, setDateFilter] = useState<DateFilter>(NO_DATE_FILTER);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [dateSheetOpen, setDateSheetOpen] = useState(false);
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);

  const filteredShows = useMemo(() => {
    if (result.status !== 'ready') return [];
    return result.feed.all.filter((show) => {
      // Categories are OR'd within themselves but AND'd against the date:
      // picking "מחזמר" + "ילדים" + "מחר" means "a musical or a kids' show,
      // playing tomorrow" — which is what selecting both of each implies.
      const matchesCategory =
        categoryFilter.length === 0 ||
        show.categories.some((category) => categoryFilter.includes(category));
      return matchesCategory && showMatchesDateFilter(show, dateFilter);
    });
  }, [result, categoryFilter, dateFilter]);

  // Read off the feed rather than hardcoded. The reference's pill names one
  // city because that app scopes its whole catalogue to it; this app has no
  // location filter at all, and its shows span several cities — so naming
  // one of them would imply a scope that doesn't exist. If the data ever
  // does narrow to a single city, the pill says so on its own.
  const locationLabel = useMemo(() => {
    if (result.status !== 'ready') return '';
    const cities = new Set(result.feed.all.map((show) => show.theater.city));
    return cities.size === 1 ? [...cities][0] : 'כל הערים';
  }, [result]);

  if (result.status === 'loading') {
    return (
      <CenteredState>
        <ActivityIndicator />
      </CenteredState>
    );
  }

  if (result.status === 'error') {
    return (
      <CenteredState>
        <ThemedText themeColor="textSecondary">
          אירעה שגיאה בטעינת ההצגות. נסו שוב מאוחר יותר.
        </ThemedText>
      </CenteredState>
    );
  }

  const { feed } = result;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Outside the list, so it stays put while the feed scrolls under it —
          the reference's top bar is fixed, and this also stops the bar from
          being rebuilt every time the list header re-renders. The page's
          old "גלה" title is gone: the reference has no screen heading, the
          bar is the heading. */}
      <View style={styles.topBar}>
        <HomeTopBar
          locationLabel={locationLabel}
          dateFilter={dateFilter}
          categoryFilter={categoryFilter}
          onOpenDateFilter={() => setDateSheetOpen(true)}
          onOpenCategoryFilter={() => setCategorySheetOpen(true)}
          onClearAll={() => {
            setDateFilter(NO_DATE_FILTER);
            setCategoryFilter([]);
          }}
        />
      </View>

      <DateFilterSheet
        visible={dateSheetOpen}
        onClose={() => setDateSheetOpen(false)}
        value={dateFilter}
        onApply={setDateFilter}
      />

      <CategoryFilterSheet
        visible={categorySheetOpen}
        onClose={() => setCategorySheetOpen(false)}
        categories={feed.categories}
        value={categoryFilter}
        onApply={setCategoryFilter}
      />

      <FlatList
        style={styles.list}
        data={filteredShows}
        keyExtractor={(show) => show.id}
        renderItem={({ item }) => (
          <View style={styles.listItemWrapper}>
            <ShowListItem show={item} />
          </View>
        )}
        ItemSeparatorComponent={() => <View style={styles.listSeparator} />}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={<FeedHeader feed={feed} />}
        ListEmptyComponent={
          <ThemedText themeColor="textSecondary" style={styles.emptyFilterText}>
            אין הצגות בקטגוריה הזו כרגע.
          </ThemedText>
        }
      />
    </SafeAreaView>
  );
}

/**
 * Everything above the "all shows" list: the hero promo carousel and the 3
 * curated rows.
 *
 * A component rather than the inline JSX element this used to be — an
 * element is rebuilt on every render of the screen, which means every
 * category tap was rebuilding the carousel and all 3 horizontal lists even
 * though none of them depend on the selected category.
 */
function FeedHeader({ feed }: { feed: HomeFeed }) {
  return (
    <View style={styles.header}>
      <PromoBanner promos={feed.promos} />

      <HorizontalShowSection title="מוצעים עבורך" shows={feed.suggested} variant="featured" />
      <HorizontalShowSection title="חדש ומעניין" shows={feed.fresh} />
      <HorizontalShowSection title="מובילים" shows={feed.trending} />

      <ThemedText type="subtitle" style={styles.allShowsTitle}>
        כל ההצגות
      </ThemedText>
    </View>
  );
}

function CenteredState({ children }: { children: ReactNode }) {
  return (
    <ThemedView style={styles.centered}>
      <SafeAreaView style={styles.centeredInner}>{children}</SafeAreaView>
    </ThemedView>
  );
}

// `CategoriesRow` used to live here. It moved into `HomeTopBar`, where the
// same chips now sit beside the location pill instead of below the carousel.
// Its old mirroring applied `rtlMirror` to the ScrollView *and* its
// `contentContainerStyle`, which double-flips the content as one block —
// a different technique from the per-item flip `HorizontalShowSection`
// uses, despite its comment claiming they were the same. `HomeTopBar`
// uses the per-item version.

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  list: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  listContent: {
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
  // The top bar sits above the list now, so it owns the spacing that used
  // to be `header`'s `paddingTop` (which existed to push the old "גלה"
  // title down off the safe area — there's no title here any more).
  topBar: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
  },
  header: {
    gap: Spacing.five,
    paddingBottom: Spacing.two,
  },
  allShowsTitle: {
    fontSize: 20,
    lineHeight: 26,
    paddingHorizontal: Spacing.four,
  },
  listItemWrapper: {
    paddingHorizontal: Spacing.four,
  },
  listSeparator: {
    height: Spacing.four,
  },
  emptyFilterText: {
    paddingHorizontal: Spacing.four,
    textAlign: 'center',
  },
  centered: {
    flex: 1,
  },
  centeredInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.five,
  },
  rtlMirror: {
    transform: [{ scaleX: -1 }],
  },
});
