import Ionicons from '@expo/vector-icons/Ionicons';
import * as WebBrowser from 'expo-web-browser';
import { useMemo, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { BottomSheet } from './bottom-sheet';
import { MonthCalendar } from './month-calendar';
import { ThemedText } from './themed-text';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Show, Showtime } from '@/types/show';
import { toDayKey, type DayKey } from '@/utils/date-filter';

/**
 * The calendar's span, derived from the show's own dates rather than fixed.
 *
 * `from` is the first performance's month, so a production that opens in
 * two months doesn't greet the user with two empty grids to page past. `to`
 * is the last one's, so there is nothing to scroll into beyond the run.
 */
function calendarRange(days: DayKey[]): { startDay: DayKey; months: number } | null {
  if (days.length === 0) return null;

  const sorted = [...days].sort();
  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  const [fromYear, fromMonth] = first.split('-').map(Number);
  const [toYear, toMonth] = last.split('-').map(Number);

  return {
    startDay: first,
    // Inclusive of both ends: a run inside one month is one grid, not zero.
    months: (toYear - fromYear) * 12 + (toMonth - fromMonth) + 1,
  };
}

type ShowtimePickerSheetProps = {
  visible: boolean;
  onClose: () => void;
  show: Show;
};

/**
 * Picks a specific performance, then hands off to the theater's own
 * ticketing page for it.
 *
 * The button used to jump straight to the soonest showtime's link, which
 * quietly decided for the user — a show with 40 upcoming dates offered
 * exactly one, and no way to see the rest. `purchase_url` is per *showtime*,
 * not per show (the same production on two dates has two listings), so
 * choosing the date here is what makes the handoff land on the right page.
 *
 * Two steps rather than one long list: a calendar answers "when can I go",
 * which is the question someone opens this with, and it collapses a show
 * with dozens of performances into something scannable. The time step then
 * only appears where it carries information — a day with a single
 * performance still shows it, so the flow never silently assumes.
 */
