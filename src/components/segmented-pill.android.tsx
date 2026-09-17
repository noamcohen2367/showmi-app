import { Host, SegmentedButton, SingleChoiceSegmentedButtonRow } from '@expo/ui/jetpack-compose';
import { StyleSheet } from 'react-native';

import {
  segmentLabel,
  SEGMENTED_HEIGHT,
  SEGMENTED_MAX_WIDTH,
  type SegmentedPillProps,
} from './segmented-pill.shared';

import { useTheme } from '@/hooks/use-theme';

export type { SegmentedOption } from './segmented-pill.shared';

/**
 * Android: Material 3 segmented buttons.
 *
 * `SingleChoiceSegmentedButtonRow` is the required parent — a bare
 * `SegmentedButton` has no row to size itself against and no notion of which
 * sibling is selected. `selected`/`onClick` are the single-choice props;
 * `checked`/`onCheckedChange` belong to the multi-choice row instead.
 *
 * Colours are passed through from the app's theme rather than left to
 * Material's defaults, which would otherwise ignore the brand accent and the
 * app's own light/dark palette.
 */
export function SegmentedPill<T extends string>({ options, value, onChange }: SegmentedPillProps<T>) {
  const theme = useTheme();

  return (
    // Sized by the Host rather than `matchContents`, so the row matches the
    // iOS control's height and centring instead of collapsing to whatever
    // Material's own defaults work out to.
    <Host style={styles.host}>
      <SingleChoiceSegmentedButtonRow>
        {options.map((option) => (
          <SegmentedButton
            key={option.value}
            selected={option.value === value}
            onClick={() => onChange(option.value)}
            colors={{
              activeContainerColor: theme.primarySoft,
              activeContentColor: theme.primary,
              activeBorderColor: theme.primary,
              inactiveContentColor: theme.textSecondary,
              inactiveBorderColor: theme.backgroundSelected,
            }}>
            {/* The label is a slot, not a prop — Material 3 lets a segment
                hold an icon alongside its text, so the content goes in the
                children rather than a single string. */}
            <SegmentedButton.Label>{segmentLabel(option)}</SegmentedButton.Label>
          </SegmentedButton>
        ))}
      </SingleChoiceSegmentedButtonRow>
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
