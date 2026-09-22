/**
 * Where the signed-in session is kept between app launches.
 *
 * This is what `supabase-js` writes its session into, so it holds a refresh
 * token — a live credential that can mint new access tokens until it is
 * revoked. That is why it goes to the device keychain (`expo-secure-store`)
 * and not to AsyncStorage, which is plain unencrypted files any process with
 * filesystem access can read.
 *
 * Two platform facts shape everything below, and both were verified against
 * the installed package rather than assumed:
 *
 *  1. **SecureStore does not exist on web.** `ExpoSecureStore.web.js` in the
 *     installed module is literally `export default {}`. The browser gets
 *     `localStorage` instead — which is not a keychain, but web has no
 *     equivalent, and the same trade-off every web app makes.
 *
 *  2. **A value must stay under about 2 KB.** A Supabase session is a JSON
 *     blob containing an access-token JWT plus the user object, and routinely
 *     runs to 2–4 KB, so storing it whole fails — silently on some Android
 *     builds, which would look like "the app forgot my login". Values are
 *     therefore split across numbered keys.
 */

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Bytes per chunk. Comfortably under the ~2 KB ceiling, with room for the
 * multi-byte UTF-8 characters a token can contain — `length` counts UTF-16
 * code units, not bytes, so the margin has to absorb the difference.
 */
const CHUNK_SIZE = 1500;

/** Holds how many chunks a value was split into. */
const countKey = (key: string) => `${key}.parts`;
const chunkKey = (key: string, index: number) => `${key}.${index}`;

const isWeb = Platform.OS === 'web';

/**
 * The shape `supabase-js` expects for its `storage` option: three methods,
 * all promise-returning, all tolerant of a missing key.
 */
export const sessionStore = {
  async getItem(key: string): Promise<string | null> {
    if (isWeb) return webGet(key);

    const count = Number(await SecureStore.getItemAsync(countKey(key)));
    if (!count) return null;

    const parts: string[] = [];
    for (let i = 0; i < count; i++) {
      const part = await SecureStore.getItemAsync(chunkKey(key, i));
      // A missing chunk means a half-written or half-deleted value. Returning
      // the fragment would hand `supabase-js` corrupt JSON; treating it as
      // "no session" just asks the user to sign in again.
      if (part === null) return null;
      parts.push(part);
    }
    return parts.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    if (isWeb) return webSet(key, value);

    // Clear first: a shorter value would otherwise leave the tail chunks of
    // the previous one behind, and the next read would splice them on.
    await sessionStore.removeItem(key);

    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }

    for (const [i, chunk] of chunks.entries()) {
      await SecureStore.setItemAsync(chunkKey(key, i), chunk);
    }
    // Written last, so a crash mid-write leaves no count and the value reads
    // back as absent rather than as a truncated session.
    await SecureStore.setItemAsync(countKey(key), String(chunks.length));
  },

  async removeItem(key: string): Promise<void> {
    if (isWeb) return webRemove(key);

    const count = Number(await SecureStore.getItemAsync(countKey(key)));
    // Delete the count first, for the same reason it is written last.
    await SecureStore.deleteItemAsync(countKey(key));
    for (let i = 0; i < count; i++) {
      await SecureStore.deleteItemAsync(chunkKey(key, i));
    }
  },
};

// `localStorage` is unavailable in a few real cases — private browsing, or a
// browser configured to block site data — and throws rather than returning
// null. Since the only cost of failure here is signing in again, every access
// degrades quietly instead of taking the app down.

function webGet(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function webSet(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    // Session simply won't survive a reload.
  }
}

function webRemove(key: string): void {
  try {
    globalThis.localStorage?.removeItem(key);
  } catch {
    // Nothing to do — it was already unreachable.
  }
}
