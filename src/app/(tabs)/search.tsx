import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ShowListItem } from '@/components/show-list-item';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, categoryTint, Spacing } from '@/constants/theme';
import { useHomeFeed } from '@/hooks/use-home-feed';
import { useRecentSearches } from '@/hooks/use-recent-searches';
import { useTheme } from '@/hooks/use-theme';
import type { Show } from '@/types/show';
import {
  addDays,
  showMatchesDateFilter,
  todayKey,
  weekendRange,
  type DateFilter,
} from '@/utils/date-filter';

type QuickFilter = 'today' | 'tomorrow' | 'weekend';

/**
 * The three one-tap filters under the search field.
 *
 * The reference app puts price brackets here ("Under $49"). This app's `Show`
 * has no price field at all, so those would be invented numbers attached to
 * nothing. Dates are the equivalent one-tap narrowing that *is* backed by real
 * data — `showtimes` — and they reuse the same helpers and the same
 * `showMatchesDateFilter` the Home screen's date sheet already runs on.
 */
const QUICK_FILTERS: { value: QuickFilter; label: string; toFilter: () => DateFilter }[] = [
  { value: 'today', label: 'היום', toFilter: () => ({ kind: 'day', day: todayKey() }) },
  { value: 'tomorrow', label: 'מחר', toFilter: () => ({ kind: 'day', day: addDays(todayKey(), 1) }) },
  { value: 'weekend', label: 'סופ״ש', toFilter: () => ({ kind: 'range', ...weekendRange() }) },
];

/**
 * Tab 2 — Search (`app/(tabs)/search.tsx`).
 *
 * Free-text search over the aggregated catalogue by show name, venue and
 * city, plus one-tap date filters and a category grid.
 *
 * Accepts a `category` route param, which is what the show-detail screen's
 * tappable genre tags navigate with. Before this screen read it those links
 * went nowhere — they pushed to a stub that ignored the parameter.
 */
