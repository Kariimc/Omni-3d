-- Omni3D job persistence.
-- The full schema-valid envelope is stored in `payload` (jsonb); the scalar
-- columns are projections for cheap indexing/filtering.

create table if not exists public.jobs (
  id         text primary key,
  created_at timestamptz not null default now(),
  owner      text not null default 'user_anon',
  status     text not null default 'queued',
  payload    jsonb not null
);

create index if not exists jobs_created_at_idx on public.jobs (created_at desc);
create index if not exists jobs_owner_idx on public.jobs (owner);

-- Lock down anon/auth access; the API connects with the service-role key, which
-- bypasses RLS. Add explicit policies here if you later expose client reads.
alter table public.jobs enable row level security;
