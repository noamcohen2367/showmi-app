/**
 * The signed-in user's own profile row.
 *
 * Separate from `shows.ts`, which reads the public catalogue with a bare
 * `apikey` and needs no session — everything here is scoped to `auth.uid()`
 * by row-level security and goes through the authenticated client.
 */

import { supabase } from './supabase';
import type { SeenOn } from './watchlist-backend';

export type Profile = {
  id: string;
  fullName: string | null;
  username: string | null;
  phone: string | null;
  region: string | null;
  /** ISO `YYYY-MM-DD`. */
  birthDate: string | null;
  isPublic: boolean;
};

/** The columns the app reads. Never `*`: the row also holds `role`, `level`
 *  and `total_purchases`, which are the system's to write and nothing here
 *  should imply otherwise by fetching them. */
const COLUMNS = 'id, full_name, username, phone, preferred_location, birth_date, is_public';

type ProfileRow = {
  id: string;
  full_name: string | null;
  username: string | null;
  phone: string | null;
  preferred_location: string | null;
  birth_date: string | null;
  is_public: boolean;
};

const toProfile = (row: ProfileRow): Profile => ({
  id: row.id,
  fullName: row.full_name,
  username: row.username,
  phone: row.phone,
  region: row.preferred_location,
  birthDate: row.birth_date,
  isPublic: row.is_public,
});

export async function fetchOwnProfile(): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select(COLUMNS).maybeSingle();
  if (error) throw error;
  return data ? toProfile(data as ProfileRow) : null;
}

export type ProfileEdits = {
  fullName: string;
  username: string;
  phone?: string;
  region?: string;
  birthDate?: string;
  /**
   * Whether strangers may see this profile and the shows on it.
   *
   * Optional here because the sign-up screen does not ask — everything
   * starts closed, and leaving it out means "don't change it" rather than
   * "close it", so saving a name can never quietly un-share a profile.
   */
  isPublic?: boolean;
};

export async function saveOwnProfile(userId: string, edits: ProfileEdits): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: edits.fullName,
      // Lowercased here as well as validated in the form, because this is the
      // last point before the database — where a mixed-case name would be
      // rejected by the format constraint rather than silently stored.
      username: edits.username.toLowerCase(),
      phone: edits.phone ?? null,
      preferred_location: edits.region ?? null,
      birth_date: edits.birthDate ?? null,
      // Spread rather than defaulted: an absent `isPublic` must leave the
      // column alone. Writing `false` for it would mean that saving a name
      // change from a screen that has no privacy switch silently closes a
      // profile the user had opened.
      ...(edits.isPublic === undefined ? {} : { is_public: edits.isPublic }),
    })
    .eq('id', userId);

  if (error) throw error;
}

/**
 * Whether a username is free.
 *
 * Asked against `public_profiles`, not `profiles`: the real table is readable
 * only to its owner, so a check there would report every taken name as
 * available. The view is public by design.
 *
 * That view only lists profiles whose owner made them public, so this cannot
 * see a name held by somebody with a closed profile. The unique index is what
 * actually decides — this only spares the user from discovering a clash after
 * filling in the rest of the form. `saveOwnProfile` still has to handle the
 * duplicate-key error.
 */
export async function isUsernameAvailable(username: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('public_profiles')
    .select('id')
    .eq('username', username.toLowerCase())
    .maybeSingle();

  if (error) throw error;
  return data === null;
}

/** Postgres's unique-violation code, which is how a taken username really arrives. */
export const UNIQUE_VIOLATION = '23505';

/* ─────────────────────────────────────────────────────────────────────────
 * Somebody else's profile
 * ───────────────────────────────────────────────────────────────────────── */

export type PublicProfile = {
  id: string;
  username: string;
  fullName: string | null;
};

/**
 * Looks up a profile by username.
 *
 * Reads `public_profiles`, which is a view over three columns and nothing
 * else — there is no email or phone number in it to leak, by construction
 * rather than by policy. It also only lists profiles whose owner opened
 * them, so a closed profile is indistinguishable from one that does not
 * exist. That is the intended answer: "no such person" reveals less than
 * "there is someone here but you may not look".
 */
export async function fetchPublicProfile(username: string): Promise<PublicProfile | null> {
  const { data, error } = await supabase
    .from('public_profiles')
    .select('id, username, full_name')
    .eq('username', username.toLowerCase())
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as { id: string; username: string; full_name: string | null };
  return { id: row.id, username: row.username, fullName: row.full_name };
}

/**
 * Finds people by username or name.
 *
 * Searches `public_profiles`, so somebody who has not opened their profile
 * is simply not findable — which is the whole meaning of the switch.
 *
 * Capped, and not paginated. A result list long enough to need paging is a
 * list nobody is reading; somebody looking for a person either sees them in
 * the first handful or types more.
 */
export async function searchProfiles(query: string, limit = 20): Promise<PublicProfile[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  // `%` and `_` are wildcards to `ilike`, so a user typing either would
  // otherwise be running a pattern rather than a search.
  const escaped = trimmed.replace(/[%_]/g, (char) => `\\${char}`);

  const { data, error } = await supabase
    .from('public_profiles')
    .select('id, username, full_name')
    .or(`username.ilike.%${escaped}%,full_name.ilike.%${escaped}%`)
    .limit(limit);

  if (error) throw error;

  return ((data ?? []) as { id: string; username: string; full_name: string | null }[]).map(
    (row) => ({ id: row.id, username: row.username, fullName: row.full_name }),
  );
}

/**
 * Usernames for a set of user ids, for linking review authors to profiles.
 *
 * A review stores its author's *display name*, which is not addressable —
 * and deliberately so, since it has to survive whether or not that person's
 * profile is open. This resolves the ids that do have an open profile; the
 * rest simply render as unlinked text, which is the correct outcome rather
 * than a missing one.
 */
export async function fetchUsernamesFor(userIds: string[]): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from('public_profiles')
    .select('id, username')
    .in('id', userIds);

  if (error) throw error;

  return new Map(
    ((data ?? []) as { id: string; username: string }[]).map((row) => [row.id, row.username]),
  );
}

export type PublicSeen = {
  /** Catalogue show ids, to be resolved against the feed every screen uses. */
  showIds: string[];
  custom: { id: string; name: string; location?: string; seenOn?: SeenOn }[];
};

/**
 * What one person has seen.
 *
 * Asks only for `status = 'seen'` even though the policy already restricts
 * it to that. Stating it makes the query say what it means rather than
 * relying on the reader knowing the policy — and if the policy is ever
 * widened, this does not silently start returning someone's plans.
 */
export async function fetchPublicSeen(userId: string): Promise<PublicSeen> {
  const { data, error } = await supabase
    .from('watchlist')
    .select('entry_id, show_id, custom_name, custom_location, seen_on, seen_on_precision')
    .eq('user_id', userId)
    .eq('status', 'seen');

  if (error) throw error;

  const rows = (data ?? []) as {
    entry_id: string;
    show_id: string | null;
    custom_name: string | null;
    custom_location: string | null;
    seen_on: string | null;
    seen_on_precision: 'year' | 'day' | null;
  }[];

  return {
    showIds: rows.filter((r) => r.show_id).map((r) => r.show_id as string),
    custom: rows
      .filter((r) => r.custom_name)
      .map((r) => ({
        id: r.entry_id,
        name: r.custom_name as string,
        ...(r.custom_location ? { location: r.custom_location } : {}),
        ...(r.seen_on && r.seen_on_precision
          ? { seenOn: { date: r.seen_on, precision: r.seen_on_precision } }
          : {}),
      })),
  };
}
