-- Durable live-event log (one row per emitted event). The bigserial `id` is the
-- monotonic seq used for replay/resume (?from=<seq>).
create table if not exists public.job_events (
  id         bigserial primary key,
  job_id     text not null references public.jobs(id) on delete cascade,
  type       text not null,
  payload    jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists job_events_job_idx on public.job_events (job_id, id);

alter table public.job_events enable row level security;
