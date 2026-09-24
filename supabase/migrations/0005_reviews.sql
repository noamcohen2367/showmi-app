-- showmi: public reviews.
--
-- The first thing in this database that one user writes and every other user
-- reads. That inversion is why it is its own table rather than columns on
-- `watchlist`: everything there is confined to `auth.uid()`, and confining a
-- review to its author would defeat the point of it.

create table public.reviews (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,

  -- Catalogue shows only. A hand-typed entry exists in exactly one person's
  -- list, so a public review of one would be addressed to nobody — there is
  -- no shared object for it to be about.
  --
  -- `cascade`, unlike the watchlist's `restrict`: if a show is ever really
  -- deleted, opinions about it have nothing left to attach to, whereas a
  -- saved row is a record worth failing loudly to protect.
  show_id     text not null references public.shows (id) on delete cascade,

  rating      smallint not null check (rating between 1 and 5),
  body        text check (body is null or length(btrim(body)) > 0),

  -- The vocabulary lives in the app, not here: a check constraint listing
  -- allowed tags would mean a migration every time a word is added or
  -- reworded.
  --
  -- What this enforces is only what a check constraint can: at most six, and
  -- no NULL among them. Per-element length would need a subquery, which
  -- check constraints do not allow — so the app is what keeps a tag from
  -- being an essay, and that is worth knowing rather than assuming.
  tags        text[] not null default '{}' check (
    array_length(tags, 1) is null
    or (array_length(tags, 1) <= 6 and array_position(tags, null) is null)
  ),

  /**
   * The author's name as it read when the review was written.
   *
   * Denormalised on purpose. `profiles` is locked to "your own row only"
   * (see 0003), and opening it up so reviews can join against it would make
   * every user's profile readable by everyone to solve a display problem.
   * Copying the one public field avoids that entirely.
   *
   * The cost is a snapshot: renaming yourself later does not rewrite old
   * reviews. That is a known trade, not an oversight — and the alternative
   * leaks more than it fixes.
   */
  author_name text,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- One review per person per show. A second opinion is an edit of the
  -- first, not another row — otherwise an average rating is trivially
  -- stuffed by posting repeatedly.
  unique (user_id, show_id)
);

-- The show page's own query: every review for one show, newest first.
create index reviews_show_created_idx on public.reviews (show_id, created_at desc);

-- Reuses the trigger function 0002 created. Its name says `watchlist`, but
-- its body only sets `updated_at` on whatever row is passed to it; a second
-- identical function would be the worse choice.
create trigger reviews_touch_updated_at
  before update on public.reviews
  for each row execute function public.watchlist_set_updated_at();

-- ---------------------------------------------------------------------------
-- Reporting
-- ---------------------------------------------------------------------------

-- Not an optional extra. App Store guideline 1.2 requires an app carrying
-- user-generated content to offer a way to report it and to act on those
-- reports, and Israeli defamation law makes the operator's position worse
-- the longer something stands unaddressed. Shipping reviews without this is
-- shipping a rejection.
create table public.review_reports (
  id          uuid primary key default gen_random_uuid(),
  review_id   uuid not null references public.reviews (id) on delete cascade,
  reporter_id uuid not null references auth.users (id) on delete cascade,
  reason      text not null check (length(btrim(reason)) > 0),
  created_at  timestamptz not null default now(),

  -- One report per person per review: a second one adds no information, and
  -- without this a single user could inflate a review's report count alone.
  unique (review_id, reporter_id)
);

create index review_reports_review_idx on public.review_reports (review_id);

-- ---------------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------------

alter table public.reviews        enable row level security;
alter table public.review_reports enable row level security;

-- Supabase's default privileges grant everything to both roles, TRUNCATE
-- included, and TRUNCATE is not subject to RLS. Removed here as elsewhere.
revoke all on public.reviews        from anon, authenticated;
revoke all on public.review_reports from anon, authenticated;

-- Reviews are readable by everyone, signed in or not — that is the whole
-- point of them, and it means a visitor deciding whether to make an account
-- can see what the app is worth first.
grant select on public.reviews to anon, authenticated;
grant select, insert, update, delete on public.reviews to authenticated;

-- Reports are write-only from the client's side: a reporter has no business
-- reading anyone else's reports, and the counts they would reveal are
-- exactly what a brigading user would want to watch.
grant insert on public.review_reports to authenticated;

create policy "reviews are public" on public.reviews
  for select to anon, authenticated using (true);

create policy "write own review" on public.reviews
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "edit own review" on public.reviews
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "delete own review" on public.reviews
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "report as yourself" on public.review_reports
  for insert to authenticated with check ((select auth.uid()) = reporter_id);
