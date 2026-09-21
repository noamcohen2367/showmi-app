import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BottomSheet, SheetButton } from './bottom-sheet';
import { MonthCalendar } from './month-calendar';
import { ThemedText } from './themed-text';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  addDays,
  NO_DATE_FILTER,
  orderRange,
  todayKey,
  weekendRange,
  type DateFilter,
  type DayKey,
} from '@/utils/date-filter';

/** How many months forward the grid offers. */
const MONTHS_SHOWN = 6;

type DateFilterSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** The filter currently applied — the sheet opens showing this. */
  value: DateFilter;
  onApply: (filter: DateFilter) => void;
};

/**
 * The date filter's sheet: three quick presets, then a scrolling month grid
 * for anything they don't cover.
 *
 * Tapping builds a selection *locally*; nothing reaches the feed until
 * "סינון" is pressed, so an exploratory tap on the calendar can be undone by
 * dismissing. That's also why `draft` is seeded from `value` on each open.
 *
 * Range selection has no separate mode switch: the first tap sets a single
 * day, a second tap extends it into a range, and a third starts over. That's
 * how a range gets picked without asking the user to declare intent first.
 */
export function DateFilterSheet({ visible, onClose, value, onApply }: DateFilterSheetProps) {
  const [draft, setDraft] = useState<DateFilter>(value);

  // Re-seed whenever the sheet is reopened, so a dismissed edit doesn't
  // linger into the next open.
  const [lastVisible, setLastVisible] = useState(visible);
  if (visible !== lastVisible) {
    setLastVisible(visible);
    if (visible) setDraft(value);
  }

  function handleDayPress(day: DayKey) {
    setDraft((current) => {
      // Second tap on an existing single day → range. Any tap while a range
      // is already set starts over, so the grid never gets into a state the
      // user can't escape by tapping again.
      if (current.kind === 'day') {
        if (current.day === day) return NO_DATE_FILTER;
        return { kind: 'range', ...orderRange(current.day, day) };
      }
      return { kind: 'day', day };
    });
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
    <BottomSheet visible={visible} onClose={onClose} title="סינון לפי תאריך" footer={footer}>
      <View style={styles.presets}>
        <PresetChip label="היום" onPress={() => setDraft({ kind: 'day', day: todayKey() })} active={isToday(draft)} />
        <PresetChip
          label="מחר"
          onPress={() => setDraft({ kind: 'day', day: addDays(todayKey(), 1) })}
          active={isTomorrow(draft)}
        />
        <PresetChip label="סופ״ש" onPress={() => setDraft({ kind: 'range', ...weekendRange() })} active={isWeekend(draft)} />
      </View>

      {/* The same grid the purchase sheet uses. Every day is selectable
          here — this filters a feed rather than picking a performance, so
          a date with nothing on it is a legitimate (if empty) choice. */}
      <MonthCalendar
        months={MONTHS_SHOWN}
        isSelectable={() => true}
        isSelected={(day) => isSelected(day, draft)}
        onDayPress={handleDayPress}
      />

      {draft.kind !== 'none' ? (
        <Pressable onPress={() => setDraft(NO_DATE_FILTER)} accessibilityRole="button">
          <ThemedText type="small" themeColor="primary" style={styles.clear}>
            ניקוי הבחירה
          </ThemedText>
        </Pressable>
      ) : null}
    </BottomSheet>
  );
}

function PresetChip({ label, onPress, active }: { label: string; onPress: () => void; active: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [
        styles.preset,
        { backgroundColor: active ? theme.primarySoft : theme.backgroundElement },
        active && { borderColor: theme.primary },
        pressed && styles.pressed,
      ]}>
      <ThemedText type="smallBold" themeColor={active ? 'primary' : 'text'}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function isSelected(day: DayKey, filter: DateFilter) {
  if (filter.kind === 'day') return day === filter.day;
  if (filter.kind === 'range') return day >= filter.from && day <= filter.to;
  return false;
}

const isToday = (f: DateFilter) => f.kind === 'day' && f.day === todayKey();
const isTomorrow = (f: DateFilter) => f.kind === 'day' && f.day === addDays(todayKey(), 1);
function isWeekend(f: DateFilter) {
  if (f.kind !== 'range') return false;
  const weekend = weekendRange();
  return f.from === weekend.from && f.to === weekend.to;
}

const styles = StyleSheet.create({
  presets: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  preset: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  // The grid's own styles moved to `month-calendar.tsx` along with it; what
  // is left here is only the preset row and the clear link.
  pressed: {
    opacity: 0.6,
  },
  clear: {
    textAlign: 'center',
    paddingTop: Spacing.two,
  },
});
