import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from './themed-text';

import { REGIONS } from '@/constants/regions';
import { Spacing } from '@/constants/theme';
import { UNIQUE_VIOLATION, type ProfileEdits } from '@/data/profile';
import { useTheme } from '@/hooks/use-theme';

/** Mirrors the database's own format check, so the user hears it first. */
const USERNAME_MIN = 3;
const USERNAME_MAX = 20;

export type ProfileFormValues = ProfileEdits & { isPublic: boolean };

/**
 * The one form behind both "finish signing up" and "edit your profile".
 *
 * Shared rather than duplicated because the two screens are the same fields
 * with different framing, and two copies of a form is how one of them ends
 * up validating a username differently from the other.
 *
 * What the screens still decide for themselves: whether the privacy switch
 * appears, what the button says, and where the user goes afterwards.
 */
export function ProfileForm({
  initial,
  submitLabel,
  showPrivacy = false,
  onSubmit,
}: {
  initial?: Partial<ProfileFormValues>;
  submitLabel: string;
  showPrivacy?: boolean;
  onSubmit: (values: ProfileFormValues) => Promise<void>;
}) {
  const theme = useTheme();

  const [fullName, setFullName] = useState(initial?.fullName ?? '');
  const [username, setUsername] = useState(initial?.username ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [region, setRegion] = useState<string | null>(initial?.region ?? null);
  const [birthDate, setBirthDate] = useState(initial?.birthDate ? formatBirthDate(initial.birthDate) : '');
  const [isPublic, setIsPublic] = useState(initial?.isPublic ?? false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedName = fullName.trim();
  const usernameProblem = validateUsername(username);
  const birthProblem = birthDate.trim() ? parseBirthDate(birthDate) === null : false;

  const canSave =
    trimmedName.length > 0 && username.length > 0 && !usernameProblem && !birthProblem && !saving;

  async function submit() {
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        fullName: trimmedName,
        username,
        ...(phone.trim() ? { phone: phone.trim() } : {}),
        ...(region ? { region } : {}),
        ...(birthDate.trim() ? { birthDate: parseBirthDate(birthDate) ?? undefined } : {}),
        isPublic,
      });
    } catch (caught) {
      // The unique index is what really decides whether a name is free: a
      // check beforehand cannot see names held by people whose profile is
      // closed, because those rows are not in the public view.
      const code = (caught as { code?: string })?.code;
      setError(
        code === UNIQUE_VIOLATION
          ? 'שם המשתמש הזה כבר תפוס. נסו אחר.'
          : 'לא הצלחנו לשמור. בדקו את החיבור ונסו שוב.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <Field label="שם">
          <TextInput
            value={fullName}
            onChangeText={setFullName}
            placeholder="איך קוראים לך?"
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
            accessibilityLabel="שם"
            returnKeyType="next"
          />
        </Field>

        <Field
          label="שם משתמש"
          hint={`אותיות באנגלית וספרות, ${USERNAME_MIN}–${USERNAME_MAX} תווים. כך יראו אותך אחרים.`}>
          <View
            style={[
              styles.usernameRow,
              { borderColor: usernameProblem ? theme.primary : theme.backgroundSelected },
            ]}>
            <ThemedText themeColor="textSecondary" style={styles.at}>
              @
            </ThemedText>
            <TextInput
              value={username}
              // Lowercased as it is typed rather than corrected on save, so
              // what the field shows is what will be stored.
              onChangeText={(next) => setUsername(next.toLowerCase().trim())}
              placeholder="noam"
              placeholderTextColor={theme.textSecondary}
              style={[styles.usernameInput, { color: theme.text }]}
              accessibilityLabel="שם משתמש"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={USERNAME_MAX}
              returnKeyType="next"
            />
          </View>
          {usernameProblem ? (
            <ThemedText type="small" themeColor="primary">
              {usernameProblem}
            </ThemedText>
          ) : null}
        </Field>

        <Field label="טלפון" optional>
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="050-0000000"
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
            accessibilityLabel="טלפון"
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
          />
        </Field>

        <Field label="אזור מגורים" optional>
          <View style={styles.regions}>
            {REGIONS.map((option) => {
              const selected = region === option;
              return (
                <Pressable
                  key={option}
                  onPress={() => setRegion(selected ? null : option)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={({ pressed }) => [
                    styles.region,
                    {
                      backgroundColor: selected ? theme.primarySoft : theme.backgroundElement,
                      borderColor: selected ? theme.primary : 'transparent',
                    },
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText type="small" themeColor={selected ? 'primary' : 'text'}>
                    {option}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </Field>

        <Field label="יום הולדת" optional hint="למשל 14.3.1990">
          <TextInput
            value={birthDate}
            onChangeText={setBirthDate}
            placeholder="14.3.1990"
            placeholderTextColor={theme.textSecondary}
            style={[
              styles.input,
              {
                color: theme.text,
                borderColor: birthProblem ? theme.primary : theme.backgroundSelected,
              },
            ]}
            accessibilityLabel="יום הולדת"
            keyboardType="numbers-and-punctuation"
            returnKeyType="done"
          />
          {birthProblem ? (
            <ThemedText type="small" themeColor="primary">
              תאריך לא תקין.
            </ThemedText>
          ) : null}
        </Field>

        {showPrivacy ? (
          <View style={[styles.privacy, { backgroundColor: theme.backgroundElement }]}>
            <View style={styles.privacyText}>
              <ThemedText type="smallBold">פרופיל ציבורי</ThemedText>
              {/* Says exactly what opening it publishes, and exactly what it
                  does not. Someone toggling this is consenting to something
                  and deserves to know its shape. */}
              <ThemedText type="small" themeColor="textSecondary">
                אחרים יוכלו לראות את השם, שם המשתמש וההצגות שראיתם — כולל אלה שהוספתם
                ידנית. מה שרשום ב״רוצה לראות״ נשאר פרטי תמיד.
              </ThemedText>
            </View>
            <Switch
              value={isPublic}
              onValueChange={setIsPublic}
              accessibilityLabel="פרופיל ציבורי"
              trackColor={{ true: theme.primary, false: theme.backgroundSelected }}
            />
          </View>
        ) : null}

        <Pressable
          onPress={submit}
          disabled={!canSave}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSave }}
          style={({ pressed }) => [
            styles.submit,
            { backgroundColor: theme.primary, opacity: !canSave ? 0.5 : pressed ? 0.8 : 1 },
          ]}>
          {saving ? (
            <ActivityIndicator color={theme.background} />
          ) : (
            <ThemedText type="smallBold" style={{ color: theme.background }}>
              {submitLabel}
            </ThemedText>
          )}
        </Pressable>

        {error ? (
          <ThemedText type="small" themeColor="primary" style={styles.centered}>
            {error}
          </ThemedText>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  hint,
  optional = false,
  children,
}: {
  label: string;
  hint?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">
        {label}
        {optional ? (
          <ThemedText type="small" themeColor="textSecondary">
            {'  '}(רשות)
          </ThemedText>
        ) : null}
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

export function validateUsername(value: string): string | null {
  if (!value) return null;
  if (value.length < USERNAME_MIN) return `לפחות ${USERNAME_MIN} תווים.`;
  if (!/^[a-z0-9_]+$/.test(value)) return 'אותיות באנגלית קטנות, ספרות וקו תחתון בלבד.';
  return null;
}

/** `14.3.1990` → `1990-03-14`, or null if it is not a real past date. */
export function parseBirthDate(input: string): string | null {
  const parts = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(input.trim());
  if (!parts) return null;

  const [day, month, year] = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  // Rebuilt and compared rather than range-checked, so 31.2 is rejected as
  // the impossible date it is instead of rolling over into March.
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day ||
    date.getTime() >= Date.now() ||
    year < new Date().getFullYear() - 130
  ) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

/** `1990-03-14` → `14.3.1990`, the shape the field accepts back. */
function formatBirthDate(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${Number(day)}.${Number(month)}.${year}`;
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  content: {
    paddingBottom: Spacing.six,
    gap: Spacing.four,
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
    // Android gives inputs extra vertical padding no other text has.
    includeFontPadding: false,
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  at: {
    fontSize: 16,
  },
  usernameInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Spacing.three,
    includeFontPadding: false,
    // A username is Latin; it stays left-to-right on a right-to-left screen.
    textAlign: 'left',
  },
  regions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  region: {
    borderWidth: 1,
    borderRadius: Spacing.five,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  privacy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  privacyText: {
    flex: 1,
    gap: Spacing.one,
  },
  submit: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    borderRadius: Spacing.three,
    marginTop: Spacing.two,
  },
  centered: {
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
});
