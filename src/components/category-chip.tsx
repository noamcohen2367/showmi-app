import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type CategoryChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

/** One tappable pill in the Home screen's categories row. */
export function CategoryChip({ label, selected, onPress }: CategoryChipProps) {
  const theme = useTheme();

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }}>
      <ThemedView
        type={selected ? 'primarySoft' : 'backgroundElement'}
        style={[styles.chip, selected && { borderColor: theme.primary }]}>
        <ThemedText type="small" themeColor={selected ? 'primary' : 'text'}>
          {label}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
    borderWidth: 1,
    borderColor: 'transparent',
  },
});
