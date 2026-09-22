-- showmi: close the privilege-escalation path on public.profiles.
--
-- Unlike 0002 this one CHANGES EXISTING OBJECTS. `profiles` was created
-- outside the migrations directory, along with its `handle_new_user` trigger
-- on `auth.users`. Neither is recreated here — the table, its columns, its
-- constraints and its trigger are all left exactly as they are.
--
-- The problem being fixed: a signed-in user could send
--
--     PATCH /rest/v1/profiles?id=eq.<their own id>   {"role": "admin"}
--
-- and it would succeed. The update policy allows any column of one's own row,
-- `authenticated` holds table-wide UPDATE, and the check constraint on `role`
-- accepts 'admin'. Nothing reads `role` today, so nothing is exploitable yet;
-- the theater/admin feature those columns exist for would inherit the hole.

-- ---------------------------------------------------------------------------
-- 1. Only the columns a user owns are writable by that user
-- ---------------------------------------------------------------------------

-- Column-level grants sit *alongside* RLS: a write must satisfy both. RLS
-- decides which row, this decides which columns of it. `role`, `theater_id`,
-- `level` and `total_purchases` are things the system awards, not things the
-- account holder declares, so they come off the list — they stay writable by
-- the service-role key, which is how they should have been set all along.
revoke update on public.profiles from authenticated;
grant update (full_name, phone, preferred_location, language, profile_image_url)
  on public.profiles to authenticated;

-- `email` is deliberately not grantable either: auth.users is the authority
-- on it, and letting a profile row disagree with the account it belongs to
-- creates two answers to the same question.

-- ---------------------------------------------------------------------------
-- 2. anon has no business reaching this table at all
-- ---------------------------------------------------------------------------

-- RLS already yields zero rows for a signed-out request, since auth.uid() is
-- null and `null = id` is never true. This removes the grant as well, so the
-- table is unreachable rather than merely empty — and removes TRUNCATE, which
-- is NOT subject to RLS at all.
revoke all on public.profiles from anon;

-- Same TRUNCATE removal for the signed-in role. Every other privilege it
-- needs is granted explicitly above and below.
revoke truncate, references, trigger on public.profiles from authenticated;

-- ---------------------------------------------------------------------------
-- 3. Policies scoped to the role that can actually satisfy them
-- ---------------------------------------------------------------------------

-- The existing two policies are granted `to public`, which includes `anon`,
-- and the update policy has no explicit `with check`. Postgres falls back to
-- the `using` expression when `with check` is absent, so that was not a hole
-- — but it is worth stating outright rather than depending on a default.
drop policy if exists "Users can read own profile"   on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

create policy "read own profile" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

create policy "update own profile" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- No insert policy: rows arrive via the `handle_new_user` trigger, which runs
-- as the definer and is not subject to these policies. No delete policy:
-- deleting an account is a `auth.users` operation, and the existing
-- `on delete cascade` removes the profile with it.
