import Ionicons from '@expo/vector-icons/Ionicons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { StyleSheet, View, type ViewProps } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from './themed-text';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** How far the row must travel before the release counts as a swipe. */
const TRIGGER_DISTANCE = 96;

type SwipeToSeenProps = ViewProps & {
  onTriggered: () => void;
};

/**
 * Wraps one watchlist row so a swipe *towards the start edge* marks it seen.
 *
 * "Swipe right" in the reference is a left-to-right drag, but this app is
 * RTL — so the gesture is defined against the layout's own start edge
 * rather than an absolute direction. Under `forceRTL` the row's start edge
 * is on the right, so the drag that moves the row away from its anchor is
 * still a rightwards one for the user, and it stays correct if the app is
 * ever run LTR. That's why the reveal below is positioned with `start`/`end`
 * rather than `left`/`right`.
 *
 * The gesture runs entirely on the UI thread; only the commit hops back to
 * JS, via `runOnJS`, so dragging stays smooth while the list is scrolling.
 */
export function SwipeToSeen({ onTriggered, children, style, ...rest }: SwipeToSeenProps) {
  const theme = useTheme();
  const translateX = useSharedValue(0);

  const pan = Gesture.Pan()
    // Let the vertical list keep its own scrolling: only claim the gesture
    // once the drag is clearly more horizontal than vertical.
    .activeOffsetX([-16, 16])
    .failOffsetY([-12, 12])
    .onUpdate((event) => {
      translateX.value = event.translationX;
    })
    .onEnd(() => {
      if (Math.abs(translateX.value) >= TRIGGER_DISTANCE) {
        // Slide the row fully out in the direction it was already going,
        // then commit — the row disappears from this section as a result,
        // so it never springs back into view.
        translateX.value = withTiming(Math.sign(translateX.value) * 500, { duration: 180 });
        runOnJS(onTriggered)();
        return;
      }
      translateX.value = withTiming(0, { duration: 150 });
    });

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));

  // The reveal fades in as the row is dragged, so the drag explains itself
  // before it's committed rather than only after.
  const revealStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.abs(translateX.value) / TRIGGER_DISTANCE),
  }));

  return (
    <View style={[styles.container, style]} {...rest}>
      <Animated.View
        pointerEvents="none"
        style={[styles.reveal, { backgroundColor: theme.primarySoft }, revealStyle]}>
        <Ionicons name="checkmark-circle" size={20} color={theme.primary} />
        <ThemedText type="smallBold" themeColor="primary">
          ראיתי
        </ThemedText>
      </Animated.View>

      <GestureDetector gesture={pan}>
        <Animated.View style={rowStyle}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
  },
  reveal: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
  },
});
