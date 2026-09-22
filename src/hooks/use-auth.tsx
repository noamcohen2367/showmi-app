import type { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { authErrorMessage, parseAuthCallback } from '@/data/auth-redirect';
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
  /**
   * Hebrew text for a sign-in link that did not work — expired, or already
   * used. Held here rather than on the sign-in screen because the link can
   * arrive while that screen is not mounted, including on a cold start.
   */
  callbackError: string | null;
  /** Called when the user acts on the error, e.g. asks for a fresh link. */
  clearCallbackError: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Holds the signed-in session for the whole app.
 *
 * Mounted above `WatchlistProvider` in the root layout, because the watchlist
 * needs to know whose rows to load before it loads anything.
 *
 * Requesting a sign-in link, and signing out, are not here on purpose:
 * `onAuthStateChange` fires for every route into a session — a link opened
 * from mail, a token refreshed in the background, a sign-out on another
 * device — so making it the single source of truth means no caller has to
 * remember to update state after an auth call.
 *
 * The one auth *action* that does live here is redeeming the deep-link
 * callback, because it has no screen of its own: the link can arrive while
 * the sign-in screen is long gone, or launch the app from cold.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [callbackError, setCallbackError] = useState<string | null>(null);

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

  useEffect(() => {
    let cancelled = false;

    /**
     * Trade the one-time code from the email link for a session.
     *
     * No `setSession` call is needed on success: `exchangeCodeForSession`
     * drives `onAuthStateChange`, which the effect above is already
     * listening to. Doing both would set the same state twice.
     */
    async function redeem(url: string) {
      const callback = parseAuthCallback(url);
      if (!callback) return;

      if (callback.kind === 'error') {
        if (!cancelled) setCallbackError(authErrorMessage(callback.code));
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession(callback.code);
      if (cancelled) return;
      // The commonest real failure is a link opened on a different device
      // from the one that asked for it: the PKCE verifier lives on the
      // device that sent the request, so there is nothing here to redeem
      // the code against.
      setCallbackError(error ? 'הקישור נפתח במכשיר אחר מזה שביקש אותו. בקש קישור חדש מהמכשיר הזה.' : null);
    }

    // A link that launched the app from cold is waiting here rather than
    // arriving as an event, so both paths have to be covered.
    Linking.getInitialURL().then((url) => {
      if (url && !cancelled) void redeem(url);
    });

    const subscription = Linking.addEventListener('url', ({ url }) => void redeem(url));

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  const clearCallbackError = useCallback(() => setCallbackError(null), []);

  const value = useMemo<AuthContextValue>(
    () => ({ session, user: session?.user ?? null, ready, callbackError, clearCallbackError }),
    [session, ready, callbackError, clearCallbackError],
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
