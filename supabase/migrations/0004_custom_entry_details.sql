-- showmi: what a hand-typed watchlist entry can record.
--
-- A row for a show the catalogue does not have — something seen on Broadway,
-- in the West End, at a festival — could until now hold only a name and one
-- free-text field. This gives it a place and a date as well.

-- ---------------------------------------------------------------------------
-- 1. `custom_note` was always the location
-- ---------------------------------------------------------------------------

-- The column was named for what it might one day hold; the app has only ever
-- put one thing in it, and the field's own label says so — "איפה ראיתם?".
-- Renaming rather than adding `custom_location` beside it, because two
-- columns that mean the same thing is how one of them silently goes stale.
alter table public.watchlist rename column custom_note to custom_location;

-- ---------------------------------------------------------------------------
-- 2. When it was seen
-- ---------------------------------------------------------------------------

-- Someone remembers "London, 2019" far more often than an exact day, so the
-- date carries how precisely it is known. A year is stored as that year's
-- 1 January with precision 'year', and rendered as "2019" rather than as a
-- day nobody claimed.
--
-- A real `date` rather than free text: the watchlist is a record of things
-- already done, and the obvious thing to want from it later is an ordering.
-- Text would make "2019" and "March 2019" unsortable against each other.
alter table public.watchlist add column seen_on date;
alter table public.watchlist add column seen_on_precision text;

alter table public.watchlist
  add constraint watchlist_seen_on_precision_shape check (
    -- Both or neither: a precision without a date describes nothing, and a
    -- date without one cannot be displayed without guessing.
    (seen_on is null and seen_on_precision is null)
    or (seen_on is not null and seen_on_precision in ('year', 'day'))
  );

-- ---------------------------------------------------------------------------
-- 3. Keep catalogue rows empty of all of it
-- ---------------------------------------------------------------------------

-- The existing constraint says a catalogue row carries no custom fields. It
-- has to learn about the new ones too, or a row could claim to be a
-- catalogue show and still carry a hand-typed date.
alter table public.watchlist drop constraint watchlist_entry_shape;

alter table public.watchlist
  add constraint watchlist_entry_shape check (
    (
      show_id is not null
      and entry_id = show_id
      and custom_name is null
      and custom_location is null
      and seen_on is null
    )
    or (
      show_id is null
      and custom_name is not null
      and length(btrim(custom_name)) > 0
    )
  );
