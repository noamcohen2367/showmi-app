import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileForm } from '@/components/profile-form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { saveOwnProfile } from '@/data/profile';
import { useAuth } from '@/hooks/use-auth';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';

/**
 * Editing what was collected at sign-up, plus the one thing that was not.
 *
 * The privacy switch appears here rather than during sign-up because it is
 * the only field whose consequences reach other people, and it should be
 * answered by somebody who has already seen what the app shows — not by
 * somebody still trying to get in.
 */
export default function EditProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { profile, ready, refresh } = useProfile();

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

        <ThemedText type="title" style={styles.title}>
          החשבון שלי
        </ThemedText>

        {/* The form's fields start from `initial`, which is read once when it
            mounts — so it must not mount before the profile has arrived, or
            it renders empty and the first save wipes what was there. */}
        {!ready ? (
          <View style={styles.centered}>
            <ActivityIndicator color={theme.primary} />
          </View>
        ) : (
          <ProfileForm
            submitLabel="שמירה"
            showPrivacy
            initial={{
              fullName: profile?.fullName ?? '',
              username: profile?.username ?? '',
              phone: profile?.phone ?? undefined,
              region: profile?.region ?? undefined,
              birthDate: profile?.birthDate ?? undefined,
              isPublic: profile?.isPublic ?? false,
            }}
            onSubmit={async (values) => {
              if (!user) return;
              await saveOwnProfile(user.id, values);
              await refresh();
              router.back();
            }}
          />
        )}
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
    gap: Spacing.three,
  },
  header: {
    // Leading edge under RTL, which is where a close control belongs.
    alignItems: 'flex-start',
    paddingTop: Spacing.two,
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
