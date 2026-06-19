-- Emitted stage payloads (one row per runner step), ordered by insertion id.
create table if not exists public.job_stages (
  id         bigserial primary key,
  job_id     text not null references public.jobs(id) on delete cascade,
  stage      text not null,
  payload    jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists job_stages_job_idx on public.job_stages (job_id, id);

alter table public.job_stages enable row level security;
