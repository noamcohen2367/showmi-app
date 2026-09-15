import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { I18nManager, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { CategoryChip } from './category-chip';
import { ThemedText } from './themed-text';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { describeDateFilter, type DateFilter } from '@/utils/date-filter';

type HomeTopBarProps = {
  /** Shown in the location pill. Derived from the feed, never hardcoded. */
  locationLabel: string;
  dateFilter: DateFilter;
  categoryFilter: string[];
  onOpenDateFilter: () => void;
  onOpenCategoryFilter: () => void;
  onClearAll: () => void;
};

/**
 * The Home screen's top bar: a location pill and the four filters, on one
 * horizontally-scrolling strip, with a notification button pinned beside it.
 *
 * The four are not four of the same thing:
 *  - "הכל" clears every active filter (it's a reset, not a selection).
 *  - "תאריך" and "קטגוריות" open sheets and show their current selection in
 *    their own label, so an active filter is visible without opening it.
 *  - "רשימת צפייה" navigates — it isn't a filter of this feed at all.
 *
 * Sits *outside* the screen's `FlatList` rather than in its
 * `ListHeaderComponent`, so it stays put while the feed scrolls under it.
 *
 * RTL: the outer row is a plain `flexDirection: 'row'`, which
 * `I18nManager.forceRTL` (see `index.js`) already flips on native and
 * `dir="rtl"` flips on web — so the location pill lands on the *right* and
 * the notification button on the *left*, mirroring the LTR reference rather
 * than copying it literally. Only the scrolling strip needs the explicit
 * mirror trick, for the same reason `HorizontalShowSection` does.
 */
export function HomeTopBar({
  locationLabel,
  dateFilter,
  categoryFilter,
  onOpenDateFilter,
  onOpenCategoryFilter,
  onClearAll,
}: HomeTopBarProps) {
  const theme = useTheme();
  const router = useRouter();

  const dateLabel = describeDateFilter(dateFilter) ?? 'תאריך';
  const categoryLabel =
    categoryFilter.length === 0
      ? 'קטגוריות'
      : categoryFilter.length === 1
        ? categoryFilter[0]
        : `קטגוריות (${categoryFilter.length})`;

  const anyFilterActive = dateFilter.kind !== 'none' || categoryFilter.length > 0;

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        // Same mirror-the-list-then-mirror-each-item technique as
        // `HorizontalShowSection` — see its comment for why native
        // horizontal scrollers need this and web doesn't.
        style={[styles.strip, { backgroundColor: theme.backgroundElement }, I18nManager.isRTL && styles.rtlMirror]}
        contentContainerStyle={styles.stripContent}>
        <Item>
          <View style={[styles.locationPill, { backgroundColor: theme.backgroundSelected }]}>
            <Ionicons name="location-sharp" size={14} color={theme.text} />
            <ThemedText type="smallBold">{locationLabel}</ThemedText>
          </View>
        </Item>

        {/* "הכל" reads as selected exactly when nothing else is — that's what
            makes it a reset rather than a fifth filter competing with them. */}
        <Item>
          <CategoryChip label="הכל" selected={!anyFilterActive} onPress={onClearAll} />
        </Item>

        <Item>
          <CategoryChip
            label={dateLabel}
            selected={dateFilter.kind !== 'none'}
            onPress={onOpenDateFilter}
            trailingIcon="chevron-down"
          />
        </Item>

        <Item>
          <CategoryChip
            label="רשימת צפייה"
            selected={false}
            onPress={() => router.push('/favorites')}
          />
        </Item>

        <Item>
          <CategoryChip
            label={categoryLabel}
            selected={categoryFilter.length > 0}
            onPress={onOpenCategoryFilter}
            trailingIcon="chevron-down"
          />
        </Item>
      </ScrollView>

      {/* Deliberately carries no unread badge: this app has no notifications
          feature, and a red dot would be fabricated state rather than a
          rendering of something real. Present as the reference's layout
          slot; wire it up when notifications exist. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="התראות"
        style={({ pressed }) => [
          styles.notificationButton,
          { backgroundColor: theme.backgroundElement },
          pressed && styles.pressed,
        ]}>
        <Ionicons name="notifications-outline" size={20} color={theme.text} />
      </Pressable>
    </View>
  );
}

/** Un-mirrors one strip item, so its own content isn't drawn backwards. */
function Item({ children }: { children: React.ReactNode }) {
  return <View style={I18nManager.isRTL ? styles.rtlMirror : undefined}>{children}</View>;
}

const BAR_HEIGHT = 44;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  strip: {
    flex: 1,
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
  },
  stripContent: {
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.one,
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: BAR_HEIGHT / 2,
  },
  notificationButton: {
    width: BAR_HEIGHT,
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  rtlMirror: {
    transform: [{ scaleX: -1 }],
  },
});
