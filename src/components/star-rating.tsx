import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { MAX_RATING, MIN_RATING } from '@/constants/review-tags';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * A star rating, readable or editable.
 *
 * One component for both, because a row of stars that you can set and a row
 * you can only read differ by a press handler — and two components would be
 * two chances for them to drift into looking unalike.
 *
 * When editable, each star is its own button rather than the row being a
 * slider. A slider is fiddly at this size and impossible with a screen
 * reader; five buttons each announce what they will set.
 */
export function StarRating({
  value,
  onChange,
  size = 22,
}: {
  value: number;
  /** Omit for a read-only display. */
  onChange?: (rating: number) => void;
  size?: number;
}) {
  const theme = useTheme();
  const editable = !!onChange;

  return (
    <View
      style={styles.row}
      accessibilityRole={editable ? undefined : 'image'}
      accessibilityLabel={editable ? undefined : `דירוג ${value} מתוך ${MAX_RATING}`}>
      {Array.from({ length: MAX_RATING }, (_, index) => {
        const star = index + MIN_RATING;
        const filled = star <= value;
        const glyph = (
          <Ionicons
            name={filled ? 'star' : 'star-outline'}
            size={size}
            // Unfilled stars use `textSecondary` rather than a faded accent:
            // a dimmed version of the fill colour reads as "partly selected",
            // which is a state this control does not have.
            color={filled ? theme.primary : theme.textSecondary}
          />
        );

        if (!editable) return <View key={star}>{glyph}</View>;

        return (
          <Pressable
            key={star}
            onPress={() => onChange(star)}
            accessibilityRole="button"
            accessibilityLabel={`${star} מתוך ${MAX_RATING}`}
            accessibilityState={{ selected: star === value }}
            // The glyph is well under the 44pt minimum on its own.
            hitSlop={Spacing.two}>
            {glyph}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    // Plain `row`, which Yoga mirrors under `forceRTL` — so the stars fill
    // from the right, the direction the rest of the screen is read in. The
    // first star a Hebrew reader's eye lands on should be the first one set.
    flexDirection: 'row',
    gap: Spacing.one,
    alignSelf: 'flex-start',
  },
});
