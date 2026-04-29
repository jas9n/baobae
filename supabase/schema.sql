create extension if not exists pgcrypto;

create table if not exists public.app_state (
  id integer primary key default 1 check (id = 1),
  event_name text not null default 'Baobae',
  phase_mode text not null default 'closed' check (phase_mode in ('closed', 'elimination', 'revival')),
  phase_number integer not null default 1,
  headline text not null default 'The next vote opens soon',
  subheadline text not null default 'Stay ready for the host''s cue.',
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.contestants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  bio text,
  avatar_url text,
  display_order integer not null,
  is_eliminated boolean not null default false,
  is_selectable boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  phase_number integer not null,
  mode text not null check (mode in ('elimination', 'revival')),
  contestant_id uuid not null references public.contestants(id) on delete cascade,
  voter_id uuid not null,
  voter_email text not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (phase_number, mode, voter_id)
);

create index if not exists votes_phase_lookup_idx
  on public.votes (phase_number, mode, contestant_id);

create or replace view public.vote_totals as
select
  contestant_id,
  phase_number,
  mode,
  count(*)::integer as votes_count
from public.votes
group by contestant_id, phase_number, mode;

alter table public.app_state enable row level security;
alter table public.contestants enable row level security;
alter table public.votes enable row level security;

drop policy if exists "Public can read app state" on public.app_state;
create policy "Public can read app state"
on public.app_state
for select
to anon, authenticated
using (true);

drop policy if exists "Public can read contestants" on public.contestants;
create policy "Public can read contestants"
on public.contestants
for select
to anon, authenticated
using (true);

insert into public.app_state (id)
values (1)
on conflict (id) do nothing;

