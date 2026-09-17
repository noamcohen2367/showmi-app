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
  /** Records a show that isn't in the catalogue at all. */
  onAddCustom: (name: string, note: string | undefined) => void;
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
 * Only shows already in the catalogue can be picked. Recording a show that
 * isn't in it would mean storing a user-authored `Show` — a different data
 * shape, with no name, venue or poster to render — and that is a data-model
 * change rather than a screen.
 */
export function AddSeenSheet({ visible, onClose, shows, seenIds, onAdd, onAddCustom }: AddSeenSheetProps) {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [note, setNote] = useState('');

  // Reset the query, selection and note each time the sheet opens, so a
  // dismissed edit never leaks into the next one.
  const [lastVisible, setLastVisible] = useState(visible);
  if (visible !== lastVisible) {
    setLastVisible(visible);
    if (visible) {
      setQuery('');
      setPicked([]);
      setNote('');
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

  const trimmedQuery = query.trim();
  // Offer the free-text route whenever the typed name isn't already an exact
  // match in the catalogue. Not just when the search comes up empty: a
  // production abroad can easily share its name with one playing locally,
  // and the user still means the one they saw.
  const canAddCustom =
    trimmedQuery.length > 0 && !shows.some((show) => show.name === trimmedQuery);

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

      {/* The free-text route. Deliberately reuses the search field as its
          input rather than adding a separate "new show" form: the user has
          already typed the name looking for it, and asking them to retype it
          somewhere else is the whole friction this is meant to remove. */}
      {canAddCustom ? (
        <View style={[styles.customBox, { borderColor: theme.primary }]}>
          <ThemedText type="small" themeColor="textSecondary">
            לא מהקטלוג? אפשר להוסיף כטקסט חופשי — הצגה מחו״ל, תיאטרון פרטי, או כל דבר אחר.
          </ThemedText>

          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="איפה ראיתם? (רשות)"
            placeholderTextColor={theme.textSecondary}
            style={[styles.noteInput, { color: theme.text, borderColor: theme.backgroundSelected }]}
            accessibilityLabel="היכן ראיתם את ההצגה"
          />

          <Pressable
            onPress={() => {
              onAddCustom(trimmedQuery, note.trim() || undefined);
              onClose();
            }}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.customAdd,
              { backgroundColor: theme.primary },
              pressed && styles.pressed,
            ]}>
            <Ionicons name="add" size={16} color={theme.background} />
            <ThemedText type="smallBold" style={{ color: theme.background }} numberOfLines={1}>
              הוספת ״{trimmedQuery}״
            </ThemedText>
          </Pressable>
        </View>
      ) : null}

      <ScrollView style={styles.list} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
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
