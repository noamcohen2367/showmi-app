import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
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
  const router = useRouter();
  const next = nextUpcomingShowtime(show.showtimes);

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/show/[id]', params: { id: show.id } })}
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={show.name}>
      <Image
        source={{ uri: show.images[0] }}
        style={styles.image}
        contentFit="cover"
        transition={150}
        // expo-image defaults to `cachePolicy="disk"`, not `"memory-disk"`
        // (see its `Image.types.d.ts` — `@default 'disk'`). With only a disk
        // cache, a card that scrolls out of the window and back in re-reads
        // the file and re-decodes the bitmap every time, on the scroll path.
        // These posters are small and few, so keeping the decoded bitmap in
        // memory too is cheap and removes that repeat work entirely.
        cachePolicy="memory-disk"
        // FlatList recycles cell views; without this, a recycled view shows
        // the *previous* show's poster until the new one finishes decoding.
        recyclingKey={show.id}
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
