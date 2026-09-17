import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from './themed-text';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import {
  segmentLabel,
  SEGMENTED_HEIGHT,
  SEGMENTED_MAX_WIDTH,
  type SegmentedPillProps,
} from './segmented-pill.shared';

export type { SegmentedOption } from './segmented-pill.shared';

/**
 * Web fallback. iOS gets a real `UISegmentedControl` and Android Material 3
 * segmented buttons — see `segmented-pill.ios.tsx` / `.android.tsx`, which
 * Metro resolves ahead of this file on those platforms. `@expo/ui` has no web
 * renderer, so the browser gets this hand-drawn equivalent.
 *
 * A pill that switches between two or more views of the same screen.
 *
 * Distinct from `CategoryChip`, which filters a list in place: this picks
 * which list you are looking at, so only one option can ever be active and
 * the whole control reads as one object rather than a row of independent
 * choices. That's why it has a filled track behind the segments.
 *
 * `accessibilityRole="tab"` rather than `"button"`, so assistive tech
 * announces it as a set of views with one selected, matching what it does.
 */
export function SegmentedPill<T extends string>({ options, value, onChange }: SegmentedPillProps<T>) {
  const theme = useTheme();

  return (
    <View
      accessibilityRole="tablist"
      style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={({ pressed }) => [
              styles.segment,
              selected && { backgroundColor: theme.background },
              pressed && styles.pressed,
            ]}>
            <ThemedText
              type="default"
              themeColor={selected ? 'primary' : 'textSecondary'}
              numberOfLines={1}
              style={[styles.label, selected && styles.labelSelected]}>
              {segmentLabel(option)}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    height: SEGMENTED_HEIGHT,
    // Capped and centred rather than full-bleed: a two-segment control
    // stretched the whole width of a tablet or browser window reads as a
    // toolbar instead of a toggle.
    width: '100%',
    maxWidth: SEGMENTED_MAX_WIDTH,
    alignSelf: 'center',
    borderRadius: SEGMENTED_HEIGHT / 2,
    padding: Spacing.half,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: SEGMENTED_HEIGHT / 2,
    paddingHorizontal: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
  label: {
    textAlign: 'center',
  },
  labelSelected: {
    fontWeight: '600',
  },
});
