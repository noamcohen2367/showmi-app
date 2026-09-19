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
- `src/data/watchlist-backend.ts` is still **in-memory** — the watchlist is
  lost when the app closes. That file is the single seam to replace when user
  accounts arrive.

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
