import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  I18nManager,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Promo } from '@/data/shows';

const AUTO_ADVANCE_INTERVAL_MS = 2000;
const BANNER_ASPECT_RATIO = 2;

/**
 * How much of the *next* promo stays visible past the edge of the current
 * one. The reference's hero carousel shows this sliver deliberately: it's
 * what tells you the card is swipeable at all, which a full-bleed paging
 * banner has to rely on the dots alone to communicate.
 */
const PEEK_WIDTH = 20;

/** How far the hero card sits in from the screen edges. */
const SIDE_INSET = Spacing.three;

/** Gap between one hero card and the next. */
const CARD_GAP = Spacing.two;

/** Corner radius of the hero card — the reference's ~20-24px treatment. */
const CARD_RADIUS = Spacing.four;

type PromoBannerProps = {
  promos: Promo[];
};

/**
 * The promotional banner at the very top of the Home screen — 3-5 wide
 * images for new shows/deals, one page at a time. Both ways of moving
 * between slides work together, not just one:
 *  - Manual swipe/paging, via `pagingEnabled`.
 *  - Automatic advance every `AUTO_ADVANCE_INTERVAL_MS`, looping back to the
 *    first slide after the last — this just calls the exact same
 *    `scrollToIndex` a manual swipe would land on, so there's no separate
 *    "auto" vs. "manual" state to keep in sync.
 *
 * `activeIndex` is a reanimated shared value, not `useState` — deliberately.
 * This banner lives inside the Home screen's outer `FlatList` header, so it
 * stays mounted (and this timer keeps ticking) for as long as that screen
 * is, including while the promo banner itself has long since been scrolled
 * out of view. A `setState` every `AUTO_ADVANCE_INTERVAL_MS`, forever, for
 * as long as the Home tab is open, means a React re-render on that same
 * cadence, forever, competing with whatever else is happening on the JS
 * thread at that moment — including a scroll gesture in progress anywhere
 * on the page. Driving the dots' highlight off a shared value updates them
 * without going through React's render cycle at all, so this ticking has
 * nothing left to contend with scrolling over.
 *
 * Not wired to navigate anywhere yet — same "next phase" note as
 * `ShowCard`/`ShowListItem`.
 */
