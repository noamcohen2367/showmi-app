import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SeenCustomCard, SeenShowCard } from '@/components/seen-show-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { fetchPublicProfile, fetchPublicSeen, type PublicProfile, type PublicSeen } from '@/data/profile';
import { useHomeFeed } from '@/hooks/use-home-feed';
import { useTheme } from '@/hooks/use-theme';
import type { Show } from '@/types/show';

type State =
  | { phase: 'loading' }
  | { phase: 'ready'; profile: PublicProfile; seen: PublicSeen }
  /** Either there is no such username, or its owner has not opened their profile. */
  | { phase: 'missing' }
  | { phase: 'failed' };

/**
 * Somebody else's profile, and what they have watched.
 *
 * A closed profile and a username that was never taken are deliberately the
 * same answer here. "No such person" reveals less than "there is someone
 * here but you may not look" — the second confirms a name is taken and
 * invites guessing at who holds it.
 *
 * Only shows marked seen ever appear. "Want to see" is a plan — it says
 * where somebody intends to be on a given evening — and opening a profile
 * publishes where you have been, not where you are going.
 */
export default function PublicProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { username } = useLocalSearchParams<{ username: string }>();
  const result = useHomeFeed();

  const [state, setState] = useState<State>({ phase: 'loading' });

  useEffect(() => {
    if (!username) return;
    let cancelled = false;

    (async () => {
      setState({ phase: 'loading' });
      try {
        const profile = await fetchPublicProfile(username);
        if (cancelled) return;
        if (!profile) {
          setState({ phase: 'missing' });
          return;
        }
        const seen = await fetchPublicSeen(profile.id);
        if (cancelled) return;
        setState({ phase: 'ready', profile, seen });
      } catch {
        if (cancelled) return;
        setState({ phase: 'failed' });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [username]);

  // The shows themselves come from the same feed every other screen uses, so
  // there is no second source of show data to keep in sync. An id with no
  // matching show simply does not render.
  const byId = useMemo(() => {
    const all = result.status === 'ready' ? result.feed.all : [];
    return new Map(all.map((show) => [show.id, show]));
  }, [result]);

  const shows =
    state.phase === 'ready'
      ? state.seen.showIds.map((id) => byId.get(id)).filter((s): s is Show => !!s)
      : [];

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

        {state.phase === 'loading' ? (
          <View style={styles.centered}>
            <ActivityIndicator color={theme.primary} />
          </View>
        ) : state.phase === 'missing' ? (
          <Message
            title="הפרופיל לא נמצא"
            text="ייתכן ששם המשתמש שגוי, או שהפרופיל הזה סגור."
          />
        ) : state.phase === 'failed' ? (
          <Message title="לא הצלחנו לטעון" text="בדקו את החיבור ונסו שוב." />
        ) : (
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}>
            <View style={styles.identity}>
              <ThemedText type="title" style={styles.name}>
                {state.profile.fullName ?? `@${state.profile.username}`}
              </ThemedText>
              {state.profile.fullName ? (
                <ThemedText themeColor="textSecondary" style={styles.handle}>
                  @{state.profile.username}
                </ThemedText>
              ) : null}
            </View>

            <ThemedText type="smallBold">
              {shows.length + state.seen.custom.length > 0
                ? `ראה ${shows.length + state.seen.custom.length} הצגות`
                : 'עדיין לא סימן הצגות'}
            </ThemedText>

            <View style={styles.grid}>
              {/* No `onUnsee` and no remove: nothing on this screen belongs
                  to the person looking at it. The same cards, read-only. */}
              {shows.map((show) => (
                <View key={show.id} style={styles.cell}>
                  <SeenShowCard show={show} />
                </View>
              ))}

              {state.seen.custom.map((item) => (
                <View key={item.id} style={styles.cell}>
                  <SeenCustomCard item={item} />
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

function Message({ title, text }: { title: string; text: string }) {
  return (
    <View style={styles.centered}>
      <ThemedText type="smallBold" style={styles.centeredText}>
        {title}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.centeredText}>
        {text}
      </ThemedText>
    </View>
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
  },
  header: {
    // Leading edge under RTL, which is where a back control belongs.
    alignItems: 'flex-start',
    paddingTop: Spacing.two,
  },
  content: {
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  identity: {
    gap: Spacing.half,
  },
  name: {
    fontSize: 34,
    lineHeight: 40,
  },
  handle: {
    // Latin text, so it reads left-to-right even on a right-to-left screen.
    textAlign: 'left',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    // `space-between` plus 48% cards rather than a `columnGap`: two columns
    // and a gap overflow the row and wrap to one card per line.
    justifyContent: 'space-between',
    rowGap: Spacing.three,
  },
  cell: {
    width: '48%',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  centeredText: {
    textAlign: 'center',
  },
});
