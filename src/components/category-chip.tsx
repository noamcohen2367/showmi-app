import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from './themed-text';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type CategoryChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Marks a chip that opens a sheet rather than toggling in place. */
  trailingIcon?: 'chevron-down';
};

/**
 * One tappable filter in the Home screen's top bar.
 *
 * Styled as plain text rather than a bordered pill: in the reference the
 * only pill on that strip is the location, and making every filter a pill
 * too costs the location its distinctness and makes the bar read as a row
 * of buttons instead of a row of choices. Selection is carried by weight +
 * color, which is also why the selected state doesn't need `primarySoft`
 * here — that token is still used for selected-pill backgrounds in the nav.
 */
export function CategoryChip({ label, selected, onPress, trailingIcon }: CategoryChipProps) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [styles.chip, pressed && styles.pressed]}>
      <View style={styles.content}>
        <ThemedText
          type={selected ? 'smallBold' : 'small'}
          themeColor={selected ? 'primary' : 'textSecondary'}>
          {label}
        </ThemedText>
        {trailingIcon ? (
          <Ionicons
            name={trailingIcon}
            size={12}
            color={selected ? theme.primary : theme.textSecondary}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: Spacing.one,
    paddingVertical: Spacing.two,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  pressed: {
    opacity: 0.6,
  },
});
