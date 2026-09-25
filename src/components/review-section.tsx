import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';

import { ReviewSheet } from './review-sheet';
import { StarRating } from './star-rating';
import { ThemedText } from './themed-text';

import { priceVerdictLabel } from '@/constants/review-tags';
import { Spacing } from '@/constants/theme';
import { fetchReviews, reportReview, summarise, type Review } from '@/data/reviews';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';

/**
 * The reviews and how they got here, as one value — "loading", "failed" and
 * the list itself have to agree, and separate flags are how they stop doing
 * so.
 */
type Loaded =
  | { phase: 'loading' }
  | { phase: 'ready'; reviews: Review[] }
  | { phase: 'failed' };

/**
 * Everything anybody has said about one show.
 *
 * Loads its own data rather than taking it from the show screen: reviews
 * change on a different rhythm from the catalogue, they are wanted on
 * exactly one screen, and folding them into the feed cache would make every
 * screen that reads a show pay for them.
 */
export function ReviewSection({ showId, showName }: { showId: string; showName: string }) {
  const theme = useTheme();
  const router = useRouter();
  const { user } = useAuth();

  const [state, setState] = useState<Loaded>({ phase: 'loading' });
  const [sheetOpen, setSheetOpen] = useState(false);

  /**
   * Bumped to ask for a refetch.
   *
   * The effect owns the loading, and everything else asks for it by changing
   * a number. Handing a `load()` function around instead means an effect
   * whose body calls setState, which is both the lint rule here and a real
   * source of cascading renders.
   */
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setState({ phase: 'loading' });
      try {
        const fetched = await fetchReviews(showId);
        if (!cancelled) setState({ phase: 'ready', reviews: fetched });
      } catch {
        if (!cancelled) setState({ phase: 'failed' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showId, reloads]);

  const reviews = state.phase === 'ready' ? state.reviews : [];
  const mine = reviews.find((r) => r.userId === user?.id) ?? null;
  const others = reviews.filter((r) => r.userId !== user?.id);
  const summary = summarise(reviews);

  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <ThemedText type="subtitle" style={styles.title}>
          ביקורות
        </ThemedText>

        {summary.average !== null ? (
          <View style={styles.summary}>
            <StarRating value={Math.round(summary.average)} size={16} />
            <ThemedText type="small">
              {summary.average.toFixed(1)} · {summary.count}
            </ThemedText>
          </View>
        ) : null}
      </View>

      {/* Only shown once somebody has answered it. "0% would return" from a
          single unanswered review would be a number that means nothing and
          looks like a verdict. */}
      {summary.wouldReturnShare !== null ? (
        <ThemedText type="small" themeColor="textSecondary">
          {Math.round(summary.wouldReturnShare * 100)}% היו חוזרים לראות
        </ThemedText>
      ) : null}

      {user ? (
        <Pressable
          onPress={() => setSheetOpen(true)}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.write,
            { borderColor: theme.primary },
            pressed && styles.pressed,
          ]}>
          <Ionicons name={mine ? 'create-outline' : 'add'} size={18} color={theme.primary} />
          <ThemedText type="smallBold" themeColor="primary">
            {mine ? 'עריכת הביקורת שלי' : 'כתיבת ביקורת'}
          </ThemedText>
        </Pressable>
      ) : (
        <Pressable
          onPress={() => router.push('/sign-in')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.signIn, pressed && styles.pressed]}>
          <ThemedText type="small" themeColor="primary">
            התחברו כדי לכתוב ביקורת
          </ThemedText>
        </Pressable>
      )}

      {state.phase === 'loading' ? (
        <ActivityIndicator color={theme.primary} />
      ) : state.phase === 'failed' ? (
        <ThemedText type="small" themeColor="textSecondary">
          לא הצלחנו לטעון את הביקורות.
        </ThemedText>
      ) : reviews.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          עוד אין ביקורות על ההצגה הזו. תהיו הראשונים.
        </ThemedText>
      ) : (
        <View style={styles.list}>
          {/* The user's own first, always. It is the one they came to check. */}
          {mine ? <ReviewCard review={mine} isMine /> : null}
          {others.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </View>
      )}

      <ReviewSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        showId={showId}
        showName={showName}
        existing={mine}
        onSaved={() => setReloads((n) => n + 1)}
      />
    </View>
  );
}

function ReviewCard({ review, isMine = false }: { review: Review; isMine?: boolean }) {
  const theme = useTheme();
  const { user } = useAuth();
  const [reported, setReported] = useState(false);

  function report() {
    if (!user) return;
    Alert.alert('לדווח על הביקורת?', 'נבדוק אותה בהקדם.', [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'דיווח',
        style: 'destructive',
        onPress: async () => {
          try {
            await reportReview(review.id, user.id, 'reported_from_show_page');
            // Acknowledged locally rather than by refetching: reports are
            // write-only, so there is nothing to read back that would
            // confirm it.
            setReported(true);
          } catch {
            Alert.alert('הדיווח לא נשלח', 'בדקו את החיבור ונסו שוב.');
          }
        },
      },
    ]);
  }

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
      <View style={styles.cardHead}>
        <View style={styles.author}>
          <ThemedText type="smallBold" numberOfLines={1}>
            {isMine ? 'הביקורת שלי' : (review.authorName ?? 'משתמש showmi')}
          </ThemedText>
          <StarRating value={review.rating} size={14} />
        </View>

        {/* Reporting is required of an app carrying user-generated content,
            and it is pointless on your own review. */}
        {!isMine && user ? (
          <Pressable
            onPress={report}
            disabled={reported}
            accessibilityRole="button"
            accessibilityLabel="דיווח על הביקורת"
            hitSlop={Spacing.two}
            style={({ pressed }) => pressed && styles.pressed}>
            <Ionicons
              name={reported ? 'flag' : 'flag-outline'}
              size={16}
              color={theme.textSecondary}
            />
          </Pressable>
        ) : null}
      </View>

      {review.body ? <ThemedText type="small">{review.body}</ThemedText> : null}

      {review.tags.length > 0 || review.priceVerdict || review.wouldReturn !== null ? (
        <View style={styles.chips}>
          {review.tags.map((tag) => (
            <Chip key={tag} label={tag} />
          ))}
          {review.priceVerdict ? <Chip label={priceVerdictLabel(review.priceVerdict) ?? ''} /> : null}
          {review.wouldReturn !== null ? (
            <Chip label={review.wouldReturn ? 'היה חוזר' : 'לא היה חוזר'} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function Chip({ label }: { label: string }) {
  const theme = useTheme();
  if (!label) return null;
  return (
    <View style={[styles.chip, { backgroundColor: theme.backgroundSelected }]}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.three,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  title: {
    fontSize: 20,
    lineHeight: 26,
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  write: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Spacing.five,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  signIn: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.two,
  },
  list: {
    gap: Spacing.three,
  },
  card: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  author: {
    flex: 1,
    gap: Spacing.half,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  chip: {
    borderRadius: Spacing.five,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  pressed: {
    opacity: 0.6,
  },
});
