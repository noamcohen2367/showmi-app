import { useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  FlatList,
  I18nManager,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CategoryChip } from '@/components/category-chip';
import { HorizontalShowSection } from '@/components/horizontal-show-section';
import { PromoBanner } from '@/components/promo-banner';
import { ShowListItem } from '@/components/show-list-item';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useHomeFeed } from '@/hooks/use-home-feed';

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
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filteredShows = useMemo(() => {
    if (result.status !== 'ready') return [];
    if (!selectedCategory) return result.feed.all;
    return result.feed.all.filter((show) =>
      show.categories.includes(selectedCategory),
    );
  }, [result, selectedCategory]);

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
        ListHeaderComponent={
          <View style={styles.header}>
            <ThemedText type="title" style={styles.pageTitle}>
              גלה
            </ThemedText>

            <PromoBanner promos={feed.promos} />

            <HorizontalShowSection
              title="מוצעים עבורך"
              shows={feed.suggested}
            />
            <HorizontalShowSection title="חדש ומעניין" shows={feed.fresh} />
            <HorizontalShowSection title="מובילים" shows={feed.trending} />

            <CategoriesRow
              categories={feed.categories}
              selected={selectedCategory}
              onSelect={setSelectedCategory}
            />

            <ThemedText type="subtitle" style={styles.allShowsTitle}>
              כל ההצגות
            </ThemedText>
          </View>
        }
        ListEmptyComponent={
          <ThemedText themeColor="textSecondary" style={styles.emptyFilterText}>
            אין הצגות בקטגוריה הזו כרגע.
          </ThemedText>
        }
      />
    </SafeAreaView>
  );
}

function CenteredState({ children }: { children: ReactNode }) {
  return (
    <ThemedView style={styles.centered}>
      <SafeAreaView style={styles.centeredInner}>{children}</SafeAreaView>
    </ThemedView>
  );
}

type CategoriesRowProps = {
  categories: string[];
  selected: string | null;
  onSelect: (category: string | null) => void;
};

function CategoriesRow({ categories, selected, onSelect }: CategoriesRowProps) {
  // Same native RTL scroll-direction fix as `HorizontalShowSection` — see
  // its comment for why a plain horizontal `ScrollView`/`FlatList` needs
  // this on native but not on web.
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={I18nManager.isRTL ? styles.rtlMirror : undefined}
      contentContainerStyle={[
        styles.categoriesContent,
        I18nManager.isRTL && styles.rtlMirror,
      ]}
    >
      <CategoryChip
        label="הכול"
        selected={selected === null}
        onPress={() => onSelect(null)}
      />
      {categories.map((category) => (
        <CategoryChip
          key={category}
          label={category}
          selected={selected === category}
          onPress={() => onSelect(selected === category ? null : category)}
        />
      ))}
    </ScrollView>
  );
}

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
  header: {
    gap: Spacing.five,
    // This was missing before — every other screen's title sits
    // `Spacing.five` below the safe area via its own `safeArea` style; this
    // screen's title is inside the FlatList's header instead, which had no
    // equivalent top spacing of its own, so it sat noticeably higher than
    // the other 3 tabs' titles.
    paddingTop: Spacing.five,
    paddingBottom: Spacing.two,
  },
  pageTitle: {
    fontSize: 34,
    lineHeight: 40,
    paddingHorizontal: Spacing.four,
  },
  categoriesContent: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
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
