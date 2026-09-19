import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { SaveButton } from './save-button';
import { ShowPoster } from './show-poster';
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
  const router = useRouter();
  const next = nextUpcomingShowtime(show.showtimes);

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/show/[id]', params: { id: show.id } })}
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={show.name}>
      {/* The row prints the name immediately to its side, so the fallback
          doesn't repeat it — see `ShowPoster`. */}
      <ShowPoster show={show} style={styles.image} showFallbackLabel={false} />
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

      {/* Its own Pressable inside the row's Pressable: tapping the bookmark
          saves without also opening the show. Nesting works because the
          inner one handles the touch and doesn't propagate it. */}
      <SaveButton showId={show.id} showName={show.name} />
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
