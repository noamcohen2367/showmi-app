import { Host, Picker, Text } from '@expo/ui/swift-ui';
import { frame, pickerStyle, tag } from '@expo/ui/swift-ui/modifiers';
import { StyleSheet } from 'react-native';

import {
  SEGMENTED_HEIGHT,
  SEGMENTED_MAX_WIDTH,
  type SegmentedPillProps,
} from './segmented-pill.shared';

export type { SegmentedOption } from './segmented-pill.shared';

/**
 * iOS: a real `UISegmentedControl`, via SwiftUI's `Picker` in the
 * `segmented` style.
 *
 * Native rather than the hand-drawn version in `segmented-pill.tsx` (which
 * Metro still resolves for web) so it inherits the platform's own metrics,
 * selection animation, haptics and Dynamic Type — none of which a `Pressable`
 * row reproduces, and all of which users notice on a control this common.
 *
 * `Host` is required: it is the bridge that mounts a SwiftUI tree inside the
 * React Native view hierarchy. `matchContents` lets the control report its
 * own natural height back up rather than needing one hardcoded here.
 */
export function SegmentedPill<T extends string>({ options, value, onChange }: SegmentedPillProps<T>) {
  return (
    <Host style={styles.host}>
      <Picker
        selection={value}
        onSelectionChange={(selected) => onChange(selected as T)}
        // `frame` rather than `matchContents` on the Host: a segmented
        // Picker sizes to its labels, so left to itself it renders small and
        // pinned to the leading edge — which under `forceRTL` is the right.
        // Filling the width and centring is what makes it read as one
        // control spanning the screen instead of a stray widget in a corner.
        modifiers={[pickerStyle('segmented'), frame({ maxWidth: SEGMENTED_MAX_WIDTH, height: SEGMENTED_HEIGHT, alignment: 'center' })]}>
        {options.map((option) => (
          // The `tag` modifier is what `selection`/`onSelectionChange`
          // match against — without it SwiftUI has no value to report.
          <Text key={option.value} modifiers={[tag(option.value)]}>
            {option.count !== undefined ? `${option.label} (${option.count})` : option.label}
          </Text>
        ))}
      </Picker>
    </Host>
  );
}

const styles = StyleSheet.create({
  host: {
    width: '100%',
    maxWidth: SEGMENTED_MAX_WIDTH,
    height: SEGMENTED_HEIGHT,
    alignSelf: 'center',
  },
});
