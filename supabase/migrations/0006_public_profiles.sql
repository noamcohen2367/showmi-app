-- showmi: usernames, and profiles other people can look at.
--
-- Run AFTER 0005. This adds the identity that reviews attribute themselves
-- to, and opens a door that until now did not exist anywhere in this
-- database: a row one user wrote being read by another.
--
-- That door is shut by default. `is_public` starts false for everybody,
-- including every account that already exists — so nothing anyone wrote
-- while the list was private becomes visible without them choosing it. The
-- choice is the consent.

-- ---------------------------------------------------------------------------
-- 1. Username
-- ---------------------------------------------------------------------------

alter table public.profiles add column username text;

-- Lowercase, digits and underscore only, 3–20 characters.
--
-- Lowercase is enforced rather than merely preferred, because case is how
-- impersonation gets in: `Noam` and `noam` are visually the same account to
-- a reader and two different rows to a unique index. Storing one case makes
-- that impossible rather than unlikely. The app lowercases before writing;
-- this makes sure nothing else can forget to.
alter table public.profiles add constraint profiles_username_format check (
  username is null or username ~ '^[a-z0-9_]{3,20}$'
);

-- Names the app or a person could be mistaken for. Not exhaustive and not
-- meant to be — it is the handful whose absence would be embarrassing.
alter table public.profiles add constraint profiles_username_not_reserved check (
  username is null
  or username not in (
    'admin', 'administrator', 'support', 'help', 'showmi', 'official',
    'root', 'system', 'moderator', 'staff', 'about', 'settings', 'me'
  )
);

create unique index profiles_username_idx on public.profiles (username)
  where username is not null;

-- ---------------------------------------------------------------------------
-- 2. The switch
-- ---------------------------------------------------------------------------

-- `false` for everyone, existing rows included. A user who wrote "London,
-- 2019, with my father" into a list that was private at the time has not
-- agreed to publish it, and a default of true would publish it for them.
alter table public.profiles
  add column is_public boolean not null default false;

-- ---------------------------------------------------------------------------
-- 3. What a stranger can see
-- ---------------------------------------------------------------------------

/**
 * `profiles` stays locked to "your own row only" — it holds an email, a
 * phone number, a role and a purchase count, none of which belong to anyone
 * else.
 *
 * A view is what makes a public profile possible without loosening that.
 * The three columns below are the only ones that physically exist here, so
 * there is no policy to get wrong, no column grant to forget, and no
 * creatively-shaped query that reaches an email through it.
 *
 * `security_invoker = false` is the point of the whole thing: the view runs
 * as its owner and so passes the base table's RLS, which is what lets it
 * show rows belonging to other people. It is stated explicitly rather than
 * left to the default, because that default has changed between Postgres
 * versions and this is not a thing to leave implied.
 */
create view public.public_profiles
with (security_invoker = false) as
select id, username, full_name
from public.profiles
where is_public and username is not null;

grant select on public.public_profiles to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Seen lists on a public profile
-- ---------------------------------------------------------------------------

/**
 * Answers "is this person's profile open" from inside a policy.
 *
 * It has to be `security definer`, and that is not a shortcut: a policy's
 * subquery runs as the *querying* user, who cannot read anybody else's
 * `profiles` row — so the check would come back false for every stranger and
 * the feature would silently never work.
 *
 * `set search_path = ''` is the hardening that has to accompany definer
 * rights, which is why every name inside is fully qualified.
 */
create function public.profile_is_public(profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select is_public from public.profiles where id = profile_id), false)
$$;

-- Anon gets select on `watchlist` for the first time. The grant alone
-- reveals nothing: the policy below is the gate, and it opens only for rows
-- that are marked seen and belong to somebody who opened their profile.
grant select on public.watchlist to anon;

/**
 * Deliberately `status = 'seen'` and nothing else.
 *
 * "Want to see" is a plan, not a record. It says where someone intends to be
 * on a given evening, which is a different and more sensitive thing than
 * where they have already been — and nobody asked for their plans to be
 * published. Opening a profile publishes what you have watched, not what you
 * are about to do.
 */
create policy "read public seen lists" on public.watchlist
  for select to anon, authenticated
  using (status = 'seen' and public.profile_is_public(user_id));
