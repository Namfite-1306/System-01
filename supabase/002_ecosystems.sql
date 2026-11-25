-- Upgrade existing Research Studio Supabase schema before using ecosystems.
alter table public.research_records drop constraint if exists research_records_kind_check;
alter table public.research_records add constraint research_records_kind_check check
(kind in ('source','article','event','entity','relationship','case','analysis','profile','job','ecosystem'));
