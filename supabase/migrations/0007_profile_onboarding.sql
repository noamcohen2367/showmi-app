-- showmi: the rest of what a profile holds, and permission to write it.
--
-- Run AFTER 0006.

-- ---------------------------------------------------------------------------
-- 1. Birthday
-- ---------------------------------------------------------------------------

-- Optional, and the only genuinely new column here — name, phone and region
-- (`full_name`, `phone`, `preferred_location`) already existed.
alter table public.profiles add column birth_date date;

-- A date, not an age: an age is wrong again a year later. Bounded at both
-- ends because neither a future birthday nor a 130-year-old is a person
-- filling in a form correctly, and catching it here means the app is not the
-- only thing standing between a typo and the database.
alter table public.profiles add constraint profiles_birth_date_sane check (
  birth_date is null
  or (birth_date > current_date - interval '130 years' and birth_date < current_date)
);

-- ---------------------------------------------------------------------------
-- 2. Permission to fill any of it in
-- ---------------------------------------------------------------------------

/**
 * 0003 deliberately replaced the table-wide UPDATE grant with a fixed list of
 * columns, to stop a user promoting themselves by writing `role`. That was
 * right, and it has a consequence that only shows up now: a column added
 * afterwards is not on the list, so nobody can write it.
 *
 * `username` and `is_public` arrived in 0006 and `birth_date` above, so all
 * three are unwritable as things stand — the sign-up screen would have
 * appeared to work and saved nothing.
 *
 * Re-granted as one explicit list rather than by adding to the old one, so
 * what a user may write is readable in a single place instead of assembled
 * across four migrations.
 */
revoke update on public.profiles from authenticated;

grant update (
  full_name,
  username,
  phone,
  preferred_location,
  birth_date,
  is_public,
  language,
  profile_image_url
) on public.profiles to authenticated;

-- Still absent, and still on purpose: `role`, `theater_id`, `level` and
-- `total_purchases` are things the system awards, and `email` belongs to
-- `auth.users`, which is the authority on it.

-- ---------------------------------------------------------------------------
-- 3. A note on the region
-- ---------------------------------------------------------------------------

-- `preferred_location` stays free text rather than gaining a check
-- constraint listing the five regions. The app owns that vocabulary, for the
-- same reason the review tags do: a constraint would turn "add a region" or
-- "reword one" into a migration, and the set of regions worth offering is
-- more likely to change than the shape of the column.
