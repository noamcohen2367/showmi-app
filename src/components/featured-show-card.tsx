import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { SaveButton } from './save-button';
import { SHOW_CARD_WIDTH } from './show-card';
import { ThemedText } from './themed-text';

import { withAlpha } from '@/constants/gradient-palette';
import { Spacing } from '@/constants/theme';
import { useImageAverageColor } from '@/hooks/use-image-average-color';
import { useTheme } from '@/hooks/use-theme';
import type { Show } from '@/types/show';
import { formatShowtime, nextUpcomingShowtime } from '@/utils/date';
import { scrimTintFromHex } from '@/utils/scrim-tint';

/**
 * Bigger than the compact `ShowCard`, which is what makes this row read as
 * the lead. 1.45× rather than a round 2×: at double width the card ran to
 * roughly three quarters of a phone's screen, leaving almost no sight of the
 * next one — and a carousel whose second card is invisible doesn't look like
 * a carousel.
 *
 * Rounded, because a fractional width lands the card's edge mid-pixel and
 * leaves a faint seam along the rounded border on non-integer-scale screens.
 */
export const FEATURED_CARD_WIDTH = Math.round(SHOW_CARD_WIDTH * 1.45);

/**
 * Where the scrim starts and ends. Three stops rather than two: a straight
 * transparent→dark ramp across the whole card greys out the artwork's middle,
 * which is usually where the poster's subject is. Holding it fully clear for
 * the top half and only ramping over the bottom keeps the image intact and
 * puts the darkness exactly where the text sits.
 */
const SCRIM_LOCATIONS = [0, 0.5, 1] as const;
const SCRIM_ALPHAS = [0, 0.45, 0.85] as const;

/** Strength of the per-glyph shadow that sits on top of the scrim. */
const TEXT_SHADOW_ALPHA = 0.45;

/**
 * Contrast white text must keep over a *tinted* scrim, measured against the
 * worst case (the tint over a pure-white poster).
 *
 * 7:1 rather than the 4.5:1 AA floor, because unlike the theme's own colors
 * this one is sampled from an image nobody vetted — the extra headroom is
 * what absorbs a poster whose dominant color is unusual without landing on
 * the edge of the requirement.
 */
const SCRIM_MIN_CONTRAST = 7;

type FeaturedShowCardProps = {
  show: Show;
};

/**
 * The large poster card used by the Home screen's lead row ("מוצעים עבורך"),
 * as opposed to the compact `ShowCard` the other rows use.
 *
 * The show's details sit *inside* the image, bottom-aligned, over a gradient
 * scrim. That scrim is load-bearing, not decoration: these posters come from
 * an external URL, so the pixels under the text are arbitrary and white text
 * on its own would have undefined contrast. See the `OnPhoto` block in
 * `constants/theme.ts` for the measured worst case that fixes its strength.
 *
 * Keeps the poster's native 2:3 aspect rather than the reference's squarer
 * card, so `contentFit="cover"` has nothing to crop — theatre posters carry
 * their title in the artwork, and cropping the top of one to fit a squarer
 * box is how you lose it.
 */
