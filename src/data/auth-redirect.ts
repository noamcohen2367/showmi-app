/**
 * The address a sign-in email sends the user back to, and how to read what
 * it carries.
 *
 * One module rather than a constant in each place, because the URL requested
 * when the mail is sent and the URL matched when the user returns have to be
 * the same string — Supabase rejects a redirect that is not on the project's
 * allow-list, and the failure shows up as a dead link in the user's inbox
 * long after the mistake was made.
 */

import * as Linking from 'expo-linking';

/**
 * Built at call time, not at module load. `createURL` resolves differently
 * depending on how the app is running — the `showmi://` scheme in a
 * build, an `exp://.../--/` tunnel in Expo Go, an http origin on web — and
 * capturing it at import time would freeze whichever one happened to be
 * first.
 *
 * The Supabase project must allow this pattern under
 * Authentication > URL Configuration > Redirect URLs.
 */
export function authRedirectUrl(): string {
  return Linking.createURL('/auth/callback');
}

export type AuthCallback =
  /** A PKCE code to trade for a session. */
  | { kind: 'code'; code: string }
  /** Supabase declined — an expired link, or one already used. */
  | { kind: 'error'; code: string; description: string };

/**
 * Reads an incoming deep link, or returns null if it is not a sign-in
 * callback at all — most links that reach the app are not.
 *
 * Both halves of the URL are inspected. PKCE puts `code` in the query
 * string, but Supabase reports failures in whichever half the flow that
 * produced them uses, and an expired link is exactly the case that must not
 * be silently dropped.
 */
export function parseAuthCallback(url: string): AuthCallback | null {
  const { queryParams } = Linking.parse(url);
  const fragment = url.includes('#') ? new URLSearchParams(url.slice(url.indexOf('#') + 1)) : null;

  const read = (key: string): string | null => {
    const fromQuery = queryParams?.[key];
    if (typeof fromQuery === 'string' && fromQuery) return fromQuery;
    return fragment?.get(key) || null;
  };

  const error = read('error') ?? read('error_code');
  if (error) {
    return {
      kind: 'error',
      code: read('error_code') ?? error,
      // Diagnostic only — what the user is shown comes from
      // `authErrorMessage`, since Supabase's own wording is English and
      // aimed at a developer. Left undecoded deliberately: the two halves of
      // the URL are unescaped by different parsers, and normalising them
      // here would mangle a legitimate '+' for no visible gain.
      description: read('error_description') ?? '',
    };
  }

  const code = read('code');
  return code ? { kind: 'code', code } : null;
}

/** Hebrew for the failures a user can actually do something about. */
export function authErrorMessage(code: string): string {
  switch (code) {
    case 'otp_expired':
      return 'הקישור פג תוקף. נשלח לך קישור חדש.';
    case 'access_denied':
      return 'הקישור כבר שימש להתחברות. נשלח לך קישור חדש.';
    default:
      return 'ההתחברות לא הושלמה. אפשר לנסות שוב.';
  }
}
