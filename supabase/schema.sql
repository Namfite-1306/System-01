-- MVP uses typed JSON records so the same repository can run on SQLite or PostgreSQL.
-- Service-role key is server-only. No direct browser access to private research.
create table if not exists public.research_records (
  kind text not null check (kind in ('source','article','event','entity','relationship','case','analysis','profile','job','ecosystem')),
  id text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key(kind,id)
);
create index if not exists research_records_updated on public.research_records(kind,updated_at desc);
alter table public.research_records enable row level security;
revoke all on public.research_records from anon, authenticated;
grant all on public.research_records to service_role;
-- Do not run on the existing portfolio database without selecting the correct project.
