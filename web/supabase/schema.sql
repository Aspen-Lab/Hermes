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
