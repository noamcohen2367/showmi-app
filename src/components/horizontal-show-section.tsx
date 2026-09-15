import { FlatList, I18nManager, StyleSheet, View } from 'react-native';

import { FeaturedShowCard } from './featured-show-card';
import { ShowCard } from './show-card';
import { ThemedText } from './themed-text';

import { Spacing } from '@/constants/theme';
import type { Show } from '@/types/show';

type HorizontalShowSectionProps = {
  title: string;
  shows: Show[];
  /**
   * `compact` is the default poster row. `featured` swaps in the
   * double-width card with its details overlaid on the artwork — meant for
   * one lead row per screen, not for every row, since the whole point is
   * that it outweighs the rows around it.
   */
  variant?: 'compact' | 'featured';
};

/**
 * One Home-screen section: a title followed by a horizontally-scrolling row
 * of `ShowCard`s. Used for "suggested for you" / "new" / "trending" — the 3
 * sections above the categories row and the plain "all shows" list.
 *
 * A `FlatList` (not a `ScrollView` of mapped views) so it only renders the
 * cards actually near the viewport — matters once this is backed by a real,
 * possibly-long API response instead of a handful of mock shows.
 */
export function HorizontalShowSection({ title, shows, variant = 'compact' }: HorizontalShowSectionProps) {
  if (shows.length === 0) return null;

  return (
    <View style={styles.container}>
      <ThemedText type="subtitle" style={styles.title}>
        {title}
      </ThemedText>
      <FlatList
        horizontal
        // `FlatList` doesn't reverse its own scroll direction for RTL on
        // native (there's nothing in React Native's own `VirtualizedList`
        // that reads `I18nManager` at all) — web is fine on its own (the
        // browser's `dir="rtl"` already reverses a plain horizontal
        // flexbox), so this only applies on native. The standard fix:
        // mirror the whole list horizontally (flips scroll direction *and*
        // item order together), then mirror each item straight back so its
        // own content isn't drawn backwards.
        style={I18nManager.isRTL ? styles.rtlMirror : undefined}
        data={shows}
        keyExtractor={(show) => show.id}
        renderItem={({ item }) => (
          <View style={I18nManager.isRTL ? styles.rtlMirror : undefined}>
            {variant === 'featured' ? <FeaturedShowCard show={item} /> : <ShowCard show={item} />}
          </View>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={styles.listContent}
        showsHorizontalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.three,
  },
  title: {
    fontSize: 20,
    lineHeight: 26,
    paddingHorizontal: Spacing.four,
  },
  listContent: {
    paddingHorizontal: Spacing.four,
  },
  separator: {
    width: Spacing.three,
  },
  rtlMirror: {
    transform: [{ scaleX: -1 }],
  },
});
