import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';

/**
 * Where the emailed sign-in link lands.
 *
 * This screen does no auth work — `AuthProvider` redeems the code, because
 * the link can also arrive when nothing is mounted. The route exists because
 * the link is a URL like any other: expo-router resolves it against the
 * route tree, and without a file here the user's reward for signing in
 * successfully would be the not-found screen, while the session quietly
 * established itself behind it.
 *
 * So this is a waiting room. It shows progress, then gets out of the way.
 */
export default function AuthCallbackScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { session, callbackError } = useAuth();

  useEffect(() => {
    if (session) {
      // `replace`, not `push`: this screen is a step in a process, and
      // nobody should be able to navigate back into a spent callback.
      router.replace('/');
    }
  }, [session, router]);

  useEffect(() => {
    if (callbackError) router.replace('/sign-in');
  }, [callbackError, router]);

  return (
    <ThemedView style={styles.container}>
      <View style={styles.content}>
        <ActivityIndicator color={theme.primary} />
        <ThemedText themeColor="textSecondary">מתחברים…</ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // Transparent so the app-wide gradient behind every screen shows through.
    backgroundColor: 'transparent',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
});
