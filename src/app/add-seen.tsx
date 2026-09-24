import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AddSeenSheet } from '@/components/add-seen-sheet';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import type { SeenOn } from '@/data/watchlist-backend';
import { useHomeFeed } from '@/hooks/use-home-feed';
import { useTheme } from '@/hooks/use-theme';
import { useWatchlist } from '@/hooks/use-watchlist';

/**
 * Recording a show the catalogue does not have.
 *
 * A screen rather than the bottom sheet this replaces, and the reason is the
 * keyboard. A sheet and a keyboard both want to own the bottom of the
 * screen; the sheet gets pushed, clipped, or covers its own submit button,
 * and no amount of avoidance tuning makes three text fields comfortable in
 * one. A pushed route simply scrolls.
 *
 * It is also a deliberate inversion. Marking a *catalogue* show as seen is
 * already possible by swiping it in the watchlist, so that is not what this
 * screen is for — it exists for the shows that have no other way in: a
 * production on Broadway, in the West End, at a festival abroad. The
 * catalogue is still reachable from here, as the secondary path.
 */
export default function AddSeenScreen() {
  const theme = useTheme();
  const router = useRouter();
  const result = useHomeFeed();
  const { addCustom, setStatusMany, seenIds } = useWatchlist();

  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [when, setWhen] = useState('');
  const [whenError, setWhenError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const allShows = result.status === 'ready' ? result.feed.all : [];

  const trimmedName = name.trim();
  const canSave = trimmedName.length > 0;

  function save() {
    const parsed = parseWhen(when);
    if (parsed === 'invalid') {
      setWhenError('אפשר שנה (2019) או תאריך מלא (14.3.2019).');
      return;
    }

    addCustom(
      {
        name: trimmedName,
        ...(location.trim() ? { location: location.trim() } : {}),
        ...(parsed ? { seenOn: parsed } : {}),
      },
      'seen',
    );
    router.back();
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="סגירה"
            hitSlop={Spacing.three}>
            <Ionicons name="close" size={26} color={theme.text} />
          </Pressable>
        </View>

        {/* `KeyboardAvoidingView` around the scroll rather than the fields:
            the whole form has to move as one, or the submit button ends up
            under the keyboard while the field above it is visible. */}
        <KeyboardAvoidingView
          style={styles.fill}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <ThemedText type="title" style={styles.title}>
              הצגה שראיתי
            </ThemedText>
            <ThemedText themeColor="textSecondary">
              להצגה שלא נמצאת אצלנו — בברודוויי, בווסט אנד, בפסטיבל או בכל מקום אחר.
            </ThemedText>

            <Field label="שם ההצגה" required>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="למשל: Hamilton"
                placeholderTextColor={theme.textSecondary}
                style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
                accessibilityLabel="שם ההצגה"
                autoFocus
                returnKeyType="next"
              />
            </Field>

            <Field label="איפה ראיתם?">
              <TextInput
                value={location}
                onChangeText={setLocation}
                placeholder="למשל: Victoria Palace, לונדון"
                placeholderTextColor={theme.textSecondary}
                style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
                accessibilityLabel="איפה ראיתם"
                returnKeyType="next"
              />
            </Field>

            <Field label="מתי?" hint="שנה בלבד או תאריך מלא — מה שאתם זוכרים.">
              <TextInput
                value={when}
                onChangeText={(next) => {
                  setWhen(next);
                  if (whenError) setWhenError(null);
                }}
                placeholder="2019  או  14.3.2019"
                placeholderTextColor={theme.textSecondary}
                style={[
                  styles.input,
                  {
                    color: theme.text,
                    borderColor: whenError ? theme.primary : theme.backgroundSelected,
                  },
                ]}
                accessibilityLabel="מתי ראיתם"
                keyboardType="numbers-and-punctuation"
                returnKeyType="done"
                onSubmitEditing={() => canSave && save()}
              />
              {whenError ? (
                <ThemedText type="small" themeColor="primary">
                  {whenError}
                </ThemedText>
              ) : null}
            </Field>

            <Pressable
              onPress={save}
              disabled={!canSave}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSave }}
              style={({ pressed }) => [
                styles.submit,
                {
                  backgroundColor: theme.primary,
                  // Dimming rather than recolouring: a disabled state built
                  // from its own colours is one more pair to keep legible.
                  opacity: !canSave ? 0.5 : pressed ? 0.8 : 1,
                },
              ]}>
              <ThemedText type="smallBold" style={{ color: theme.background }}>
                הוספה לרשימה
              </ThemedText>
            </Pressable>

            {/* The other route in, kept but plainly secondary. It stays a
                sheet rather than a second screen because all it needs is one
                search field and a list — the keyboard problem that moved
                this screen out of a sheet was the three-field form, not the
                sheet itself. */}
            <Pressable
              onPress={() => setPickerOpen(true)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
              <ThemedText type="small" themeColor="textSecondary">
                ההצגה קיימת אצלנו? בחרו מהקטלוג
              </ThemedText>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <AddSeenSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        shows={allShows}
        seenIds={seenIds}
        onAdd={(ids) => {
          setStatusMany(ids, 'seen');
          router.back();
        }}
      />
    </ThemedView>
  );
}

function Field({
  label,
  hint,
  required = false,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">
        {label}
        {required ? null : ' '}
        {required ? null : (
          <ThemedText type="small" themeColor="textSecondary">
            (רשות)
          </ThemedText>
        )}
      </ThemedText>
      {children}
      {hint ? (
        <ThemedText type="small" themeColor="textSecondary">
          {hint}
        </ThemedText>
      ) : null}
    </View>
  );
}

/**
 * Reads "2019" or "14.3.2019" into a stored date.
 *
 * Returns `null` for an empty field — the date is optional and a blank one is
 * not a mistake — and `'invalid'` only for text that was meant to be a date
 * and is not, so that a typo is reported rather than silently dropped.
 *
 * Deliberately narrow. A date picker would be the obvious alternative and is
 * the wrong tool here: the thing being recorded is often years ago and only
 * half-remembered, and spinning a wheel back through months to reach 2014 is
 * far worse than typing four digits.
 */
export function parseWhen(input: string): SeenOn | null | 'invalid' {
  const text = input.trim();
  if (!text) return null;

  // Year alone. Bounded at both ends: a four-digit number outside this range
  // is a typo, not a memory.
  if (/^\d{4}$/.test(text)) {
    const year = Number(text);
    if (year < 1900 || year > new Date().getFullYear()) return 'invalid';
    return { date: `${year}-01-01`, precision: 'year' };
  }

  // Day.month.year, the order written in Hebrew. Separators are whatever
  // came to hand.
  const parts = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(text);
  if (!parts) return 'invalid';

  const [day, month, year] = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  // Rebuilt and compared rather than range-checked, so 31.2 is rejected as
  // the impossible date it is instead of rolling over into March.
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    year < 1900 ||
    date.getTime() > Date.now()
  ) {
    return 'invalid';
  }

  return { date: date.toISOString().slice(0, 10), precision: 'day' };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // Transparent so the app-wide gradient behind every screen shows through.
    backgroundColor: 'transparent',
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  fill: {
    flex: 1,
  },
  header: {
    // Leading edge under RTL, which is where a close control belongs.
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
  },
  content: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
  },
  field: {
    gap: Spacing.two,
  },
  input: {
    fontSize: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    // Android gives inputs extra vertical padding no other text has, which
    // makes the field taller than its own border box suggests.
    includeFontPadding: false,
  },
  submit: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    borderRadius: Spacing.three,
    marginTop: Spacing.two,
  },
  secondary: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  pressed: {
    opacity: 0.6,
  },
});
