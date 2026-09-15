import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Tab 2 — Search (`app/(tabs)/search.tsx`).
 *
 * Stub screen: this is where free-text + filtered search across aggregated
 * shows will live (by title, venue, city, date range, source, etc.).
 */
export default function SearchScreen() {
  const theme = useTheme();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title" style={styles.title}>
          חיפוש
        </ThemedText>

        {/* Non-functional placeholder search field — just establishes the
            layout; wiring up real search is a separate piece of work. */}
        <ThemedView type="backgroundElement" style={styles.searchField}>
          <Ionicons name="search-outline" size={18} color={theme.textSecondary} />
          <ThemedText themeColor="textSecondary">חיפוש הצגות, אולמות או ערים…</ThemedText>
        </ThemedView>

        <ThemedView style={styles.emptyState}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.emptyStateText}>
            התחילו להקליד כדי לחפש בכל המקורות שאנחנו מרכזים.
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
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Spacing.five,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.five,
  },
  emptyStateText: {
    textAlign: 'center',
  },
});
