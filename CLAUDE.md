@AGENTS.md

# showmi

An Expo app (SDK 57, React Native 0.86, expo-router, TypeScript) that aggregates
Israeli theater schedules, plus a separate scraper that fills its database.

Hebrew is the product language and the app is RTL throughout (`I18nManager.forceRTL`
in `index.js`, `dir="rtl"` in `src/app/+html.tsx`).

## Two packages, one repo

**`/` — the app.** Never imports anything from `scraper/`.

**`scraper/` — its own Node/TS package**, with its own `package.json`,
`node_modules` and tests. Run its commands from inside `scraper/`.

They meet only at the Supabase database.

## Architecture

### Scraper (`scraper/src/`)

Collects shows, images, descriptions, performers and showtimes from three
theaters that have no public API. Every adapter was written against the real
site structure, verified in a browser in September 2026.

- `adapters/habima.ts` — show pages at `/shows/<slug>/`, list from the
  repertoire page. Dates from `<time datetime>`. Performers arrive in two
  shapes: `ul.actors-list` cards, or "role: name" rows in `ul.actors-names`.
- `adapters/cameri.ts` — the whole season comes from JSON embedded in the page
  (`let calendarEvents = [...]`). Each performance is a tuple; element `[3]` is
  the Pres Global id. Show pages are then read to enrich description, credits
  and gallery — enrichment, so a failure there does not drop the show.
- `adapters/lessin.ts` — show pages joined with the home-page calendar, which
  is where the year comes from. Joined on order id; performances that appear
  only on the home page are matched by title.
- All three sell through Pres Global. A showtime id is `<theater>-<order id>`
  and is stable across runs.
- `lib/http.ts` — 1.5s delay between requests to the same host, identified
  User-Agent, exponential backoff.
- `lib/sanity.ts` — refuses to write if zero shows were found, if the count
  dropped below half the previous run (only once ≥4 shows exist), or if more
  than half the shows have no images.
- `lib/categories.ts` — maps each theater's free-text `genre_label` onto the
  app's fixed category set. Deliberately conservative: an unmatched label
  yields no category rather than a wrong one.
- `db.ts` — vanished *showtimes* are deleted; vanished *shows* are only marked
  `is_active = false`, because the watchlist references `shows.id`.

### Database (`supabase/migrations/0001_catalog.sql`, already applied)

`theaters`, `shows` (with `performers`/`credits` as jsonb, `is_active`,
`first_seen_at`, `dominant_color`, `genre_label`), `showtimes` (with `hall`,
`subtitles`, and `starts_at` as `timestamp` without time zone, in Israel time).

RLS: `anon` and `authenticated` may only `select`. The scraper writes with the
service-role key.

### App

- `src/data/shows.ts` reads the Supabase REST API with plain `fetch` —
  deliberately no `@supabase/supabase-js`, since one read-only query needs no
  client library. The publishable key goes in the `apikey` header only. Rows are
  mapped onto `src/types/show.ts` without reshaping them.
- A shared 10-minute cache, because every screen calls `useHomeFeed`
  independently. A failed request is never cached.
- "Suggested" / "new" / "trending" are simple rules, not personalization. The
  banner shows the soonest upcoming shows.
- `src/data/watchlist-backend.ts` holds two implementations and
  `WatchlistProvider` picks between them: signed out the list is in memory
  and lost when the app closes, signed in it is the `watchlist` table.
  Whatever was saved while signed out is merged up on sign-in, local winning
  a collision. A Supabase backend is bound to one user id at construction, so
  it can never outlive the user it belongs to.
- Writes are optimistic **and rolled back if the save fails**, with an alert.
  `save()` rejecting means the change did not happen; nothing may treat it as
  fire-and-forget. `useWatchlist().loadFailed` is likewise separate from an
  empty list — over a network those are different situations, and the
  watchlist screen says which one it is.
- `src/data/shows.ts` still sends only `apikey`, and should. It reads the
  public catalogue and touches no user-owned table, so it needs no session.

## Commands

From the repo root (the app):

```
npx expo start                  # run the app
npx tsc --noEmit                # typecheck
npx eslint src/                 # lint
npx expo export --platform web  # verify it bundles
```

From `scraper/`:

```
npm test                              # vitest, 46 tests
npm run typecheck
npm run scrape:dry -- --theater habima   # or cameri / lessin — no writes
npm run scrape:local                     # real run, writes to Supabase
```

Scheduled runs: `.github/workflows/scrape.yml`, twice daily (03:00 and 13:00
UTC ≈ 06:00 and 16:00 Israel). Secrets are configured in GitHub.

Known pre-existing lint error in `src/hooks/use-color-scheme.web.ts` — not
introduced by any recent change.

## Rules

**Secrets.** The Supabase service-role key lives only in `scraper/.env` and in
GitHub Secrets. It never enters the app, the code, a commit, or any output.
Both real `.env` files are gitignored; only `scraper/.env.example`, which holds
placeholders, is tracked. Check `.env` is not staged before every commit.

**Scraping stays polite.** No concurrency against one site, never lower the
delay, never work around protections.

**When a site changes structure:** save a real page as a fixture first, then
write a failing test, and only then fix the adapter. Fixtures live in
`scraper/test/fixtures/` and each one states at the top what is real in it and
what was reconstructed.

**Language.** Code and code comments in English. Anything the user sees, in
Hebrew. Explain to Noam in Hebrew.

**Ask first** before large changes, and before any action against Supabase or
GitHub.

**Design constraints** (Noam does not want the product to read as AI-generated):
no purple, no fake data or testimonials, no emoji icons, no AI-sounding copy,
no heavy scroll or cursor animation. The accent lives in one place — the
`Accent` block in `src/constants/theme.ts` — and the ambient gradient's alpha
ranges in `src/constants/gradient-palette.ts` are tuned to that accent's
luminance, so re-derive the documented contrast ratios if the hue changes.

**Do not deploy** until there is a real domain, a custom favicon, every mention
of AI authorship removed, and a privacy policy, terms page and accessibility
statement.

**`app.json` carries a `UIApplicationSceneManifest` under `ios.infoPlist`, and
it must stay.** iOS 26 turned "app has not adopted the UIScene lifecycle" from
a warning into a trap: built against the iOS 26+ SDK, the app crashed on a
real iOS 27 device the instant UIKit created the window — splash, then gone —
while running fine on an iOS 17.5 simulator, where the check does not exist.
Nothing in `node_modules` adopts scenes (Expo 57 / RN 0.86.3 still create the
window the legacy way in `AppDelegate.swift`), so declaring the manifest is
what satisfies the check. Remove it when Expo ships real scene support, not
before.

**`npx expo prebuild` wipes `DEVELOPMENT_TEAM` from the Xcode project.**
Signing set by hand in Xcode does not survive a regeneration. `expo run:ios`
re-applies it automatically, so this is a surprise rather than a problem —
but do not go hunting in Xcode for settings that a prebuild just discarded.

**Before release, remove `exp://**` from the Supabase redirect allow-list**
(Authentication > URL Configuration). It was added only so sign-in could be
tested from Expo Go, and it lets any Expo Go runtime anywhere receive a
callback for this project. PKCE limits what that is worth — the code is
useless without the verifier held on the requesting device — but it is far
wider than a shipped app should carry. The release app needs only
`showmi://**`.

**Accounts collect personal data**, so the privacy policy above stops being a
checklist item and becomes a prerequisite.
