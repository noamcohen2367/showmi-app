/**
 * The app's one Supabase client, used for anything that needs a signed-in
 * user.
 *
 * `src/data/shows.ts` deliberately does NOT go through this: reading the
 * public catalogue is one unauthenticated query, and a plain `fetch` needs no
 * client library. That stays as it is. This file exists because sessions,
 * token refresh and per-user rows are the part you should not hand-roll.
 *
 * The key here is the same publishable one `shows.ts` already uses. It is
 * meant to be in the app — it grants nothing on its own, and everything a
 * signed-in user can reach is decided by RLS on the server. The service-role
 * key is not here and never will be; it lives only in `scraper/.env` and in
 * GitHub Secrets.
 */

import { createClient } from '@supabase/supabase-js';

import { sessionStore } from './session-store';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  // Thrown at import time on purpose. A missing key is a build-configuration
  // mistake, not a runtime condition to handle — and Expo inlines these at
  // bundle time, so editing `.env.local` needs `npx expo start --clear`.
  throw new Error(
    'EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set in .env.local',
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    // The device keychain, chunked — see `session-store.ts` for why both
    // of those words are load-bearing.
    storage: sessionStore,
    persistSession: true,
    autoRefreshToken: true,
    // Off: the app is not a browser. Nothing puts tokens in a URL fragment,
    // and leaving it on makes the client inspect `window.location` at
    // startup, which does not exist on native. The deep-link callback is
    // handled explicitly instead — see `AuthProvider`.
    detectSessionInUrl: false,
    // PKCE rather than the implicit default. Implicit sends the access and
    // refresh tokens themselves back in the redirect URL, and a URL is not a
    // private channel on a phone: it passes through the OS link handler and,
    // if a browser is involved, its history. PKCE sends a single-use code
    // that is worthless without the verifier this client keeps on the
    // device, so an intercepted callback URL yields nothing.
    flowType: 'pkce',
  },
});
