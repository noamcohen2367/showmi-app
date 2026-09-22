import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState, type RefObject } from 'react';
import { I18nManager, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInLeft,
  FadeInRight,
  ReduceMotion,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
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

/** Entry duration for search mode's controls. Short, and no overshoot. */
const ENTRY_MS = 180;

/** The large title's height, and how far you scroll before it's fully gone. */
const TITLE_HEIGHT = 40;
const TITLE_COLLAPSE_DISTANCE = 56;

/**
 * The worklet `useAnimatedScrollHandler` produces. Both lists take one so the
 * collapsing title tracks whichever is on screen, without either of them
 * knowing what it drives.
 */
type ScrollHandler = ReturnType<typeof useAnimatedScrollHandler>;

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
  // Whether the field has focus — which is what the screen's two modes hinge
  // on. At rest the screen is for browsing; once the keyboard is up it is for
  // searching, and the category grid gives its space to results.
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Scroll offset, kept on the UI thread so the title collapses in step with
  // the finger instead of a frame behind it.
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const titleStyle = useAnimatedStyle(() => {
    // Clamped, so over-scrolling past the top can't invert it and a long
    // scroll can't keep shrinking something already gone.
    const progress = Math.min(1, Math.max(0, scrollY.value / TITLE_COLLAPSE_DISTANCE));
    return {
      height: TITLE_HEIGHT * (1 - progress),
      opacity: 1 - progress,
      // Rises as it goes, so it reads as folding up behind the field rather
      // than simply being deleted.
      transform: [{ translateY: -TITLE_HEIGHT * 0.35 * progress }],
    };
  });
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

  /**
   * Leaves search mode. Reached three ways, all of which mean the same thing:
   * the cancel button, the keyboard's search key, and a tap on empty space.
   *
   * Blurring is what actually dismisses the keyboard; `setFocused(false)` only
   * mirrors it for rendering. Both are needed — `onBlur` fires for the first
   * two, but a tap on dead space has to drive the input directly.
   */
  function exitSearch() {
    // Record here, not only on the keyboard's search key. Results update as
    // you type, so there was never a reason to press it — which meant the
    // recents list could never fill up, and the whole section looked broken.
    // Leaving search mode with something typed *is* the completed search.
    if (trimmed) record(trimmed);
    inputRef.current?.blur();
    setFocused(false);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Folds away as the list moves up, leaving the field pinned. This is
            the platform's own large-title behaviour rather than an effect:
            it is driven by scroll position, not by a timer, so it tracks the
            finger and reverses the moment you scroll back. */}
        <Animated.View style={titleStyle}>
          <ThemedText type="title" style={styles.title} numberOfLines={1}>
            חיפוש
          </ThemedText>
        </Animated.View>

        <SearchField
          inputRef={inputRef}
          value={query}
          onChangeText={setQuery}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmit={exitSearch}
          onCancel={focused ? exitSearch : undefined}
          onClear={query.length > 0 ? () => setQuery('') : undefined}
        />

        {/* Only while the keyboard is up. At rest they were three permanent
            controls competing with the category grid for the same attention;
            they belong to the act of searching, so they arrive with it. */}
        {focused ? <QuickFilterRow selected={quick} onSelect={setQuick} /> : null}

        {category ? (
          <Pressable onPress={() => setCategory(null)} accessibilityRole="button" style={styles.activeCategory}>
            <ThemedText type="small" themeColor="primary">
              קטגוריה: {category}
            </ThemedText>
            <Ionicons name="close-circle" size={16} color={theme.primary} />
          </Pressable>
        ) : null}

        {isSearching ? (
          <Results shows={results} onClear={clearAll} onScroll={scrollHandler} onDismiss={exitSearch} />
        ) : (
          <Browse
            // The grid steps aside once the keyboard is up, so results have
            // the room. Recent searches stay: they are the fastest way to
            // fill a field you have just focused.
            categories={focused ? [] : categories}
            recent={recent}
            onPickRecent={setQuery}
            onClearRecent={clear}
            onPickCategory={setCategory}
            onScroll={scrollHandler}
            onDismiss={exitSearch}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

function SearchField({
  inputRef,
  value,
  onChangeText,
  onFocus,
  onBlur,
  onSubmit,
  onCancel,
  onClear,
}: {
  inputRef: RefObject<TextInput | null>;
  value: string;
  onChangeText: (value: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  onSubmit: () => void;
  /** Present only while focused; leaves search mode. */
  onCancel?: () => void;
  onClear?: () => void;
}) {
  const theme = useTheme();

  return (
    <View style={styles.searchRow}>
      <View style={[styles.searchField, { borderColor: theme.backgroundSelected }]}>
        <Ionicons name="search-outline" size={20} color={theme.textSecondary} />
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          onFocus={onFocus}
          onBlur={onBlur}
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

      {/* Enters from the trailing edge, alongside the chips below it — the
          same gesture, so the whole search mode arrives as one move. */}
      {onCancel ? (
        <Animated.View
          entering={(I18nManager.isRTL ? FadeInRight : FadeInLeft)
            .duration(ENTRY_MS)
            .reduceMotion(ReduceMotion.System)}>
          <Pressable onPress={onCancel} accessibilityRole="button" hitSlop={Spacing.two}>
            <ThemedText type="small" themeColor="primary">
              ביטול
            </ThemedText>
          </Pressable>
        </Animated.View>
      ) : null}
    </View>
  );
}

/**
 * The three date chips, entering from the edge each one sits nearest.
 *
 * The outer chips slide in from their own side and the middle one just
 * fades, so the row assembles toward its centre rather than marching in from
 * one end. 180ms with no overshoot — this is a control appearing, not an
 * effect.
 *
 * `translateX` is not mirrored by `I18nManager`, so the sign has to be
 * flipped by hand: under RTL the first chip is the rightmost one, and
 * "nearest edge" means the opposite direction from LTR.
 */
function QuickFilterRow({
  selected,
  onSelect,
}: {
  selected: QuickFilter | null;
  onSelect: (value: QuickFilter | null) => void;
}) {
  const middle = (QUICK_FILTERS.length - 1) / 2;

  return (
    <View style={styles.quickRow}>
      {QUICK_FILTERS.map((filter, index) => {
        const side = Math.sign(index - middle) * (I18nManager.isRTL ? -1 : 1);
        const entering = (side > 0 ? FadeInRight : side < 0 ? FadeInLeft : FadeIn)
          .duration(ENTRY_MS)
          // Honours the OS setting, the same as the ambient gradient does.
          .reduceMotion(ReduceMotion.System);

        return (
          <Animated.View key={filter.value} entering={entering} style={styles.quickChipWrapper}>
            <QuickChip
              label={filter.label}
              selected={selected === filter.value}
              onPress={() => onSelect(selected === filter.value ? null : filter.value)}
            />
          </Animated.View>
        );
      })}
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

function Results({
  shows,
  onClear,
  onScroll,
  onDismiss,
}: {
  shows: Show[];
  onClear: () => void;
  onScroll: ScrollHandler;
  onDismiss: () => void;
}) {
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
    <Animated.ScrollView
      contentContainerStyle={styles.resultsContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      // Dragging the list puts the keyboard away, which is what a reader
      // scrolling results wants anyway.
      keyboardDismissMode="on-drag"
      onScroll={onScroll}
      scrollEventThrottle={16}>
      <ThemedText type="small" themeColor="textSecondary">
        {shows.length} תוצאות
      </ThemedText>
      {shows.map((show) => (
        <ShowListItem key={show.id} show={show} />
      ))}
      <DismissFiller onPress={onDismiss} />
    </Animated.ScrollView>
  );
}

/**
 * The "tap empty space to leave search" target.
 *
 * Inside the scroll content and growing to fill whatever is left, rather than
 * wrapped around the list. Wrapping it was the first attempt, and the
 * `Pressable` swallowed the scroll gesture outright — the category grid
 * simply could not be scrolled to, which looked like the grid being cut off.
 */
function DismissFiller({ onPress }: { onPress: () => void }) {
  return <Pressable style={styles.dismissFiller} onPress={onPress} accessible={false} />;
}

function Browse({
  categories,
  recent,
  onPickRecent,
  onClearRecent,
  onPickCategory,
  onScroll,
  onDismiss,
}: {
  categories: string[];
  recent: readonly string[];
  onPickRecent: (query: string) => void;
  onClearRecent: () => void;
  onPickCategory: (category: string) => void;
  onScroll: ScrollHandler;
  onDismiss: () => void;
}) {
  return (
    <Animated.ScrollView
      contentContainerStyle={styles.browseContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      onScroll={onScroll}
      scrollEventThrottle={16}>
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

      {/* No heading over the grid: the cards name their own categories, so a
          label above them only repeats what they already say. */}
      {categories.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.grid}>
            {categories.map((name) => (
              <CategoryCard key={name} name={name} onPress={() => onPickCategory(name)} />
            ))}
          </View>
        </View>
      ) : null}

      <DismissFiller onPress={onDismiss} />
    </Animated.ScrollView>
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
    // No bottom padding. It used to reserve room for the tab bar here, which
    // ended the *scroll viewport* above the bar and left a dead black band
    // the list could never reach into — the last card was clipped with empty
    // space below it. The inset moved into each list's own
    // `contentContainerStyle`, so the list now runs to the screen's edge and
    // only its content stops clear of the bar.
    gap: Spacing.three,
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  searchField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Spacing.five,
    borderWidth: 1,
    paddingHorizontal: Spacing.four,
  },
  quickChipWrapper: {
    // Each chip animates on its own wrapper, so the row's own layout is
    // untouched by the entrance.
    flexShrink: 1,
  },
  dismissFiller: {
    // Grows into whatever the content leaves over, so "empty space" is a real
    // target even on a short list — and nothing at all when the list is long.
    flexGrow: 1,
    minHeight: Spacing.six,
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
    // Clears the floating tab bar. On the content, not the viewport, so the
    // list scrolls the whole height of the screen.
    paddingBottom: BottomTabInset + Spacing.four,
  },
  browseContent: {
    gap: Spacing.five,
    paddingBottom: BottomTabInset + Spacing.four,
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
    // The columns are spaced by `space-between` rather than a `gap`. A 16pt
    // column gap on top of two 48% cards overflows the track on every phone
    // size — 347pt of an available 345 on an iPhone 15 — so the row wrapped
    // to one card, and `flexGrow` then stretched that card to full width.
    // Letting the leftover 4% be the gutter can't overflow by construction.
    justifyContent: 'space-between',
    rowGap: Spacing.three,
  },
  categoryCard: {
    width: '48%',
    // Deliberately no `flexGrow`: it is what turned a lone wrapped card into
    // a full-width banner instead of leaving a half-width gap.
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
    // Not in a scroll view, so it carries the tab-bar inset itself — without
    // it the "no results" text centres against the screen and sits under the
    // floating bar.
    paddingBottom: BottomTabInset,
  },
  centered: {
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});