export function FeaturedShowCard({ show }: FeaturedShowCardProps) {
  const theme = useTheme();
  const router = useRouter();
  const next = nextUpcomingShowtime(show.showtimes);

  // Where the scrim's color comes from, in order of preference:
  //   1. `show.dominantColor`, if the API ever supplies one — a value
  //      computed server-side costs the device nothing and can use a proper
  //      vibrant-color algorithm rather than a plain average.
  //   2. Otherwise, read it off the poster on the device.
  //   3. Otherwise (web, unreachable image, unsupported format), the theme's
  //      plain black scrim — exactly what this card did before tinting.
  const extracted = useImageAverageColor(show.images[0]);

  // Never used raw: `scrimTintFromHex` darkens it until white text over it
  // still clears 7:1 against the worst case, because a sampled color can be
  // arbitrarily pale and would take the text down with it.
  const scrimBase =
    scrimTintFromHex(show.dominantColor ?? extracted, {
      alpha: SCRIM_ALPHAS[SCRIM_ALPHAS.length - 1],
      minContrast: SCRIM_MIN_CONTRAST,
    }) ?? theme.scrim;

  const scrimColors = [
    withAlpha(scrimBase, SCRIM_ALPHAS[0]),
    withAlpha(scrimBase, SCRIM_ALPHAS[1]),
    withAlpha(scrimBase, SCRIM_ALPHAS[2]),
  ] as const;
  const onImageText = {
    color: theme.onImage,
    // Stays the theme's black rather than the tint: the glyph shadow's job
    // is to separate text from busy artwork, and a tinted shadow on tinted
    // ground does less of that than a neutral dark one.
    textShadowColor: withAlpha(theme.scrim, TEXT_SHADOW_ALPHA),
  };

  return (
    <Pressable
      onPress={() =>
        router.push({ pathname: '/show/[id]', params: { id: show.id } })
      }
      accessibilityRole="button"
      // One label for the whole card: the three lines below are one piece of
      // information, and a screen reader stopping on each separately would
      // read them out as unrelated fragments.
      accessibilityLabel={[
        show.name,
        show.theater.name,
        next && formatShowtime(next.startsAt),
      ]
        .filter(Boolean)
        .join(', ')}
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
    >
      <Image
        source={{ uri: show.images[0] }}
        style={styles.image}
        contentFit="cover"
        transition={150}
        // Same reasoning as `ShowCard`: expo-image defaults to disk-only.
        cachePolicy="memory-disk"
        recyclingKey={show.id}
      />

      <LinearGradient
        style={styles.scrim}
        pointerEvents="none"
        colors={scrimColors}
        locations={SCRIM_LOCATIONS}
      />

      {/* Top corner, away from the overlaid text at the bottom. `onImage`
          because the theme's own text color would disappear against a light
          poster here. */}
      <View style={styles.save}>
        <SaveButton showId={show.id} showName={show.name} onImage size={20} />
      </View>

      <View style={styles.text} pointerEvents="none">
        {show.categories[0] ? (
          <ThemedText
            type="small"
            style={[styles.line, styles.contextLine, onImageText]}
            numberOfLines={1}
          >
            {show.categories[0]}
          </ThemedText>
        ) : null}

        <ThemedText
          type="smallBold"
          style={[styles.line, styles.title, onImageText]}
          numberOfLines={2}
        >
          {show.name}
        </ThemedText>

        {next ? (
          <ThemedText
            type="small"
            style={[styles.line, onImageText]}
            numberOfLines={1}
          >
            {formatShowtime(next.startsAt)}
          </ThemedText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: FEATURED_CARD_WIDTH,
    aspectRatio: 2 / 3,
    borderRadius: Spacing.four,
    // Clips the image and the scrim to the rounded corners — without this
    // the image's square corners poke out past the card's radius on Android.
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  pressed: {
    opacity: 0.85,
  },
  image: {
    ...StyleSheet.absoluteFill,
  },
  scrim: {
    ...StyleSheet.absoluteFill,
  },
  save: {
    position: 'absolute',
    top: Spacing.two,
    // Logical, not `right`: under `forceRTL` this puts the bookmark on the
    // card's trailing edge in both directions rather than pinning it to one
    // physical side.
    insetInlineEnd: Spacing.two,
  },
  text: {
    padding: Spacing.three,
    gap: 2,
  },
  line: {
    // A soft shadow under the glyphs themselves, on top of the scrim. The
    // scrim already guarantees the contrast; this keeps the text from
    // dissolving into a busy patch of artwork at the exact moment the
    // gradient is still weak. The color comes from the theme at render time
    // (see `onImageText`) — only the geometry is static.
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  contextLine: {
    opacity: 0.85,
  },
  title: {
    fontSize: 17,
    lineHeight: 22,
  },
});
