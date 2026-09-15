import { ScrollViewStyleReset, useServerDocumentContext } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

/**
 * Custom web document shell (Expo Router's special `+html.tsx` file — see
 * https://docs.expo.dev/router/reference/static-rendering/#root-html).
 *
 * The only reason this file exists (instead of Expo Router's default shell)
 * is to force `dir="rtl"` on `<html>`: the whole app's content is Hebrew and
 * should always lay out right-to-left, but on **web** — unlike iOS/Android —
 * that's not something `I18nManager.forceRTL` (set in `index.js`) can do at
 * all. React Native Web's `I18nManager` is a no-op stub (it always reports
 * `isRTL: false`, regardless of what's set); RTL layout on the web only
 * comes from the actual browser respecting the standard HTML/CSS `dir`
 * attribute, which is what this sets, once, at the document root.
 */
export default function Root({ children }: PropsWithChildren) {
  const { htmlAttributes, bodyAttributes, headNodes, bodyNodes } = useServerDocumentContext();

  return (
    <html {...htmlAttributes} lang="he" dir="rtl">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        {/* Keeps native/web scroll-container parity — see the component's own doc comment. */}
        <ScrollViewStyleReset />
        {headNodes}
      </head>
      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}
