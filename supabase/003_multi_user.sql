-- Run in the SQL Editor of the Research Studio Supabase project.
-- Existing research_records remain separate from the new hosted workspace.
begin;

create table if not exists public.research_feed_records (
  kind text not null check (kind in ('source','article','event','entity','profile','job')),
  id text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (kind, id)
);
create index if not exists research_feed_updated
  on public.research_feed_records (kind, updated_at desc, id);
alter table public.research_feed_records enable row level security;
revoke all on public.research_feed_records from anon, authenticated;
grant select on public.research_feed_records to authenticated;
grant all on public.research_feed_records to service_role;
drop policy if exists "Read shared news" on public.research_feed_records;
create policy "Read shared news" on public.research_feed_records
  for select to authenticated
  using (kind in ('source','article','event','entity'));

create table if not exists public.research_user_records (
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('source','article','event','entity','relationship','case','analysis','profile','job','ecosystem')),
  id text not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (owner_id, kind, id)
);
create index if not exists research_user_updated
  on public.research_user_records (owner_id, kind, updated_at desc, id);
create unique index if not exists research_public_analysis_id
  on public.research_user_records (id) where kind = 'analysis';
alter table public.research_user_records enable row level security;
revoke all on public.research_user_records from anon, authenticated;
grant select, insert, update, delete on public.research_user_records to authenticated;
grant all on public.research_user_records to service_role;
drop policy if exists "Own workspace" on public.research_user_records;
create policy "Own workspace" on public.research_user_records
  for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);

-- Public portfolio exposes only the snapshot explicitly approved for publication.
create or replace function public.research_published_analysis(analysis_id text)
returns jsonb
language sql stable security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', r.id,
    'status', 'published',
    'is_demo', r.payload->'is_demo',
    'published_snapshot', r.payload->'published_snapshot'
  )
  from public.research_user_records r
  where r.kind = 'analysis'
    and r.id = analysis_id
    and r.payload->>'status' = 'published'
    and r.payload->'published_snapshot' is not null
  limit 1;
$$;
revoke all on function public.research_published_analysis(text) from public;
grant execute on function public.research_published_analysis(text) to anon, authenticated, service_role;

commit;
