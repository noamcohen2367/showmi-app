import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileForm } from '@/components/profile-form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { saveOwnProfile } from '@/data/profile';
import { useAuth } from '@/hooks/use-auth';
import { useProfile } from '@/hooks/use-profile';

/**
 * Collects who somebody is, once, straight after their first sign-in.
 *
 * There is no sign-up form to hang this on — signing in with an emailed link
 * produces an account that knows an address and nothing else. So it happens
 * here instead, and it blocks: an account with no username cannot be
 * attributed, and a public review with no author is worse than no review.
 *
 * No privacy switch here, on purpose. Everything starts closed, and asking
 * somebody to decide about visibility before they have seen what the app
 * even shows is asking them to guess. The switch lives in the profile, where
 * it can be answered with context.
 */
export default function CompleteProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { refresh } = useProfile();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ThemedText type="title" style={styles.title}>
          נעים להכיר
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.intro}>
          עוד כמה פרטים ואפשר להתחיל. רק השם ושם המשתמש נדרשים.
        </ThemedText>

        <ProfileForm
          submitLabel="סיימנו"
          onSubmit={async (values) => {
            if (!user) return;
            await saveOwnProfile(user.id, values);
            // Re-read before leaving, and await it. The gate that sent the
            // user here watches the profile held in memory, not the
            // database — without this it still sees no username and bounces
            // them straight back to this screen.
            await refresh();
            router.replace('/');
          }}
        />

        <ThemedText type="small" themeColor="textSecondary" style={styles.footnote}>
          הפרופיל שלך סגור כברירת מחדל. אפשר לפתוח אותו מההגדרות.
        </ThemedText>
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
    paddingTop: Spacing.four,
    gap: Spacing.three,
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
  },
  intro: {
    paddingBottom: Spacing.one,
  },
  footnote: {
    textAlign: 'center',
    paddingBottom: Spacing.three,
  },
});
