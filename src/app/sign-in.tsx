import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { authRedirectUrl } from '@/data/auth-redirect';
import { supabase } from '@/data/supabase';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';

/**
 * Good enough on purpose. The address is proved by the fact that a link sent
 * to it gets opened, so this only needs to catch a typo before a mail is
 * sent — not to adjudicate what a valid address is, which no regex does well.
 */
function looksLikeEmail(value: string): boolean {
  const trimmed = value.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

type Phase =
  | { kind: 'idle' }
  | { kind: 'sending' }
  /** The mail is out; the screen now waits for the user to leave and return. */
  | { kind: 'sent'; email: string };

/**
 * Sign-in by emailed link.
 *
 * There is no password field and no account-creation step. Supabase creates
 * the account on first use of a link, so "sign up" and "sign in" are the same
 * action, and there is no password for anyone to lose, reuse or leak.
 *
 * Redeeming the link is NOT handled here — see `AuthProvider`. The mail is
 * often opened long after this screen is gone, or on a cold start, so the
 * callback belongs somewhere always mounted. This screen only sends, and
 * closes itself when a session appears by any route.
 */
export default function SignInScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { session, callbackError, clearCallbackError } = useAuth();

  const [email, setEmail] = useState('');
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [error, setError] = useState<string | null>(null);

  // Covers both routes to a session: the user redeemed a link while this
  // screen sat in the background, or signed in on another device.
  useEffect(() => {
    if (session) router.back();
  }, [session, router]);

  async function sendLink(address: string) {
    setPhase({ kind: 'sending' });
    setError(null);
    clearCallbackError();

    const { error: sendError } = await supabase.auth.signInWithOtp({
      email: address,
      options: { emailRedirectTo: authRedirectUrl() },
    });

    if (!sendError) {
      setPhase({ kind: 'sent', email: address });
      return;
    }

    setPhase({ kind: 'idle' });
    // 429 is the one a user hits by pressing again impatiently, and it is
    // worth naming precisely — "try again" without saying how long reads as
    // a bug rather than a limit.
    setError(
      sendError.status === 429
        ? 'נשלחו יותר מדי בקשות. נסה שוב בעוד דקה.'
        : 'לא הצלחנו לשלוח את הקישור. בדוק את החיבור ונסה שוב.',
    );
  }

  const trimmed = email.trim();
  const canSend = looksLikeEmail(trimmed) && phase.kind !== 'sending';
  const message = error ?? callbackError;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="סגירה"
            hitSlop={Spacing.three}>
            <Ionicons name="close" size={26} color={theme.text} />
          </Pressable>
        </View>

        {phase.kind === 'sent' ? (
          <View style={styles.block}>
            <ThemedText type="title" style={styles.title}>
              בדוק את המייל
            </ThemedText>
            <ThemedText themeColor="textSecondary">
              שלחנו קישור התחברות אל {phase.email}. פתח אותו מהמכשיר הזה כדי להיכנס.
            </ThemedText>
            {/* Not a footnote: opening the link on a desktop after asking for
                it on the phone is the single most likely way this fails, and
                the reason is invisible to the user. */}
            <ThemedText type="small" themeColor="textSecondary">
              הקישור עובד רק במכשיר שממנו ביקשת אותו.
            </ThemedText>

            <View style={styles.actions}>
              <Pressable
                onPress={() => void sendLink(phase.email)}
                accessibilityRole="button"
                hitSlop={Spacing.two}>
                <ThemedText type="smallBold" themeColor="primary">
                  שליחה חוזרת
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => setPhase({ kind: 'idle' })}
                accessibilityRole="button"
                hitSlop={Spacing.two}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  כתובת אחרת
                </ThemedText>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.block}>
            <ThemedText type="title" style={styles.title}>
              התחברות
            </ThemedText>
            <ThemedText themeColor="textSecondary">
              נשלח לך קישור למייל. אין סיסמה לזכור.
            </ThemedText>

            <View style={[styles.field, { borderColor: theme.backgroundSelected }]}>
              <Ionicons name="mail-outline" size={20} color={theme.textSecondary} />
              <TextInput
                value={email}
                onChangeText={setEmail}
                onSubmitEditing={() => canSend && void sendLink(trimmed)}
                placeholder="כתובת המייל שלך"
                placeholderTextColor={theme.textSecondary}
                style={[styles.input, { color: theme.text }]}
                accessibilityLabel="כתובת מייל"
                keyboardType="email-address"
                textContentType="emailAddress"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="send"
                // The field holds an address, which is written left-to-right
                // even on a right-to-left screen.
                textAlign="left"
                editable={phase.kind !== 'sending'}
              />
            </View>

            <Pressable
              onPress={() => void sendLink(trimmed)}
              disabled={!canSend}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSend }}
              style={({ pressed }) => [
                styles.submit,
                {
                  backgroundColor: theme.primarySoft,
                  borderColor: theme.primary,
                  // Dimming rather than recoloring: a disabled state built
                  // from its own colors is one more pair to keep legible.
                  opacity: !canSend ? 0.5 : pressed ? 0.7 : 1,
                },
              ]}>
              {phase.kind === 'sending' ? (
                <ActivityIndicator color={theme.primary} />
              ) : (
                <ThemedText type="smallBold" themeColor="primary">
                  שלח קישור התחברות
                </ThemedText>
              )}
            </Pressable>
          </View>
        )}

        {message ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.message}>
            {message}
          </ThemedText>
        ) : null}
      </SafeAreaView>
    </ThemedView>
  );
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
    paddingHorizontal: Spacing.four,
    gap: Spacing.five,
  },
  header: {
    // Leading edge under RTL, which is where a close control belongs.
    alignItems: 'flex-start',
    paddingTop: Spacing.two,
  },
  block: {
    gap: Spacing.three,
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  input: {
    flex: 1,
    fontSize: 16,
    // Android gives inputs extra vertical padding that no other text has,
    // which makes the row taller than the icon beside it.
    includeFontPadding: false,
    padding: 0,
  },
  submit: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.four,
    paddingTop: Spacing.two,
  },
  message: {
    textAlign: 'center',
  },
});