export default function SearchScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ category?: string }>();
  const result = useHomeFeed();
  const { recent, record, clear } = useRecentSearches();

  const [query, setQuery] = useState('');
  const [quick, setQuick] = useState<QuickFilter | null>(null);
  // Seeded from the route param, then owned locally — so arriving from a
  // genre tag pre-filters the screen, but tapping another category here
  // still works normally rather than being pinned to the URL.
  const [category, setCategory] = useState<string | null>(params.category ?? null);

  const allShows = useMemo(
    () => (result.status === 'ready' ? result.feed.all : []),
    [result],
  );
  const categories = result.status === 'ready' ? result.feed.categories : [];

  const dateFilter = quick ? QUICK_FILTERS.find((f) => f.value === quick)!.toFilter() : null;
  const trimmed = query.trim();
  const isSearching = trimmed.length > 0 || quick !== null || category !== null;

  const results = useMemo(() => {
    if (!isSearching) return [];
    return allShows.filter((show) => {
      const matchesText =
        trimmed.length === 0 ||
        show.name.includes(trimmed) ||
        show.theater.name.includes(trimmed) ||
        show.theater.city.includes(trimmed);
      const matchesCategory = !category || show.categories.includes(category);
      const matchesDate = !dateFilter || showMatchesDateFilter(show, dateFilter);
      return matchesText && matchesCategory && matchesDate;
    });
    // `dateFilter` is rebuilt every render, so it can't be a dependency —
    // `quick`, which it is derived from, is the value that actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allShows, trimmed, category, quick, isSearching]);

  function clearAll() {
    setQuery('');
    setQuick(null);
    setCategory(null);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <SearchField
          value={query}
          onChangeText={setQuery}
          onSubmit={() => record(trimmed)}
          onClear={query.length > 0 ? () => setQuery('') : undefined}
        />

        <View style={styles.quickRow}>
          {QUICK_FILTERS.map((filter) => (
            <QuickChip
              key={filter.value}
              label={filter.label}
              selected={quick === filter.value}
              onPress={() => setQuick(quick === filter.value ? null : filter.value)}
            />
          ))}
        </View>

        {category ? (
          <Pressable onPress={() => setCategory(null)} accessibilityRole="button" style={styles.activeCategory}>
            <ThemedText type="small" themeColor="primary">
              קטגוריה: {category}
            </ThemedText>
            <Ionicons name="close-circle" size={16} color={theme.primary} />
          </Pressable>
        ) : null}

        {isSearching ? (
          <Results shows={results} onClear={clearAll} />
        ) : (
          <Browse
            categories={categories}
            recent={recent}
            onPickRecent={setQuery}
            onClearRecent={clear}
            onPickCategory={setCategory}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

function SearchField({
  value,
  onChangeText,
  onSubmit,
  onClear,
}: {
  value: string;
  onChangeText: (value: string) => void;
  onSubmit: () => void;
  onClear?: () => void;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.searchField, { borderColor: theme.backgroundSelected }]}>
      <Ionicons name="search-outline" size={20} color={theme.textSecondary} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        returnKeyType="search"
        placeholder="חיפוש הצגות, אולמות או ערים"
        placeholderTextColor={theme.textSecondary}
        style={[styles.searchInput, { color: theme.text }]}
        accessibilityLabel="חיפוש"
      />
      {onClear ? (
        <Pressable onPress={onClear} accessibilityRole="button" accessibilityLabel="ניקוי החיפוש" hitSlop={Spacing.two}>
          <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
        </Pressable>
      ) : null}
    </View>
  );
}

function QuickChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.quickChip,
        { backgroundColor: selected ? theme.primarySoft : theme.backgroundElement },
        selected && { borderColor: theme.primary },
        pressed && styles.pressed,
      ]}>
      <ThemedText type={selected ? 'smallBold' : 'small'} themeColor={selected ? 'primary' : 'text'}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function Results({ shows, onClear }: { shows: Show[]; onClear: () => void }) {
  if (shows.length === 0) {
    return (
      <View style={styles.emptyState}>
        <ThemedText type="smallBold" style={styles.centered}>
          לא נמצאו הצגות
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
          נסו שם אחר, או נקו את הסינון.
        </ThemedText>
        <Pressable onPress={onClear} accessibilityRole="button" style={({ pressed }) => [pressed && styles.pressed]}>
          <ThemedText type="smallBold" themeColor="primary">
            ניקוי הסינון
          </ThemedText>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.resultsContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <ThemedText type="small" themeColor="textSecondary">
        {shows.length} תוצאות
      </ThemedText>
      {shows.map((show) => (
        <ShowListItem key={show.id} show={show} />
      ))}
    </ScrollView>
  );
}

function Browse({
  categories,
  recent,
  onPickRecent,
  onClearRecent,
  onPickCategory,
}: {
  categories: string[];
  recent: readonly string[];
  onPickRecent: (query: string) => void;
  onClearRecent: () => void;
  onPickCategory: (category: string) => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.browseContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      {recent.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText type="subtitle" style={styles.sectionTitle}>
              חיפושים אחרונים
            </ThemedText>
            <Pressable onPress={onClearRecent} accessibilityRole="button" hitSlop={Spacing.two}>
              <ThemedText type="small" themeColor="primary">
                ניקוי
              </ThemedText>
            </Pressable>
          </View>

          {/* A plain list, as in the reference — not chips. These are things
              the user typed, of unpredictable length; pills would wrap into a
              ragged block and read as filters rather than history. */}
          {recent.map((entry) => (
            <Pressable
              key={entry}
              onPress={() => onPickRecent(entry)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.recentRow, pressed && styles.pressed]}>
              <ThemedText themeColor="textSecondary" numberOfLines={1}>
                {entry}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      ) : null}

      {categories.length > 0 ? (
        <View style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            עיון לפי קטגוריה
          </ThemedText>

          <View style={styles.grid}>
            {categories.map((name) => (
              <CategoryCard key={name} name={name} onPress={() => onPickCategory(name)} />
            ))}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

function CategoryCard({ name, onPress }: { name: string; onPress: () => void }) {
  const theme = useTheme();
  const [from, to] = categoryTint(name);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`הצגות בקטגוריה ${name}`}
      style={({ pressed }) => [styles.categoryCard, pressed && styles.pressed]}>
      <LinearGradient colors={[from, to]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
      <ThemedText type="smallBold" style={[styles.categoryLabel, { color: theme.onImage }]} numberOfLines={2}>
        {name}
      </ThemedText>
    </Pressable>
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
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Spacing.five,
    borderWidth: 1,
    paddingHorizontal: Spacing.four,
  },
  searchInput: {
    flex: 1,
    paddingVertical: Spacing.three,
    // RN defaults to 'left'; the rest of the app right-aligns through
    // `ThemedText`, which a raw `TextInput` doesn't go through.
    textAlign: 'right',
  },
  quickRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  quickChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  activeCategory: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  resultsContent: {
    gap: Spacing.four,
    paddingBottom: Spacing.five,
  },
  browseContent: {
    gap: Spacing.five,
    paddingBottom: Spacing.five,
  },
  section: {
    gap: Spacing.two,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    fontSize: 20,
    lineHeight: 26,
  },
  recentRow: {
    paddingVertical: Spacing.two,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  categoryCard: {
    // Two per row: half the width, minus half the gap between them.
    width: '48%',
    flexGrow: 1,
    aspectRatio: 2,
    borderRadius: Spacing.three,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    padding: Spacing.three,
  },
  categoryLabel: {
    fontSize: 16,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  centered: {
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});
