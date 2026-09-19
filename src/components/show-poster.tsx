import { Image, type ImageStyle } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View, type StyleProp } from 'react-native';

import { ThemedText } from './themed-text';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Show } from '@/types/show';

type ShowPosterProps = {
  show: Show;
  /** Which of the show's images to draw. Defaults to the hero image. */
  index?: number;
  style?: StyleProp<ImageStyle>;
  /** Blurs the poster, for the detail screen's background layer. */
  blurRadius?: number;
  /** Hides the fallback's caption where the show's name is already on screen. */
  showFallbackLabel?: boolean;
};

/**
 * A show's poster, with one guarantee: it never renders as an empty dark box.
 *
 * Every surface in the app used to mount a bare `<Image>` with the same four
 * props. That worked until a URL failed — and several do: one theater's CDN
 * returns 403 to anything without a `Referer`, and a handful of images are
 * served over plain `http://`, which iOS blocks outright. expo-image draws
 * nothing in that case, so what the user actually saw was whatever sat
 * behind or over the image: the featured card's scrim, or the detail
 * screen's `theme.background` — black, in dark mode.
 *
 * Centralising it here means the fallback exists once rather than five times,
 * and a show with no images at all is no longer a special case.
 */
export function ShowPoster({
  show,
  index = 0,
  style,
  blurRadius,
  showFallbackLabel = true,
}: ShowPosterProps) {
  const theme = useTheme();
  const uri = show.images[index];
  const [failed, setFailed] = useState(false);

  // Reset when the component is recycled onto a different show, or the same
  // show's failure would be inherited by whoever lands in this row next.
  const [lastUri, setLastUri] = useState(uri);
  if (uri !== lastUri) {
    setLastUri(uri);
    setFailed(false);
  }

  if (!uri || failed) {
    return (
      <View style={[styles.fallback, { backgroundColor: theme.backgroundElement }, style]}>
        {showFallbackLabel ? (
          <ThemedText
            type="small"
            themeColor="textSecondary"
            numberOfLines={3}
            style={styles.fallbackLabel}>
            {show.name}
          </ThemedText>
        ) : null}
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={style}
      contentFit="cover"
      transition={150}
      // expo-image defaults to `cachePolicy="disk"`; without the memory half,
      // a poster scrolled out of the window and back in is re-decoded every
      // time, on the scroll path.
      cachePolicy="memory-disk"
      // FlatList recycles cells; without this a recycled view keeps showing
      // the previous show's poster until the new one decodes.
      recyclingKey={`${show.id}:${index}`}
      blurRadius={blurRadius}
      accessibilityLabel={show.name}
      onError={() => setFailed(true)}
    />
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.two,
  },
  fallbackLabel: {
    textAlign: 'center',
  },
});
