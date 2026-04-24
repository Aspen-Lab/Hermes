-- Run this once in the Supabase SQL Editor.
-- Authentication → SQL Editor → New query → paste → Run.

-- ── profiles table ─────────────────────────────────────────────

create table if not exists public.profiles (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  display_name         text,
  research_topics      text[] not null default '{}',
  preferred_methods    text[] not null default '{}',
  preferred_venues     text[] not null default '{}',
  location_preferences text[] not null default '{}',
  career_stage         text,
  industry_vs_academia text,
  phd_year             integer,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- Keep updated_at current on any change.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ── Row-level security ────────────────────────────────────────

alter table public.profiles enable row level security;

drop policy if exists "users read own profile"  on public.profiles;
drop policy if exists "users insert own profile" on public.profiles;
drop policy if exists "users update own profile" on public.profiles;

create policy "users read own profile"
  on public.profiles for select
  using (auth.uid() = user_id);

create policy "users insert own profile"
  on public.profiles for insert
  with check (auth.uid() = user_id);

create policy "users update own profile"
  on public.profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── Auto-create empty profile row when a user signs up ────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Notification / digest preferences (profiles extension) ────
-- Runs idempotently on re-runs.

alter table public.profiles
  add column if not exists digest_enabled    boolean  not null default true,
  add column if not exists digest_hour_local smallint not null default 8
    check (digest_hour_local between 0 and 23),
  add column if not exists digest_timezone   text     not null default 'UTC',
  add column if not exists digest_channel    text     not null default 'inapp'
    check (digest_channel in ('inapp','email','both')),
  add column if not exists digest_frequency  text     not null default 'daily'
    check (digest_frequency in ('daily','weekdays','weekly','off'));

-- ── saved_items ────────────────────────────────────────────────
-- Unified saved list for papers/events/jobs. `payload` is a full
-- snapshot so links survive source-site decay and scoring churn.

create table if not exists public.saved_items (
  user_id   uuid not null references auth.users(id) on delete cascade,
  item_id   text not null,
  item_kind text not null check (item_kind in ('paper','event','job')),
  payload   jsonb not null,
  saved_at  timestamptz not null default now(),
  primary key (user_id, item_id)
);

create index if not exists saved_items_user_kind_idx
  on public.saved_items (user_id, item_kind, saved_at desc);

alter table public.saved_items enable row level security;

drop policy if exists "users read own saved"   on public.saved_items;
drop policy if exists "users insert own saved" on public.saved_items;
drop policy if exists "users delete own saved" on public.saved_items;
drop policy if exists "users update own saved" on public.saved_items;

create policy "users read own saved"
  on public.saved_items for select using (auth.uid() = user_id);
create policy "users insert own saved"
  on public.saved_items for insert with check (auth.uid() = user_id);
create policy "users delete own saved"
  on public.saved_items for delete using (auth.uid() = user_id);
create policy "users update own saved"
  on public.saved_items for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── read_items ────────────────────────────────────────────────
-- Upsert-semantic: one row per (user, item). Enables per-day
-- aggregation for the reading calendar and streak.

create table if not exists public.read_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null,
  read_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

create index if not exists read_items_user_day_idx
  on public.read_items (user_id, read_at desc);

alter table public.read_items enable row level security;

drop policy if exists "users read own reads"   on public.read_items;
drop policy if exists "users insert own reads" on public.read_items;
drop policy if exists "users delete own reads" on public.read_items;

create policy "users read own reads"
  on public.read_items for select using (auth.uid() = user_id);
create policy "users insert own reads"
  on public.read_items for insert with check (auth.uid() = user_id);
create policy "users delete own reads"
  on public.read_items for delete using (auth.uid() = user_id);

-- ── feedback_events ───────────────────────────────────────────
-- Append-only signal stream. Feeds future Tier 1/2 re-ranking.

create table if not exists public.feedback_events (
  id         bigserial primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  item_id    text not null,
  item_kind  text not null check (item_kind in ('paper','event','job')),
  feedback   text not null check (feedback in ('liked','saved','notInterested','moreLikeThis')),
  created_at timestamptz not null default now()
);

create index if not exists feedback_events_user_time_idx
  on public.feedback_events (user_id, created_at desc);

alter table public.feedback_events enable row level security;

drop policy if exists "users read own feedback"   on public.feedback_events;
drop policy if exists "users insert own feedback" on public.feedback_events;

create policy "users read own feedback"
  on public.feedback_events for select using (auth.uid() = user_id);
create policy "users insert own feedback"
  on public.feedback_events for insert with check (auth.uid() = user_id);

-- ── briefing_deliveries ───────────────────────────────────────
-- Each scheduled daily digest run writes one row per user.
-- Drives the in-app "Past briefings" inbox + calendar activity.

create table if not exists public.briefing_deliveries (
  id           bigserial primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  delivered_at timestamptz not null default now(),
  channel      text not null check (channel in ('inapp','email','both')),
  item_ids     text[] not null default '{}',
  payload      jsonb not null,
  opened_at    timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists briefing_deliveries_user_time_idx
  on public.briefing_deliveries (user_id, delivered_at desc);

alter table public.briefing_deliveries enable row level security;

drop policy if exists "users read own briefings"    on public.briefing_deliveries;
drop policy if exists "users update own briefings"  on public.briefing_deliveries;

-- Reads allowed; writes are done by the cron job with the service role,
-- which bypasses RLS. We still want users to mark opened_at from the UI.
create policy "users read own briefings"
  on public.briefing_deliveries for select using (auth.uid() = user_id);
create policy "users update own briefings"
  on public.briefing_deliveries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
