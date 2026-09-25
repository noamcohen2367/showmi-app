import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { BottomSheet, SheetButton } from './bottom-sheet';
import { ThemedText } from './themed-text';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Show } from '@/types/show';

type AddSeenSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** Every show in the catalogue; already-seen ones are filtered out here. */
  shows: Show[];
  /** Ids already marked seen — excluded from the list. */
  seenIds: readonly string[];
  onAdd: (showIds: string[]) => void;
};

/**
 * Picks shows to mark as already seen, without going through the watchlist
 * first.
 *
 * Until this existed the "ראיתי" list could only be reached by saving a show
 * and then swiping it across — so a show you saw before you ever opened the
 * app could not be recorded at all. This closes that.
 *
 * Multi-select and applied in one go, because the realistic use is filling in
 * several past shows at once rather than one.
 *
 * Catalogue shows only. A show that is not in it is recorded on its own
 * screen (`app/add-seen.tsx`) rather than here — that one needs a name, a
 * place and a date, and three text fields in a sheet fight the keyboard for
 * the same half of the screen.
 */
export function AddSeenSheet({ visible, onClose, shows, seenIds, onAdd }: AddSeenSheetProps) {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<string[]>([]);

  // Reset the query and selection each time the sheet opens, so a dismissed
  // edit never leaks into the next one.
  const [lastVisible, setLastVisible] = useState(visible);
  if (visible !== lastVisible) {
    setLastVisible(visible);
    if (visible) {
      setQuery('');
      setPicked([]);
    }
  }

  const candidates = useMemo(() => {
    const available = shows.filter((show) => !seenIds.includes(show.id));
    const trimmed = query.trim();
    if (!trimmed) return available;
    return available.filter(
      (show) =>
        show.name.includes(trimmed) ||
        show.theater.name.includes(trimmed) ||
        show.theater.city.includes(trimmed),
    );
  }, [shows, seenIds, query]);

  function toggle(showId: string) {
    setPicked((current) =>
      current.includes(showId) ? current.filter((id) => id !== showId) : [...current, showId],
    );
  }

  const footer = (
    <>
      <SheetButton label="ביטול" variant="secondary" onPress={onClose} />
      <SheetButton
        label={picked.length > 0 ? `הוספה (${picked.length})` : 'הוספה'}
        variant="primary"
        disabled={picked.length === 0}
        onPress={() => {
          onAdd(picked);
          onClose();
        }}
      />
    </>
  );

  return (
    <BottomSheet visible={visible} onClose={onClose} title="הוספת הצגות שראיתי" footer={footer}>
      <View style={[styles.search, { backgroundColor: theme.backgroundElement }]}>
        <Ionicons name="search-outline" size={18} color={theme.textSecondary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="חיפוש לפי שם, אולם או עיר"
          placeholderTextColor={theme.textSecondary}
          style={[styles.searchInput, { color: theme.text }]}
          accessibilityLabel="חיפוש הצגה"
        />
      </View>

      <ScrollView
        style={styles.list}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive">
        {candidates.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
            {shows.length === seenIds.length
              ? 'סימנת כבר את כל ההצגות בקטלוג.'
              : 'לא נמצאו הצגות שמתאימות לחיפוש.'}
          </ThemedText>
        ) : (
          candidates.map((show) => {
            const checked = picked.includes(show.id);
            return (
              <Pressable
                key={show.id}
                onPress={() => toggle(show.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
                accessibilityLabel={`${show.name}, ${show.theater.name}`}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                <View
                  style={[
                    styles.checkbox,
                    { borderColor: checked ? theme.primary : theme.backgroundSelected },
                    checked && { backgroundColor: theme.primary },
                  ]}>
                  {checked ? <Ionicons name="checkmark" size={16} color={theme.background} /> : null}
                </View>
                <View style={styles.rowText}>
                  <ThemedText type={checked ? 'smallBold' : 'small'} numberOfLines={1}>
                    {show.name}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {show.theater.name}, {show.theater.city}
                  </ThemedText>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  searchInput: {
    flex: 1,
    paddingVertical: Spacing.three,
    // RN's default is 'left'; the rest of the app right-aligns via
    // `ThemedText`, which a raw `TextInput` doesn't go through.
    textAlign: 'right',
  },
  customBox: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  noteInput: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    borderWidth: 1,
    textAlign: 'right',
  },
  customAdd: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
  },
  list: {
    // Shorter when the free-text box is showing, so the sheet doesn't grow
    // past its own max height and push the footer buttons off screen.
    maxHeight: 240,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  rowText: {
    flex: 1,
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
  empty: {
    textAlign: 'center',
    paddingVertical: Spacing.four,
  },
});
