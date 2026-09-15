import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from './themed-text';

import { Spacing } from '@/constants/theme';
import type { Show } from '@/types/show';
import { formatShowtime, nextUpcomingShowtime } from '@/utils/date';

type ShowListItemProps = {
  show: Show;
};

/**
 * Full-width row used for the plain "all shows" list at the bottom of the
 * Home screen (as opposed to `ShowCard`, the compact poster used in the
 * horizontal carousels above it). Same "not wired to navigate yet" note
 * applies — see `ShowCard`'s doc comment.
 */
export function ShowListItem({ show }: ShowListItemProps) {
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
          {show.theater.name}, {show.theater.city}
        </ThemedText>
        {next && (
          <ThemedText type="small" themeColor="primary" numberOfLines={1}>
            {formatShowtime(next.startsAt)}
          </ThemedText>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  pressed: {
    opacity: 0.7,
  },
  image: {
    width: 72,
    aspectRatio: 2 / 3,
    borderRadius: Spacing.two,
  },
  text: {
    flex: 1,
    gap: 2,
  },
});
