-- showmi: the per-user watchlist.
--
-- Purely additive. Creates one table that does not exist yet and touches
-- nothing that does.
--
-- NOTE: `public.profiles` already exists in this project, created outside the
-- migrations directory, and already has a `handle_new_user` trigger on
-- `auth.users`. It is deliberately NOT created here. Its columns already
-- cover what the account work needs — `full_name` for a display name,
-- `preferred_location` for the Home screen's city pill, `language` for the
-- locale — so no column is added either. Hardening its policies is a
-- separate migration (0003), because that one changes existing behaviour.

create table public.watchlist (
  user_id     uuid not null references auth.users (id) on delete cascade,

  -- The app's own entry id, stored verbatim so the client map round-trips.
  -- For a catalogue show it equals `show_id`; for a hand-typed entry it is a
  -- locally minted 'custom:...' id (see CUSTOM_ID_PREFIX in the app).
  entry_id    text not null,

  -- Null for hand-typed entries. `restrict`, not `cascade`: the scraper never
  -- deletes a show — it flips `is_active` — precisely so saved rows stay
  -- valid. If a show is ever deleted by hand, this makes it fail loudly
  -- instead of quietly emptying somebody's watchlist.
  show_id     text references public.shows (id) on delete restrict,

  status      text not null check (status in ('want', 'seen')),

  -- Present only on hand-typed entries: a show seen abroad or somewhere the
  -- app does not aggregate. Mirrors CustomEntry in the app.
  custom_name text,
  custom_note text,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- One entry per id per user. Also the lookup index for "this user's whole
  -- list" — user_id is the leading column, so no separate index is needed.
  primary key (user_id, entry_id),

  -- A row is either a catalogue show or a hand-typed one, never both and
  -- never neither. Enforced here rather than in the app because the app is
  -- not the only thing that can write these rows.
  constraint watchlist_entry_shape check (
    (
      show_id is not null
      and entry_id = show_id
      and custom_name is null
      and custom_note is null
    )
    or (
      show_id is null
      and custom_name is not null
      and length(btrim(custom_name)) > 0
    )
  )
);

-- Answers "is this show saved" for the Home feed and the show page without
-- scanning the user's whole list. Partial, because hand-typed rows have no
-- show_id and would only bloat it.
create index watchlist_user_show_idx on public.watchlist (user_id, show_id)
  where show_id is not null;

-- Named for this table rather than something generic like `touch_updated_at`,
-- so it cannot collide with a function of that name already in the project —
-- the migrations directory is known not to be a complete picture of it.
create function public.watchlist_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger watchlist_touch_updated_at
  before update on public.watchlist
  for each row execute function public.watchlist_set_updated_at();

-- ---------------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------------

alter table public.watchlist enable row level security;

-- Supabase's default privileges grant ALL on new public tables to both `anon`
-- and `authenticated` — including TRUNCATE, which is NOT subject to RLS.
-- PostgREST never issues a TRUNCATE so this is not reachable from the app's
-- key, but the grant has no legitimate use and is removed rather than relied
-- upon to stay unreachable.
revoke all on public.watchlist from anon;
revoke all on public.watchlist from authenticated;
grant select, insert, update, delete on public.watchlist to authenticated;

-- Four separate policies rather than one `for all`: `for all` shares a single
-- expression between the read check and the write check, which makes it easy
-- to end up with a policy that lets a user hand a row to somebody else.
-- Spelling out `with check` on insert and update is what stops a user
-- creating or reassigning a row under another user_id.
--
-- `(select auth.uid())` rather than a bare `auth.uid()`: wrapped in a
-- subquery the planner hoists it into an InitPlan and evaluates it once per
-- statement instead of once per row.

create policy "read own watchlist"   on public.watchlist for select to authenticated using ((select auth.uid()) = user_id);
create policy "insert own watchlist" on public.watchlist for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "update own watchlist" on public.watchlist for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "delete own watchlist" on public.watchlist for delete to authenticated using ((select auth.uid()) = user_id);
