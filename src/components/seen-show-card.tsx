import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { ShowPoster } from './show-poster';
import { ThemedText } from './themed-text';

import { withAlpha } from '@/constants/gradient-palette';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { CustomWatchlistItem } from '@/hooks/use-watchlist';
import type { Show } from '@/types/show';

/**
 * Same geometry as the featured card's overlay, and the same reasoning: the
 * gradient is what guarantees the name stays readable on artwork nobody
 * chose. Starting fully transparent keeps the poster itself unmuddied, since
 * the text only occupies the bottom third.
 */
const SCRIM_LOCATIONS = [0, 0.45, 1] as const;
const SCRIM_ALPHAS = [0, 0.35, 0.88] as const;
const TEXT_SHADOW_ALPHA = 0.45;

/** Posters are portrait; 2:3 is the shape the theatres actually publish. */
const CARD_ASPECT = 2 / 3;

/**
 * A card in the "already seen" grid.
 *
 * Deliberately carries no date. Everywhere else in the app a show's next
 * showtime is the most useful thing about it; here it is the one piece of
 * information that cannot matter, because the user is looking at a record of
 * something they have already been to.
 *
 * The name sits inside the artwork rather than under it so the grid reads as
 * a wall of posters — closer to a shelf of things collected than to a list of
 * things pending, which is the difference between this list and the other one.
 */
function SeenCardFrame({
  children,
  onPress,
  onUnsee,
  accessibilityLabel,
  badgeLabel,
  style,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  /** Present only where "no longer seen" is a meaningful thing to say. */
  onUnsee?: () => void;
  accessibilityLabel: string;
  badgeLabel?: string;
  style?: ViewStyle;
}) {
  const theme = useTheme();

  /* A filled chip rather than a bare glyph: the tick lands on whatever the
     poster happens to be, and only its own background can promise it stays
     legible.

     It is also the control for undoing "seen", which is why it is a chip and
     not decoration. The tick already means "seen", so pressing it to stop
     meaning that is the shortest thing to explain — shorter than a long
     press, which would be invisible, and than a swipe, which in a grid has
     no obvious direction. */
  const badge = (
    <View style={[styles.badge, { backgroundColor: theme.seen }]}>
      <Ionicons name="checkmark" size={14} color={theme.onImage} />
    </View>
  );

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'image'}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.card, style, pressed && onPress && styles.pressed]}>
      {children}

      <LinearGradient
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
        colors={[
          withAlpha(theme.scrim, SCRIM_ALPHAS[0]),
          withAlpha(theme.scrim, SCRIM_ALPHAS[1]),
          withAlpha(theme.scrim, SCRIM_ALPHAS[2]),
        ]}
        locations={SCRIM_LOCATIONS}
      />

      {onUnsee ? (
        <Pressable
          onPress={onUnsee}
          accessibilityRole="button"
          accessibilityLabel={badgeLabel}
          // The chip is 24pt, well under the 44pt minimum, and it sits inside
          // another pressable — without this the card would swallow presses
          // meant for it.
          hitSlop={Spacing.two}
          style={({ pressed }) => [styles.badgeHit, pressed && styles.pressed]}>
          {badge}
        </Pressable>
      ) : (
        <View style={styles.badgeHit}>{badge}</View>
      )}
    </Pressable>
  );
}

export function SeenShowCard({ show, onUnsee }: { show: Show; onUnsee: () => void }) {
  const theme = useTheme();
  const router = useRouter();

  return (
    <SeenCardFrame
      onPress={() => router.push({ pathname: '/show/[id]', params: { id: show.id } })}
      onUnsee={onUnsee}
      badgeLabel={`החזרת ${show.name} לרוצה לראות`}
      accessibilityLabel={`${show.name}, נצפתה`}>
      {/* No fallback label: the name is overlaid below, and the scrim would
          otherwise sit on a second copy of it. */}
      <ShowPoster show={show} style={styles.poster} showFallbackLabel={false} />

      <View style={styles.text} pointerEvents="none">
        <ThemedText
          type="smallBold"
          numberOfLines={2}
          style={[
            styles.name,
            { color: theme.onImage, textShadowColor: withAlpha(theme.scrim, TEXT_SHADOW_ALPHA) },
          ]}>
          {show.name}
        </ThemedText>
      </View>
    </SeenCardFrame>
  );
}

/**
 * A hand-typed entry, in the same grid.
 *
 * There is no `Show` behind it — no poster, no venue, nowhere to navigate —
 * so a glyph stands in for the artwork rather than a broken image, and the
 * card is not pressable. It keeps its own delete control because a typo here
 * cannot be undone by un-saving a catalogue entry.
 *
 * Its tick is deliberately NOT a control, unlike the catalogue card's.
 * "No longer seen" makes no sense for an entry that exists only because
 * somebody saw it — and the want-to-see list renders catalogue shows only,
 * so moving one there would make it vanish from the app entirely.
 */
export function SeenCustomCard({
  item,
  onRemove,
}: {
  item: CustomWatchlistItem;
  onRemove: () => void;
}) {
  const theme = useTheme();

  return (
    <SeenCardFrame
      accessibilityLabel={`${item.name}, נוסף ידנית`}
      style={{ backgroundColor: theme.backgroundElement }}>
      <View style={styles.placeholder}>
        <Ionicons name="ticket-outline" size={32} color={theme.textSecondary} />
      </View>

      <View style={styles.text} pointerEvents="none">
        <ThemedText
          type="smallBold"
          numberOfLines={2}
          style={[
            styles.name,
            { color: theme.onImage, textShadowColor: withAlpha(theme.scrim, TEXT_SHADOW_ALPHA) },
          ]}>
          {item.name}
        </ThemedText>
        {item.note ? (
          <ThemedText
            type="small"
            numberOfLines={1}
            style={[
              styles.note,
              { color: theme.onImage, textShadowColor: withAlpha(theme.scrim, TEXT_SHADOW_ALPHA) },
            ]}>
            {item.note}
          </ThemedText>
        ) : null}
      </View>

      <Pressable
        onPress={onRemove}
        accessibilityRole="button"
        accessibilityLabel={`הסרת ${item.name}`}
        hitSlop={Spacing.two}
        style={({ pressed }) => [styles.remove, pressed && styles.pressed]}>
        <Ionicons name="close" size={16} color={theme.onImage} />
      </Pressable>
    </SeenCardFrame>
  );
}

const styles = StyleSheet.create({
  card: {
    // Fills its cell; the grid's column width lives on the wrapper in
    // `favorites.tsx`, which is also what the layout animation animates.
    width: '100%',
    aspectRatio: CARD_ASPECT,
    borderRadius: Spacing.three,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  poster: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  placeholder: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeHit: {
    position: 'absolute',
    top: Spacing.two,
    // Logical, so the chip sits on the card's trailing edge under RTL rather
    // than being pinned to one physical side.
    insetInlineEnd: Spacing.two,
  },
  badge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  remove: {
    position: 'absolute',
    top: Spacing.two,
    insetInlineStart: Spacing.two,
  },
  text: {
    padding: Spacing.two,
    gap: 2,
  },
  name: {
    // Geometry only; the colour comes from the theme at render time.
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  note: {
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  pressed: {
    opacity: 0.85,
  },
});
