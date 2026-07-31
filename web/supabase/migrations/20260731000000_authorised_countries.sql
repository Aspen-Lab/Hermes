-- Sync the countries where a user can already work without sponsorship.
-- RLS on public.profiles continues to restrict the value to its owner.

alter table public.profiles
  add column if not exists authorised_countries text[] not null default '{}';
