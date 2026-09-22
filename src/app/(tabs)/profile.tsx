import Ionicons from '@expo/vector-icons/Ionicons';
import SimpleLineIcons from '@expo/vector-icons/SimpleLineIcons';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState, type ReactNode } from 'react';
import { Alert, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExternalLink } from '@/components/external-link';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { supabase } from '@/data/supabase';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';

type ProfileRow = {
  // A render prop (rather than a plain glyph name) so a row can pull its
  // icon from a different vector-icon family than the rest — e.g. "Account"
  // below uses SimpleLineIcons for its mustache glyph, since Ionicons (used
  // everywhere else in the nav/UI) has no mustache icon.
  renderIcon: (color: string) => ReactNode;
  label: string;
  /** Trailing text, e.g. the signed-in address on the account row. */
  detail?: string;
  onPress?: () => void;
};

// Plain account/app-settings rows. No purchase, payment, or order-history
// items here — this app never sells tickets, so there's nothing to manage.
const SETTINGS_ROWS: ProfileRow[] = [
  { renderIcon: (color) => <Ionicons name="notifications-outline" size={20} color={color} />, label: 'התראות' },
  { renderIcon: (color) => <Ionicons name="color-palette-outline" size={20} color={color} />, label: 'מראה' },
  {
    renderIcon: (color) => <Ionicons name="globe-outline" size={20} color={color} />,
    label: 'המקורות שאנחנו מרכזים',
  },
];

/**
 * Tab 4 — Profile/Settings (`app/(tabs)/profile.tsx`).
 *
 * Stub screen: account + app preferences. Deliberately has no billing,
 * payment method, or order-history rows — ticket purchases always happen on
 * the official ticketing site, never in this app.
 */
export default function ProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, ready } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    // No local state to clear afterwards: `onAuthStateChange` in
    // `AuthProvider` is what everything reads, and it fires on its own.
    const { error } = await supabase.auth.signOut();
    setSigningOut(false);
    if (error) Alert.alert('לא הצלחנו להתנתק', 'בדוק את החיבור ונסה שוב.');
  }

  const accountRow: ProfileRow = {
    renderIcon: (color) => <SimpleLineIcons name="mustache" size={20} color={color} />,
    label: 'חשבון',
    // `ready` is false only for the moment it takes to read the keychain.
    // Showing "not signed in" during it would tell a returning user the
    // wrong thing, so the row stays blank until the answer is known.
    detail: ready ? (user?.email ?? 'התחברות') : undefined,
    onPress: user ? undefined : () => router.push('/sign-in'),
  };

  const rows = [accountRow, ...SETTINGS_ROWS];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title" style={styles.title}>
          פרופיל
        </ThemedText>

        <ThemedView style={styles.rowsGroup}>
          {rows.map((row, index) => (
            <Pressable
              key={row.label}
              onPress={row.onPress}
              style={({ pressed }) => pressed && row.onPress != null && styles.pressed}
              accessibilityRole="button"
            >
              <ThemedView
                type="backgroundElement"
                style={[
                  styles.row,
                  index === 0 && styles.rowFirst,
                  index === rows.length - 1 && styles.rowLast,
                ]}
              >
                {row.renderIcon(theme.textSecondary)}
                <ThemedText style={styles.rowLabel}>{row.label}</ThemedText>
                {row.detail ? (
                  <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                    {row.detail}
                  </ThemedText>
                ) : null}
                {/* RTL: "forward" (deeper into the row) points left, not right. */}
                <Ionicons
                  name="chevron-back"
                  size={18}
                  color={theme.textSecondary}
                />
              </ThemedView>
            </Pressable>
          ))}
        </ThemedView>

        {user ? (
          <Pressable
            onPress={() => void signOut()}
            disabled={signingOut}
            accessibilityRole="button"
            style={({ pressed }) => pressed && styles.pressed}>
            <ThemedText type="smallBold" themeColor="primary">
              {signingOut ? 'מתנתק…' : 'התנתקות'}
            </ThemedText>
          </Pressable>
        ) : null}

        <ExternalLink href="https://docs.expo.dev" asChild>
          <Pressable style={({ pressed }) => pressed && styles.pressed}>
            <ThemedView type="backgroundElement" style={styles.linkButton}>
              <ThemedText type="link">עזרה ומשוב</ThemedText>
              <SymbolView
                tintColor={theme.text}
                name={{
                  ios: 'arrow.up.right.square',
                  android: 'link',
                  web: 'link',
                }}
                size={12}
              />
            </ThemedView>
          </Pressable>
        </ExternalLink>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // Transparent so the app-wide <AnimatedGradientBackground/> (mounted in
    // the root layout, behind every screen) shows through.
    backgroundColor: 'transparent',
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: BottomTabInset + Spacing.three,
    gap: Spacing.five,
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
  },
  rowsGroup: {
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  rowFirst: {
    borderTopLeftRadius: Spacing.three,
    borderTopRightRadius: Spacing.three,
  },
  rowLast: {
    borderBottomLeftRadius: Spacing.three,
    borderBottomRightRadius: Spacing.three,
  },
  rowLabel: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
  linkButton: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
    justifyContent: 'center',
    gap: Spacing.one,
    alignItems: 'center',
  },
});
