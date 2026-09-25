import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { searchProfiles, type PublicProfile } from '@/data/profile';
import { useTheme } from '@/hooks/use-theme';

/** Below this the query matches most of the database and means nothing. */
const MIN_QUERY = 2;

/**
 * How long to wait after the last keystroke before asking the server.
 *
 * Long enough that typing a name is one request rather than eight, short
 * enough that it still feels like it is keeping up.
 */
const DEBOUNCE_MS = 300;

type State =
  | { phase: 'searching' }
  | { phase: 'ready'; results: PublicProfile[] }
  | { phase: 'failed' };

/**
 * Finding other people.
 *
 * Only profiles their owners have opened are searchable, which means an empty
 * result is ambiguous by design — the person may not exist, or may simply not
 * have opened their profile. The copy says so rather than asserting the
 * first, because asserting it would be a way to test whether a username is
 * taken.
 */
export default function PeopleScreen() {
  const theme = useTheme();
  const router = useRouter();

  const [query, setQuery] = useState('');
  const [state, setState] = useState<State>({ phase: 'ready', results: [] });

  // Derived, not stored. "The query is too short" is a fact about the input
  // the render already has — keeping it in state would mean setting it
  // synchronously inside the effect, which is both the lint rule here and an
  // extra render for something already known.
  const tooShort = query.trim().length < MIN_QUERY;

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY) return;

    let cancelled = false;
    // Debounced rather than fired per keystroke: without this, typing a
    // six-letter name is six round trips whose answers can arrive out of
    // order, and the list ends up showing the results for a prefix.
    const timer = setTimeout(async () => {
      setState({ phase: 'searching' });
      try {
        const results = await searchProfiles(trimmed);
        if (!cancelled) setState({ phase: 'ready', results });
      } catch {
        if (!cancelled) setState({ phase: 'failed' });
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="חזרה"
            hitSlop={Spacing.three}>
            {/* RTL: "back" points the way the text flows, which is right. */}
            <Ionicons name="chevron-forward" size={26} color={theme.text} />
          </Pressable>
        </View>

        <ThemedText type="title" style={styles.title}>
          אנשים
        </ThemedText>

        <View style={[styles.field, { borderColor: theme.backgroundSelected }]}>
          <Ionicons name="search-outline" size={20} color={theme.textSecondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="שם או שם משתמש"
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { color: theme.text }]}
            accessibilityLabel="חיפוש אנשים"
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            returnKeyType="search"
          />
          {query ? (
            <Pressable
              onPress={() => setQuery('')}
              accessibilityRole="button"
              accessibilityLabel="ניקוי החיפוש"
              hitSlop={Spacing.two}>
              <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          contentContainerStyle={styles.results}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}>
          {tooShort ? (
            <ThemedText type="small" themeColor="textSecondary">
              אפשר למצוא רק אנשים שפתחו את הפרופיל שלהם.
            </ThemedText>
          ) : state.phase === 'searching' ? (
            <ActivityIndicator color={theme.primary} />
          ) : state.phase === 'failed' ? (
            <ThemedText type="small" themeColor="textSecondary">
              לא הצלחנו לחפש. בדקו את החיבור ונסו שוב.
            </ThemedText>
          ) : state.results.length === 0 ? (
            // Deliberately does not say "no such user". A closed profile is
            // unfindable too, and claiming the name is free would turn this
            // into a way to probe which usernames exist.
            <ThemedText type="small" themeColor="textSecondary">
              לא נמצאו תוצאות. ייתכן שהפרופיל סגור.
            </ThemedText>
          ) : (
            state.results.map((person) => (
              <Pressable
                key={person.id}
                onPress={() => router.push(`/u/${person.username}`)}
                accessibilityRole="button"
                accessibilityLabel={person.fullName ?? person.username}
                style={({ pressed }) => [
                  styles.row,
                  { backgroundColor: theme.backgroundElement },
                  pressed && styles.pressed,
                ]}>
                <View style={[styles.avatar, { backgroundColor: theme.primarySoft }]}>
                  <ThemedText type="smallBold" themeColor="primary">
                    {(person.fullName ?? person.username).slice(0, 1).toUpperCase()}
                  </ThemedText>
                </View>

                <View style={styles.rowText}>
                  <ThemedText type="smallBold" numberOfLines={1}>
                    {person.fullName ?? person.username}
                  </ThemedText>
                  <ThemedText
                    type="small"
                    themeColor="textSecondary"
                    numberOfLines={1}
                    style={styles.handle}>
                    @{person.username}
                  </ThemedText>
                </View>

                {/* RTL: "forward" points left. */}
                <Ionicons name="chevron-back" size={18} color={theme.textSecondary} />
              </Pressable>
            ))
          )}
        </ScrollView>
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
    // Leading edge under RTL, which is where a back control belongs.
    alignItems: 'flex-start',
    paddingTop: Spacing.two,
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
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Spacing.three,
    includeFontPadding: false,
  },
  results: {
    gap: Spacing.two,
    paddingBottom: Spacing.six,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
    gap: Spacing.half,
  },
  handle: {
    // Latin text, so it reads left-to-right even on a right-to-left screen.
    textAlign: 'left',
  },
  pressed: {
    opacity: 0.7,
  },
});
