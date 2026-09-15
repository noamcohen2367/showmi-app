import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { BottomSheet, SheetButton } from './bottom-sheet';
import { ThemedText } from './themed-text';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  addDays,
  NO_DATE_FILTER,
  orderRange,
  todayKey,
  toDayKey,
  weekendRange,
  type DateFilter,
  type DayKey,
} from '@/utils/date-filter';

/** How many months forward the grid offers. */
const MONTHS_SHOWN = 6;

/** Sunday-first, matching both the reference's grid and the Hebrew week. */
const WEEKDAY_LABELS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

const MONTH_NAMES = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

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

  const months = useMemo(() => buildMonths(MONTHS_SHOWN), []);

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

      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((label) => (
          <ThemedText key={label} type="small" themeColor="textSecondary" style={styles.weekdayLabel}>
            {label}
          </ThemedText>
        ))}
      </View>

      <ScrollView style={styles.grid} showsVerticalScrollIndicator={false}>
        {months.map((month) => (
          <MonthGrid key={month.key} month={month} draft={draft} onDayPress={handleDayPress} />
        ))}
      </ScrollView>

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

type Month = { key: string; year: number; month: number; leadingBlanks: number; days: DayKey[] };

function buildMonths(count: number): Month[] {
  const now = new Date();
  return Array.from({ length: count }, (_, offset) => {
    const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const year = first.getFullYear();
    const month = first.getMonth();
    // Day 0 of the *next* month is the last day of this one.
    const dayCount = new Date(year, month + 1, 0).getDate();
    return {
      key: `${year}-${month}`,
      year,
      month,
      leadingBlanks: first.getDay(),
      days: Array.from({ length: dayCount }, (_, i) => toDayKey(new Date(year, month, i + 1))),
    };
  });
}

function MonthGrid({
  month,
  draft,
  onDayPress,
}: {
  month: Month;
  draft: DateFilter;
  onDayPress: (day: DayKey) => void;
}) {
  const theme = useTheme();
  const today = todayKey();

  return (
    <View style={styles.month}>
      <ThemedText type="smallBold" style={styles.monthTitle}>
        {MONTH_NAMES[month.month]} {month.year}
      </ThemedText>

      <View style={styles.monthDays}>
        {Array.from({ length: month.leadingBlanks }, (_, i) => (
          <View key={`blank-${i}`} style={styles.day} />
        ))}

        {month.days.map((day) => {
          const selected = isSelected(day, draft);
          const past = day < today;
          return (
            <Pressable
              key={day}
              disabled={past}
              onPress={() => onDayPress(day)}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled: past }}
              style={({ pressed }) => [
                styles.day,
                selected && { backgroundColor: theme.primarySoft, borderColor: theme.primary },
                pressed && !past && styles.dayPressed,
              ]}>
              <ThemedText
                type={selected ? 'smallBold' : 'small'}
                themeColor={past ? 'textSecondary' : selected ? 'primary' : 'text'}
                style={[styles.dayLabel, past && styles.dayPast]}>
                {Number(day.split('-')[2])}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
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
        pressed && styles.dayPressed,
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

/** Seven columns; the grid is symmetric, so it needs no RTL mirroring of its own. */
const DAY_SIZE = `${100 / 7}%` as const;

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
  weekdayRow: {
    // A plain row: under `forceRTL` this already runs right-to-left, which
    // puts א (Sunday) on the right — where a Hebrew calendar starts. The day
    // cells below use the same direction, so columns stay aligned with it.
    flexDirection: 'row',
  },
  weekdayLabel: {
    width: DAY_SIZE,
    textAlign: 'center',
  },
  grid: {
    maxHeight: 340,
  },
  month: {
    marginBottom: Spacing.three,
  },
  monthTitle: {
    marginBottom: Spacing.two,
  },
  monthDays: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  day: {
    width: DAY_SIZE,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dayPressed: {
    opacity: 0.6,
  },
  dayLabel: {
    textAlign: 'center',
  },
  dayPast: {
    opacity: 0.35,
  },
  clear: {
    textAlign: 'center',
    paddingTop: Spacing.two,
  },
});
