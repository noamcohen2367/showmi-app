-- showmi catalogue: theaters → shows → showtimes.
--
-- Written only by the scraper (service-role key, bypasses RLS).
-- Read by the app (anon key) through the read-only policies at the bottom.

create table public.theaters (
  id       text primary key,            -- 'habima', 'cameri', 'lessin'
  name     text not null,
  city     text not null,
  website  text not null
);

create table public.shows (
  id             text primary key,      -- '<theater>-<slug from the theater's own URL>'
  theater_id     text not null references public.theaters (id),
  source_url     text not null unique,  -- the show's page on the theater's site
  name           text not null,
  synopsis       text not null default '',
  images         text[] not null default '{}',
  dominant_color text,                  -- '#RRGGBB', optional (see Show.dominantColor)
  genre_label    text,                  -- the theater's own free text, e.g. 'קומדיה רומנטית עם שירים'
  categories     text[] not null default '{}',  -- normalised, what the app filters by
  performers     jsonb not null default '[]',   -- [{ "name", "role", "photoUrl"?, "profileUrl"? }]
  credits        jsonb not null default '[]',   -- [{ "name": "...", "role": "בימוי" }]
  is_active      boolean not null default true, -- false once the theater stops listing it
  first_seen_at  timestamptz not null default now(),
  last_seen_at   timestamptz not null default now()
);

create index shows_theater_active_idx on public.shows (theater_id) where is_active;

create table public.showtimes (
  id            text primary key,       -- '<theater>-<Pres Global order id>'
  show_id       text not null references public.shows (id) on delete cascade,
  theater_id    text not null references public.theaters (id),
  -- Wall-clock time in Asia/Jerusalem, deliberately WITHOUT a time zone:
  -- it round-trips as '2026-10-14T20:00:00', exactly Showtime.startsAt.
  starts_at     timestamp not null,
  purchase_url  text not null,
  hall          text,
  subtitles     text,                   -- e.g. 'English subtitles' (Cameri)
  last_seen_at  timestamptz not null default now()
);

create index showtimes_show_starts_idx on public.showtimes (show_id, starts_at);
create index showtimes_theater_seen_idx on public.showtimes (theater_id, last_seen_at);

-- Read-only access for the app.
alter table public.theaters enable row level security;
alter table public.shows     enable row level security;
alter table public.showtimes enable row level security;

create policy "catalogue is public" on public.theaters for select to anon, authenticated using (true);
create policy "catalogue is public" on public.shows     for select to anon, authenticated using (true);
create policy "catalogue is public" on public.showtimes for select to anon, authenticated using (true);

insert into public.theaters (id, name, city, website) values
  ('habima', 'הבימה',     'תל אביב', 'https://www.habima.co.il'),
  ('cameri', 'הקאמרי',    'תל אביב', 'https://www.cameri.co.il'),
  ('lessin', 'בית ליסין', 'תל אביב', 'https://www.lessin.co.il');
