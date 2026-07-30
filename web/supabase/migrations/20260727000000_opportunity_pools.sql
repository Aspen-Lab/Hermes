-- Service-role-only cache of complete scored/enriched daily opportunity pools.
-- The key is a one-way hash of the relevant profile signature plus local date.
create table if not exists public.opportunity_pools (
  key        text primary key,
  payload    jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists opportunity_pools_created_at_idx
  on public.opportunity_pools (created_at desc);

alter table public.opportunity_pools enable row level security;

-- No anon/authenticated policies: daily builds use the server-side service
-- role, which bypasses RLS. Opportunity pools must never be browser-writable.
revoke all on table public.opportunity_pools from anon, authenticated;
