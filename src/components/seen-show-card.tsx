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
 * The scrim behind the title.
 *
 * Four stops rather than a simple fade, and the extra two are load-bearing.
 * A plain ramp reaches full strength only at the very bottom edge, which is
 * below the text — so the *top* line of a two-line title lands where the
 * scrim is still weak. Measured against the least favourable poster that can
 * load, a pure white one, a plain 0→0.8 ramp leaves that line at **2.58:1**.
 * Unreadable, and invisible in testing unless a long title happens to meet a
 * bright poster.
 *
 * These stops saturate by 74% of the card's height — just above where a
 * second line begins — so the whole text block sits on scrim that is already
 * near full strength:
 *
 *   top line    α 0.688 →  8.06:1
 *   bottom line α 0.770 → 11.20:1
 *
 * Above 55% the scrim is ≤0.08, so the poster itself stays essentially
 * untouched; the darkening is spent only where it buys legibility.
 */
const SCRIM_LOCATIONS = [0, 0.55, 0.74, 1] as const;
const SCRIM_ALPHAS = [0, 0.08, 0.68, 0.8] as const;

/** Soft separation for the glyphs themselves, on top of the scrim. */
const TEXT_SHADOW_ALPHA = 0.4;

/** Posters are portrait; 2:3 is the shape the theatres actually publish. */
const CARD_ASPECT = 2 / 3;

const CARD_RADIUS = 24;
const BADGE_SIZE = 32;

/**
 * The one line under a hand-typed show's name: where, and when.
 *
 * Whichever of the two the user actually filled in — both fields are
 * optional, and a card with neither simply has no second line rather than a
 * placeholder apologising for it.
 *
 * A `year` date prints as the bare year. Rendering "1 בינואר 2019" for
 * someone who typed "2019" would be inventing a day they never claimed, and
 * it is exactly the reason the precision is stored alongside the date.
 */
