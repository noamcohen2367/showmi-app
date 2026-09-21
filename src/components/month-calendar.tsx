import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from './themed-text';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { toDayKey, todayKey, type DayKey } from '@/utils/date-filter';

/** Sunday-first, matching both the Hebrew week and the reference's grid. */
const WEEKDAY_LABELS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

const MONTH_NAMES = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

type Month = { key: string; year: number; month: number; leadingBlanks: number; days: DayKey[] };

type MonthCalendarProps = {
  /** How many months to render, starting at `startDay`'s month. */
  months: number;
  /**
   * Which month to open on. Defaults to the current one.
   *
   * The purchase sheet passes its show's first performance: a production
   * that opens in two months would otherwise start the user on two empty
   * grids to page past, with nothing explaining why they're blank.
   */
  startDay?: DayKey;
  /** True for a day the user may tap. Past days are blocked regardless. */
  isSelectable: (day: DayKey) => boolean;
  /** True for a day that should read as chosen. */
  isSelected: (day: DayKey) => boolean;
  onDayPress: (day: DayKey) => void;
  /** Caps the scrolling area so a sheet's footer stays on screen. */
  maxHeight?: number;
};

/**
 * A scrolling run of month grids.
 *
 * Shared by the Home screen's date filter and the show-detail purchase
 * sheet, which need the same grid for different reasons — one narrows a
 * feed, the other picks a performance. Everything specific to either lives
 * in the two predicates the caller passes, so there is one implementation of
 * the grid itself rather than two that drift.
 */
export function MonthCalendar({
  months,
  startDay,
  isSelectable,
  isSelected,
  onDayPress,
  maxHeight = 340,
}: MonthCalendarProps) {
  const grids = useMemo(() => buildMonths(months, startDay), [months, startDay]);

  return (
    <>
      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((label) => (
          <ThemedText key={label} type="small" themeColor="textSecondary" style={styles.weekdayLabel}>
            {label}
          </ThemedText>
        ))}
      </View>

      <ScrollView style={{ maxHeight }} showsVerticalScrollIndicator={false}>
        {grids.map((month) => (
          <MonthGrid
            key={month.key}
            month={month}
            isSelectable={isSelectable}
            isSelected={isSelected}
            onDayPress={onDayPress}
          />
        ))}
      </ScrollView>
    </>
  );
}

function buildMonths(count: number, startDay?: DayKey): Month[] {
  // Parsed from the parts rather than `new Date(startDay)`, which would read
  // a bare `YYYY-MM-DD` as UTC midnight and land on the previous month for
  // anywhere east of Greenwich on the 1st.
  const start = startDay
    ? (() => {
        const [year, month] = startDay.split('-').map(Number);
        return new Date(year, month - 1, 1);
      })()
    : new Date();

  return Array.from({ length: count }, (_, offset) => {
    const first = new Date(start.getFullYear(), start.getMonth() + offset, 1);
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
  isSelectable,
  isSelected,
  onDayPress,
}: {
  month: Month;
  isSelectable: (day: DayKey) => boolean;
  isSelected: (day: DayKey) => boolean;
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
          const selected = isSelected(day);
          // Zero-padded YYYY-MM-DD sorts chronologically as plain text, so
          // "is it in the past" needs no parsing.
          const enabled = day >= today && isSelectable(day);
          return (
            <Pressable
              key={day}
              disabled={!enabled}
              onPress={() => onDayPress(day)}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled: !enabled }}
              style={({ pressed }) => [
                styles.day,
                selected && { backgroundColor: theme.primarySoft, borderColor: theme.primary },
                pressed && enabled && styles.dayPressed,
              ]}>
              <ThemedText
                type={selected ? 'smallBold' : 'small'}
                themeColor={!enabled ? 'textSecondary' : selected ? 'primary' : 'text'}
                style={[styles.dayLabel, !enabled && styles.dayDisabled]}>
                {Number(day.split('-')[2])}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Seven columns; the grid is symmetric, so it needs no RTL mirroring. */
const DAY_SIZE = `${100 / 7}%` as const;

/**
 * Height of one day cell, in points.
 *
 * Explicit rather than `aspectRatio: 1` against the percentage width. The
 * aspect ratio made the cell's height depend on a width that is only known
 * after layout, and the selection background ended up a different height
 * from the line box inside it — the number read as sitting low in its own
 * box. A fixed height makes the cell a known quantity, so `justifyContent`
 * has something real to centre against.
 *
 * 44 is also the minimum comfortable touch target, which a squashed cell
 * was not meeting.
 */
const DAY_HEIGHT = 44;

const styles = StyleSheet.create({
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
    height: DAY_HEIGHT,
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
    // Horizontal: fill the cell and centre within it, rather than leaning on
    // the parent's `alignItems` to centre a shrink-to-fit box. `ThemedText`
    // right-aligns everything by default in this RTL app, so a stretched
    // Text lands its digit against the right edge.
    width: '100%',
    textAlign: 'center',
    // Vertical: make the line box exactly as tall as the cell's content area
    // (the height minus its 1pt border top and bottom). A single line
    // centres its glyph inside its own line box, so matching the two is what
    // actually puts the digit in the middle — `justifyContent` alone centres
    // the *box*, which is not the same thing once `lineHeight` differs from
    // the cell height, and that gap is what showed up as a number sitting
    // low in the selection square.
    lineHeight: DAY_HEIGHT - 2,
    // Android otherwise pads the line box asymmetrically above and below the
    // glyph. Ignored on every other platform.
    includeFontPadding: false,
  },
  dayDisabled: {
    opacity: 0.35,
  },
});
