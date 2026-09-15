import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Tab 3 — Favorites (`app/(tabs)/favorites.tsx`).
 *
 * Stub screen: this is where shows the user has saved/starred across any
 * source will be listed, so they can jump back to a show's detail (and from
 * there, out to the official ticketing site) later.
 */
export default function FavoritesScreen() {
  const theme = useTheme();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title" style={styles.title}>
          מועדפים
        </ThemedText>

        <ThemedView style={styles.emptyState}>
          <Ionicons name="heart-outline" size={40} color={theme.textSecondary} />
          <ThemedText type="smallBold" style={styles.emptyStateTitle}>
            עדיין אין מועדפים
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.emptyStateText}>
            שמרו הצגה מהבית או מהחיפוש והיא תופיע כאן.
          </ThemedText>
        </ThemedView>
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
    gap: Spacing.four,
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.five,
  },
  emptyStateTitle: {
    marginTop: Spacing.two,
  },
  emptyStateText: {
    textAlign: 'center',
  },
});