export function ShowtimePickerSheet({ visible, onClose, show }: ShowtimePickerSheetProps) {
  const theme = useTheme();
  const [selectedDay, setSelectedDay] = useState<DayKey | null>(null);
  const [opening, setOpening] = useState(false);

  // Re-seed on each open, so yesterday's half-finished choice doesn't
  // reappear the next time the sheet is raised.
  const [lastVisible, setLastVisible] = useState(visible);
  if (visible !== lastVisible) {
    setLastVisible(visible);
    if (visible) setSelectedDay(null);
  }

  // `DayKey → performances on that day`, built once per show. Both the
  // calendar's "is this day selectable" test and the time list read it, so
  // neither has to scan every showtime on every render.
  const byDay = useMemo(() => {
    const map = new Map<DayKey, Showtime[]>();
    for (const showtime of show.showtimes) {
      const day = toDayKey(new Date(showtime.startsAt));
      const existing = map.get(day);
      if (existing) existing.push(showtime);
      else map.set(day, [showtime]);
    }
    for (const list of map.values()) list.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return map;
  }, [show.showtimes]);

  const range = useMemo(() => calendarRange([...byDay.keys()]), [byDay]);
  const times = selectedDay ? (byDay.get(selectedDay) ?? []) : [];

  /**
   * Hands off to the theater's ticketing page for this exact performance.
   *
   * The sheet is closed *after* the browser resolves, never before. On iOS
   * `BottomSheet`'s `Modal` presents its own view controller, and
   * `openBrowserAsync` presents `SFSafariViewController` on top of it — so
   * closing the sheet first tore down the parent and took the just-opened
   * browser down with it. The browser appeared and vanished in the same
   * instant, which is exactly what it looked like.
   *
   * `openBrowserAsync` settles when the user dismisses the browser, so
   * awaiting it also lands the sheet's dismissal at the right moment:
   * coming back from the ticketing site returns you to the show, not to the
   * picker you already used.
   */
  async function openTicketing(showtime: Showtime) {
    // A second tap while a browser is being presented would try to present
    // another one on top of it.
    if (opening) return;
    setOpening(true);

    try {
      await WebBrowser.openBrowserAsync(showtime.purchaseUrl);
    } catch {
      // `Linking` hands off to the system browser instead of presenting
      // in-app, so it isn't subject to the presentation rule that broke the
      // call above — it's the right fallback rather than a retry of the same
      // thing.
      try {
        await Linking.openURL(showtime.purchaseUrl);
      } catch {
        // Never fail silently: without this the promise rejected into
        // nothing and the button looked simply dead.
        Alert.alert('לא הצלחנו לפתוח את עמוד הרכישה', 'נסו שוב, או פתחו את אתר התיאטרון ישירות.');
      }
    } finally {
      setOpening(false);
      onClose();
    }
  }

  return (
    <BottomSheet visible={visible} onClose={onClose} title="בחירת מועד">
      {!range ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
          אין כרגע מועדים זמינים להצגה הזו.
        </ThemedText>
      ) : (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            {selectedDay ? 'בחרו שעה כדי להמשיך לרכישה.' : 'הימים המסומנים הם אלה שיש בהם הצגה.'}
          </ThemedText>

          <MonthCalendar
            months={range.months}
            startDay={range.startDay}
            isSelectable={(day) => byDay.has(day)}
            isSelected={(day) => day === selectedDay}
            onDayPress={setSelectedDay}
            // Shorter than the filter sheet's calendar: the time list opens
            // underneath it, and both have to fit above the sheet's edge.
            maxHeight={selectedDay ? 200 : 320}
          />

          {selectedDay ? (
            <View style={styles.times}>
              <ThemedText type="smallBold">{formatDayHeading(selectedDay)}</ThemedText>

              <ScrollView style={styles.timesList} showsVerticalScrollIndicator={false}>
                {times.map((showtime) => (
                  <Pressable
                    key={showtime.id}
                    onPress={() => openTicketing(showtime)}
                    disabled={opening}
                    accessibilityRole="link"
                    accessibilityLabel={`רכישת כרטיסים ל${show.name} בשעה ${formatTime(showtime.startsAt)}`}
                    accessibilityState={{ disabled: opening }}
                    style={({ pressed }) => [
                      styles.timeRow,
                      { borderColor: theme.backgroundSelected },
                      pressed && styles.pressed,
                      opening && styles.pressed,
                    ]}>
                    <ThemedText type="smallBold">{formatTime(showtime.startsAt)}</ThemedText>
                    <View style={styles.timeRowEnd}>
                      <ThemedText type="small" themeColor="primary">
                        לרכישה
                      </ThemedText>
                      {/* Points along the reading direction: under RTL the
                          "forward" chevron is the one facing left. */}
                      <Ionicons name="chevron-back" size={16} color={theme.primary} />
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}
        </>
      )}
    </BottomSheet>
  );
}

/** "שבת, 14 בנוב׳" — the day itself, without a time. */
function formatDayHeading(day: DayKey): string {
  const [year, month, date] = day.split('-').map(Number);
  return new Intl.DateTimeFormat('he-IL', { weekday: 'long', day: 'numeric', month: 'short' }).format(
    new Date(year, month - 1, date),
  );
}

/**
 * "20:00". Built from the string's own characters rather than from a `Date`:
 * `starts_at` is stored as the theater's wall-clock time with no zone, so
 * parsing it and formatting it back would shift it by the device's offset.
 */
function formatTime(startsAt: string): string {
  return startsAt.slice(11, 16);
}

const styles = StyleSheet.create({
  empty: {
    textAlign: 'center',
    paddingVertical: Spacing.four,
  },
  times: {
    gap: Spacing.two,
  },
  timesList: {
    maxHeight: 180,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
    marginBottom: Spacing.two,
  },
  timeRowEnd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  pressed: {
    opacity: 0.6,
  },
});
