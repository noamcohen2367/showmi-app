import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { BottomSheet, SheetButton } from './bottom-sheet';
import { ThemedText } from './themed-text';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type CategoryFilterSheetProps = {
  visible: boolean;
  onClose: () => void;
  categories: string[];
  /** Currently applied selection; empty means "all categories". */
  value: string[];
  onApply: (categories: string[]) => void;
};

/**
 * The category filter's sheet: a checkable list, applied as a set.
 *
 * Multi-select, unlike the single-category chips this replaced — picking
 * both "מחזמר" and "ילדים" now means "either", which the old one-at-a-time
 * row couldn't express at all.
 *
 * Like the date sheet, the selection is a local draft until "סינון" is
 * pressed, so dismissing leaves the feed exactly as it was.
 */
export function CategoryFilterSheet({ visible, onClose, categories, value, onApply }: CategoryFilterSheetProps) {
  const theme = useTheme();
  const [draft, setDraft] = useState<string[]>(value);

  const [lastVisible, setLastVisible] = useState(visible);
  if (visible !== lastVisible) {
    setLastVisible(visible);
    if (visible) setDraft(value);
  }

  function toggle(category: string) {
    setDraft((current) =>
      current.includes(category) ? current.filter((c) => c !== category) : [...current, category],
    );
  }

  const footer = (
    <>
      <SheetButton label="ביטול" variant="secondary" onPress={onClose} />
      <SheetButton
        label="סינון"
        variant="primary"
        onPress={() => {
          onApply(draft);
          onClose();
        }}
      />
    </>
  );

  return (
    <BottomSheet visible={visible} onClose={onClose} title="קטגוריות" footer={footer}>
      <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
        {categories.map((category) => {
          const checked = draft.includes(category);
          return (
            <Pressable
              key={category}
              onPress={() => toggle(category)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
              <View
                style={[
                  styles.checkbox,
                  { borderColor: checked ? theme.primary : theme.backgroundSelected },
                  checked && { backgroundColor: theme.primary },
                ]}>
                {checked ? <Ionicons name="checkmark" size={16} color={theme.background} /> : null}
              </View>
              <ThemedText type={checked ? 'smallBold' : 'small'}>{category}</ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>

      {draft.length > 0 ? (
        <Pressable onPress={() => setDraft([])} accessibilityRole="button">
          <ThemedText type="small" themeColor="primary" style={styles.clear}>
            ניקוי הבחירה
          </ThemedText>
        </Pressable>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: {
    maxHeight: 360,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  pressed: {
    opacity: 0.6,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: Spacing.one,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clear: {
    textAlign: 'center',
    paddingTop: Spacing.two,
  },
});