export function PromoBanner({ promos }: PromoBannerProps) {
  const [containerWidth, setContainerWidth] = useState(0);
  const activeIndex = useSharedValue(0);
  const listRef = useRef<FlatList<Promo>>(null);

  useEffect(() => {
    if (promos.length <= 1 || containerWidth === 0) return;

    const id = setInterval(() => {
      const next = (activeIndex.value + 1) % promos.length;
      listRef.current?.scrollToIndex({ index: next, animated: true });
      activeIndex.value = next;
    }, AUTO_ADVANCE_INTERVAL_MS);

    return () => clearInterval(id);
  }, [promos.length, containerWidth, activeIndex]);

  if (promos.length === 0) return null;

  function handleMomentumScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    // Fires for *both* a manual swipe finishing and a programmatic
    // `scrollToIndex` finishing — either way this is "where we ended up
    // now", which is exactly what the auto-advance timer above needs next.
    // This one only runs once per swipe/auto-advance (not on a timer), so
    // it doesn't need the same shared-value treatment — it just keeps
    // `activeIndex` in sync either way.
    if (containerWidth === 0) return;
    // Recomputed here rather than read from the `const` below, so this stays
    // correct no matter where in the body that value ends up living. One
    // "page" is the snap interval (card + gap), not the viewport width —
    // those stopped being the same thing once the card gained its peek.
    const pageWidth = containerWidth - PEEK_WIDTH + CARD_GAP;
    // `.value` on a reanimated SharedValue is an intentionally mutable ref
    // (that's the whole API), not React state; this rule doesn't know the
    // difference from an effect dependency that's actually meant to stay
    // immutable.
    // eslint-disable-next-line react-hooks/immutability
    activeIndex.value = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
  }

  // The outer `container`'s `aspectRatio` style (below) computes its own
  // height fine on both platforms, but on web that height doesn't cascade
  // down through `FlatList`'s own internal wrapper `div`s to its children
  // (confirmed: they all measured 0px tall even though `container` itself
  // correctly measured `width / 2`) — `FlatList`/`ScrollView` don't stretch
  // their content to fill an ancestor's *computed* height on web the way
  // Yoga does on native. So the height is computed here instead, once, from
  // the same measured width, and applied explicitly everywhere it's needed
  // (the list itself, each slide, the image) rather than left to cascade.
  // The card is narrower than the viewport by exactly the sliver of the next
  // card left showing, so `cardWidth + CARD_GAP` is both the snap interval
  // and what one "page" means to the auto-advance timer below.
  const cardWidth = containerWidth - PEEK_WIDTH;
  const cardHeight = cardWidth / BANNER_ASPECT_RATIO;
  const snapInterval = cardWidth + CARD_GAP;

  return (
    <View style={styles.container}>
      {/* The inset lives on `container` (outer), but the measurement has to
          happen *inside* it: `onLayout` reports the border box, which would
          include that padding and make every width below `SIDE_INSET * 2`
          too wide. Measuring the inner track instead keeps `cardWidth`,
          `snapInterval` and `getItemLayout` all derived from the same
          number the list actually has to work with — which is what makes
          `scrollToIndex` from the auto-advance land exactly on a card. */}
      <View onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)}>
        {containerWidth > 0 && (
        <FlatList
          ref={listRef}
          style={[{ height: cardHeight }, I18nManager.isRTL && styles.rtlMirror]}
          data={promos}
          keyExtractor={(promo) => promo.id}
          horizontal
          // `snapToInterval` rather than `pagingEnabled`: paging snaps to
          // multiples of the *viewport* width, which is now wider than a
          // card, so every swipe would drift further out of alignment.
          snapToInterval={snapInterval}
          snapToAlignment="start"
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          getItemLayout={(_, index) => ({ length: snapInterval, offset: snapInterval * index, index })}
          ItemSeparatorComponent={() => <View style={styles.cardSeparator} />}
          renderItem={({ item }) => (
            <View style={[{ width: cardWidth, height: cardHeight }, I18nManager.isRTL && styles.rtlMirror]}>
              <Image
                source={{ uri: item.imageUrl }}
                style={styles.image}
                contentFit="cover"
                transition={150}
                // Same reasoning as `ShowCard` — and it matters more here,
                // since the auto-advance cycles back through these same 4
                // images every few seconds for as long as the screen is open.
                cachePolicy="memory-disk"
                recyclingKey={item.id}
              />
            </View>
          )}
        />
        )}
      </View>

      <View style={styles.dots} pointerEvents="none">
        {promos.map((promo, index) => (
          <PromoDot key={promo.id} index={index} activeIndex={activeIndex} />
        ))}
      </View>
    </View>
  );
}

type PromoDotProps = {
  index: number;
  activeIndex: ReturnType<typeof useSharedValue<number>>;
};

/** One dot indicator; its color is computed directly from the shared value, no `useState` involved. */
function PromoDot({ index, activeIndex }: PromoDotProps) {
  const theme = useTheme();
  const animatedStyle = useAnimatedStyle(() => ({
    backgroundColor: activeIndex.value === index ? theme.primary : theme.backgroundElement,
  }));
  return <Animated.View style={[styles.dot, animatedStyle]} />;
}

const styles = StyleSheet.create({
  container: {
    // No `aspectRatio` any more: the card no longer fills the container
    // (it's inset by `PEEK_WIDTH`) and the dots now sit *below* it rather
    // than floating over it, so the container has to size to its content
    // instead of dictating a fixed shape to it.
    gap: Spacing.two,
    paddingHorizontal: SIDE_INSET,
  },
  image: {
    flex: 1,
    borderRadius: CARD_RADIUS,
  },
  cardSeparator: {
    width: CARD_GAP,
  },
  dots: {
    alignSelf: 'center',
    flexDirection: 'row',
    gap: Spacing.one,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  rtlMirror: {
    transform: [{ scaleX: -1 }],
  },
});