function describeCustomEntry(item: CustomWatchlistItem): string | undefined {
  const when = item.seenOn
    ? item.seenOn.precision === 'year'
      ? item.seenOn.date.slice(0, 4)
      : new Date(`${item.seenOn.date}T00:00:00`).toLocaleDateString('he-IL', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
    : undefined;

  return [item.location, when].filter(Boolean).join(' · ') || undefined;
}

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
 *
 * Nothing here is dimmed for having been seen. A greyed card would say "this
 * one no longer counts", and the opposite is true: this list is the part of
 * the app a user has actually earned.
 */
function SeenCardFrame({
  children,
  title,
  subtitle,
  onPress,
  onUnsee,
  accessibilityLabel,
  badgeLabel,
  style,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  /** Present only where "no longer seen" is a meaningful thing to say. */
  onUnsee?: () => void;
  accessibilityLabel: string;
  badgeLabel?: string;
  style?: ViewStyle;
}) {
  const theme = useTheme();

  const onArtwork = {
    color: theme.onImage,
    textShadowColor: withAlpha(theme.scrim, TEXT_SHADOW_ALPHA),
  };

  /* A filled chip rather than a bare glyph: the tick lands on whatever the
     poster happens to be, and only its own background can promise it stays
     legible. The white ring does the same job for the chip's own edge, which
     would otherwise dissolve into a dark poster.

     It is also the control for undoing "seen", which is why it is a chip and
     not decoration. The tick already means "seen", so pressing it to stop
     meaning that is the shortest thing to explain — shorter than a long
     press, which would be invisible, and than a swipe, which in a grid has
     no obvious direction. */
  const badge = (
    <View style={[styles.badge, { backgroundColor: theme.seen, borderColor: theme.onImage }]}>
      <Ionicons name="checkmark" size={18} color={theme.onImage} />
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
          withAlpha(theme.scrim, SCRIM_ALPHAS[3]),
        ]}
        locations={SCRIM_LOCATIONS}
      />

      {/* Pinned to the bottom rather than laid out in flow, so a one-line and
          a two-line title share the same baseline across a row of cards. */}
      <View style={styles.text} pointerEvents="none">
        <ThemedText style={[styles.title, onArtwork]} numberOfLines={2}>
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText style={[styles.subtitle, onArtwork]} numberOfLines={1}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>

      {onUnsee ? (
        <Pressable
          onPress={onUnsee}
          accessibilityRole="button"
          accessibilityLabel={badgeLabel}
          // The chip sits inside another pressable; without a slop of its own
          // the card swallows presses meant for it.
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

export function SeenShowCard({
  show,
  onUnsee,
}: {
  show: Show;
  /** Absent on somebody else's profile, where the tick is a label, not a control. */
  onUnsee?: () => void;
}) {
  const router = useRouter();

  return (
    <SeenCardFrame
      title={show.name}
      onPress={() => router.push({ pathname: '/show/[id]', params: { id: show.id } })}
      onUnsee={onUnsee}
      badgeLabel={onUnsee ? `החזרת ${show.name} לרוצה לראות` : undefined}
      accessibilityLabel={`${show.name}, נצפתה`}>
      {/* No fallback label: the name is overlaid below, and the scrim would
          otherwise sit on a second copy of it. */}
      <ShowPoster show={show} style={styles.poster} showFallbackLabel={false} />
    </SeenCardFrame>
  );
}

/**
 * A hand-typed entry, in the same grid.
 *
 * There is no `Show` behind it — no poster, no venue, nowhere to navigate —
 * so a glyph stands in for the artwork rather than a broken image. Everything
 * else is identical to a catalogue card, deliberately: the two kinds sit in
 * one grid, and a row of cards that were shaped differently would read as a
 * rendering fault rather than as a distinction.
 *
 * Its tick is NOT a control, unlike the catalogue card's. "No longer seen"
 * makes no sense for an entry that exists only because somebody saw it — and
 * the want-to-see list renders catalogue shows only, so moving one there
 * would make it vanish from the app entirely.
 */
export function SeenCustomCard({
  item,
  onRemove,
}: {
  item: CustomWatchlistItem;
  /** Absent on somebody else's profile, where nothing here is yours to delete. */
  onRemove?: () => void;
}) {
  const theme = useTheme();

  return (
    <SeenCardFrame
      title={item.name}
      subtitle={describeCustomEntry(item)}
      accessibilityLabel={`${item.name}, נוסף ידנית`}
      style={{ backgroundColor: theme.backgroundElement }}>
      <View style={styles.placeholder}>
        <Ionicons name="ticket-outline" size={36} color={theme.textSecondary} />
      </View>

      {onRemove ? (
        <Pressable
          onPress={onRemove}
          accessibilityRole="button"
          accessibilityLabel={`הסרת ${item.name}`}
          hitSlop={Spacing.two}
          style={({ pressed }) => [styles.remove, pressed && styles.pressed]}>
          <Ionicons name="close" size={18} color={theme.onImage} />
        </Pressable>
      ) : null}
    </SeenCardFrame>
  );
}

const styles = StyleSheet.create({
  card: {
    // Fills its cell; the grid's column width lives on the wrapper in
    // `favorites.tsx`, which is also what the layout animation animates.
    width: '100%',
    aspectRatio: CARD_ASPECT,
    borderRadius: CARD_RADIUS,
    // Clips poster, scrim and text to the same rounded corners.
    overflow: 'hidden',
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
    top: Spacing.three - Spacing.one,
    // Logical, so the chip sits on the card's trailing edge under RTL rather
    // than being pinned to one physical side — the opposite corner from the
    // right-aligned title below.
    insetInlineEnd: Spacing.three - Spacing.one,
  },
  badge: {
    width: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  remove: {
    position: 'absolute',
    top: Spacing.three - Spacing.one,
    insetInlineStart: Spacing.three - Spacing.one,
  },
  text: {
    position: 'absolute',
    bottom: Spacing.three,
    insetInlineStart: Spacing.three,
    insetInlineEnd: Spacing.three,
    gap: 2,
  },
  title: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
    textAlign: 'right',
    // Keeps a title that mixes Hebrew with a Latin word or a digit from
    // reordering itself; `textAlign` alone only moves the block.
    writingDirection: 'rtl',
    // Geometry only — the colour is read from the theme at render time.
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    textAlign: 'right',
    writingDirection: 'rtl',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  pressed: {
    opacity: 0.85,
  },
});
