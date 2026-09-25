/**
 * Public reviews.
 *
 * Reads go through the same client as everything else but need no session —
 * `reviews` is readable by `anon` on purpose, so somebody deciding whether
 * to make an account can see what the app is worth first. Writes are
 * confined to their author by row-level security.
 */

import { supabase } from './supabase';

import type { PriceVerdict } from '@/constants/review-tags';

export type Review = {
  id: string;
  userId: string;
  showId: string;
  rating: number;
  body: string | null;
  tags: string[];
  wouldReturn: boolean | null;
  priceVerdict: PriceVerdict | null;
  /** As it read when the review was written; see `0005_reviews.sql`. */
  authorName: string | null;
  createdAt: string;
};

type ReviewRow = {
  id: string;
  user_id: string;
  show_id: string;
  rating: number;
  body: string | null;
  tags: string[] | null;
  would_return: boolean | null;
  price_verdict: PriceVerdict | null;
  author_name: string | null;
  created_at: string;
};

const COLUMNS =
  'id, user_id, show_id, rating, body, tags, would_return, price_verdict, author_name, created_at';

const toReview = (row: ReviewRow): Review => ({
  id: row.id,
  userId: row.user_id,
  showId: row.show_id,
  rating: row.rating,
  body: row.body,
  tags: row.tags ?? [],
  wouldReturn: row.would_return,
  priceVerdict: row.price_verdict,
  authorName: row.author_name,
  createdAt: row.created_at,
});

/** Every review of one show, newest first — the order the index is built for. */
export async function fetchReviews(showId: string): Promise<Review[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select(COLUMNS)
    .eq('show_id', showId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return ((data ?? []) as ReviewRow[]).map(toReview);
}

export type ReviewDraft = {
  rating: number;
  body?: string;
  tags: string[];
  wouldReturn?: boolean;
  priceVerdict?: PriceVerdict;
};

/**
 * Writes the signed-in user's review of a show.
 *
 * An upsert rather than an insert, because the table allows one review per
 * person per show: a second opinion is an edit of the first. Without that,
 * an average rating is stuffed by posting repeatedly.
 *
 * `authorName` is passed in and stored on the row rather than joined at read
 * time — see `0005_reviews.sql` for why that is worth a stale snapshot.
 */
export async function saveReview(
  userId: string,
  showId: string,
  authorName: string | null,
  draft: ReviewDraft,
): Promise<void> {
  const { error } = await supabase.from('reviews').upsert(
    {
      user_id: userId,
      show_id: showId,
      rating: draft.rating,
      // Empty text is stored as absent, not as an empty string: the database
      // rejects a blank body outright, and "no review text" is a real state
      // that a rating alone is allowed to be in.
      body: draft.body?.trim() ? draft.body.trim() : null,
      tags: draft.tags,
      would_return: draft.wouldReturn ?? null,
      price_verdict: draft.priceVerdict ?? null,
      author_name: authorName,
    },
    { onConflict: 'user_id,show_id' },
  );

  if (error) throw error;
}

export async function deleteReview(userId: string, showId: string): Promise<void> {
  // `user_id` is redundant under the delete policy but stated anyway: delete
  // is the one operation a mistake in cannot be undone, and RLS refuses a
  // foreign row by matching nothing rather than by failing — a silent no-op
  // is a poor last line of defence.
  const { error } = await supabase
    .from('reviews')
    .delete()
    .eq('user_id', userId)
    .eq('show_id', showId);

  if (error) throw error;
}

export async function reportReview(
  reviewId: string,
  reporterId: string,
  reason: string,
): Promise<void> {
  const { error } = await supabase
    .from('review_reports')
    .insert({ review_id: reviewId, reporter_id: reporterId, reason });

  // A second report from the same person hits the unique index. That is not
  // a failure worth showing: they already said it, and telling them it did
  // not work would only invite them to try again.
  if (error && error.code !== '23505') throw error;
}

export type ReviewSummary = {
  count: number;
  /** Null when nobody has reviewed it yet — distinct from an average of zero. */
  average: number | null;
  /** Share who would return, of those who answered. Null when nobody did. */
  wouldReturnShare: number | null;
};

/**
 * Reduces a show's reviews to the numbers worth putting beside its name.
 *
 * Computed here rather than asked of the server: a show has a handful of
 * reviews, they are already being fetched to display, and a second round
 * trip to average ten numbers is worse than doing it locally.
 *
 * `wouldReturn` is counted only over those who answered it. Treating an
 * unanswered question as a "no" would quietly punish every show whose
 * reviewers had no opinion on it.
 */
export function summarise(reviews: Review[]): ReviewSummary {
  if (reviews.length === 0) return { count: 0, average: null, wouldReturnShare: null };

  const answered = reviews.filter((r) => r.wouldReturn !== null);

  return {
    count: reviews.length,
    average: reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length,
    wouldReturnShare: answered.length
      ? answered.filter((r) => r.wouldReturn).length / answered.length
      : null,
  };
}
