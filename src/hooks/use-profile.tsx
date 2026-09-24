import { usePathname, useRouter } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { fetchOwnProfile, type Profile } from '@/data/profile';
import { useAuth } from '@/hooks/use-auth';

type ProfileContextValue = {
  /** Null while signed out, or while the row has not been read yet. */
  profile: Profile | null;
  /** False until the first read settles, either way. */
  ready: boolean;
  /** Re-reads the row — call after saving changes to it. */
  refresh: () => Promise<void>;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

/** The screen that collects what a new account is missing. */
const ONBOARDING_ROUTE = '/complete-profile';

/**
 * Holds the signed-in user's own profile row, and sends them to fill it in
 * when it is not usable yet.
 *
 * Signing in with an emailed link produces an account that knows an address
 * and nothing else — there is no sign-up form on which to have asked for a
 * name. So the gate lives here: a session with no username is sent to the
 * onboarding screen, from wherever they were.
 *
 * It is keyed on the username rather than on "have we seen this user
 * before", because it also has to catch accounts created before any of this
 * existed. Those have a profile row and no name in it.
 */
export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user, ready: authReady } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);

  // `user.id`, not `user`: a fresh user object arrives on every token
  // refresh, and depending on it would refetch the profile roughly hourly.
  const userId = user?.id ?? null;

  const load = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setReady(true);
      return;
    }
    try {
      setProfile(await fetchOwnProfile());
    } catch {
      // A failed read must not strand anyone on the onboarding screen, so it
      // resolves as "nothing known" and the gate below stays shut.
      setProfile(null);
    } finally {
      setReady(true);
    }
  }, [userId]);

  useEffect(() => {
    if (!authReady) return;
    let cancelled = false;
    (async () => {
      setReady(false);
      await load();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [authReady, load]);

  useEffect(() => {
    // Every condition here is a reason not to redirect, and the last one is
    // what stops the screen from sending itself back to itself.
    if (!authReady || !ready || !userId) return;
    if (profile?.username) return;
    if (pathname === ONBOARDING_ROUTE) return;

    router.replace(ONBOARDING_ROUTE);
  }, [authReady, ready, userId, profile?.username, pathname, router]);

  const value = useMemo<ProfileContextValue>(
    () => ({ profile, ready, refresh: load }),
    [profile, ready, load],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileContextValue {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used inside <ProfileProvider> (mounted in the root layout).');
  }
  return context;
}
