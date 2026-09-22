import type { Session, User } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { supabase } from '@/data/supabase';

type AuthContextValue = {
  /** The live session, or null when signed out. */
  session: Session | null;
  /** Shorthand for `session?.user`, which is what callers actually want. */
  user: User | null;
  /**
   * False until the stored session has been read back from the keychain.
   *
   * Everything that depends on *who* the user is has to wait for this. Acting
   * on `user === null` before it turns true would treat a signed-in returning
   * user as a stranger for the first few frames — the watchlist would start
   * loading the wrong (empty) list.
   */
  ready: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Holds the signed-in session for the whole app.
 *
 * Mounted above `WatchlistProvider` in the root layout, because the watchlist
 * needs to know whose rows to load before it loads anything.
 *
 * Signing in and out is not here on purpose: this provider only *observes*.
 * `onAuthStateChange` fires for every route into a session — a magic link
 * opened from mail, an OAuth redirect, a token refreshed in the background,
 * a sign-out on another device — so making it the single source of truth
 * means no caller has to remember to update state after an auth call.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // The stored session, if there is one. Resolves quickly — it is a
    // keychain read, not a network call.
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      setReady(true);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      // Also set here: if the very first thing to happen is a sign-in, this
      // can land before `getSession` resolves.
      setReady(true);
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    // On React Native the client cannot refresh on a timer the way it does in
    // a browser — the platform suspends timers in the background. Supabase's
    // own guidance is to drive it from `AppState`: refresh while the app is
    // in front, stop when it isn't. Without this an access token quietly
    // expires while backgrounded and the next request fails as unauthorised.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    });

    // AppState only reports *changes*, so the foreground case at launch has
    // to be started by hand.
    supabase.auth.startAutoRefresh();

    return () => {
      subscription.remove();
      supabase.auth.stopAutoRefresh();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ session, user: session?.user ?? null, ready }),
    [session, ready],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider> (mounted in the root layout).');
  }
  return context;
}
