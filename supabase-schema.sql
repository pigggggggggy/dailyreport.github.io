create table if not exists public.work_records (
  id uuid primary key,
  collection text not null check (collection in ('workLogs', 'leetcode', 'projects')),
  payload jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.work_records enable row level security;

drop policy if exists "allow public read records" on public.work_records;
drop policy if exists "allow public insert records" on public.work_records;
drop policy if exists "allow public delete records" on public.work_records;
drop policy if exists "allow authenticated read records" on public.work_records;
drop policy if exists "allow authenticated insert records" on public.work_records;
drop policy if exists "allow authenticated delete records" on public.work_records;

create policy "allow authenticated read records"
on public.work_records
for select
to authenticated
using (auth.role() = 'authenticated');

create policy "allow authenticated insert records"
on public.work_records
for insert
to authenticated
with check (auth.role() = 'authenticated');

create policy "allow authenticated delete records"
on public.work_records
for delete
to authenticated
using (auth.role() = 'authenticated');
