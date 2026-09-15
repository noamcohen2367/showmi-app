// Custom entry point (instead of pointing `package.json`'s "main" straight at
// `expo-router/entry`) so we can force RTL layout *before* anything renders.
//
// The whole app's content is Hebrew, so it should always lay out
// right-to-left regardless of the device's own system language/locale —
// `I18nManager.forceRTL` is what makes that true regardless of the phone's
// own settings, rather than only being RTL on phones already set to a
// RTL system language.
//
// Native note: `I18nManager.forceRTL` persists a native flag, but only
// takes effect for a view hierarchy that mounts *after* it's set — on
// iOS/Android that means the very first launch after this change requires
// a full app kill + relaunch (not just a Fast Refresh/JS reload) to look
// correct; every launch after that already starts RTL. This has no effect
// on web at all (react-native-web's `I18nManager` is a permanent no-op
// stub) — the web equivalent is `dir="rtl"` on `<html>`, set once in
// `src/app/+html.tsx` instead.
import { I18nManager } from 'react-native';

I18nManager.allowRTL(true);
I18nManager.forceRTL(true);

// Must run after the calls above, which have to happen before the app's
// root entry is imported at all.
// eslint-disable-next-line import/first
import 'expo-router/entry';
