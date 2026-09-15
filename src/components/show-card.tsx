import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from './themed-text';

import { Spacing } from '@/constants/theme';
import type { Show } from '@/types/show';
import { formatShowtime, nextUpcomingShowtime } from '@/utils/date';

export const SHOW_CARD_WIDTH = 148;

type ShowCardProps = {
  show: Show;
};

/**
 * Compact poster card used in the Home screen's horizontal carousels
 * ("suggested for you", "new", "trending"). See `ShowListItem` for the
 * full-width row used in the plain "all shows" list further down the page.
 *
 * Not yet wired to navigate anywhere — the show-detail screen is next
 * phase's work (see the Home screen's own doc comment) — so this is a
 * `Pressable` today only for the touch-feedback opacity, not a real link.
 */
export function ShowCard({ show }: ShowCardProps) {
  const next = nextUpcomingShowtime(show.showtimes);

  return (
    <Pressable style={({ pressed }) => [styles.container, pressed && styles.pressed]} accessibilityRole="button">
      <Image
        source={{ uri: show.images[0] }}
        style={styles.image}
        contentFit="cover"
        transition={150}
        accessibilityLabel={show.name}
      />
      <View style={styles.text}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {show.name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {show.theater.name}
        </ThemedText>
        {next && (
          <ThemedText type="small" themeColor="primary" numberOfLines={1} style={styles.nextDate}>
            {formatShowtime(next.startsAt)}
          </ThemedText>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SHOW_CARD_WIDTH,
    gap: Spacing.one,
  },
  pressed: {
    opacity: 0.7,
  },
  image: {
    width: SHOW_CARD_WIDTH,
    aspectRatio: 2 / 3,
    borderRadius: Spacing.three,
  },
  text: {
    gap: 2,
  },
  nextDate: {
    fontSize: 12,
  },
});
