create table if not exists public.work_records (
  id uuid primary key,
  collection text not null check (collection in ('workLogs', 'leetcode', 'projects')),
  payload jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.work_records enable row level security;

create policy "allow public read records"
on public.work_records
for select
using (true);

create policy "allow public insert records"
on public.work_records
for insert
with check (true);

create policy "allow public delete records"
on public.work_records
for delete
using (true);
