-- Activity log for full audit trail
create table public.activity_log (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users,
  action text not null,
  category text not null default 'General',
  details text default '',
  created_at timestamptz default now()
);

-- Index for fast queries by time
create index idx_activity_log_created_at on public.activity_log(created_at desc);

-- RLS
alter table public.activity_log enable row level security;

create policy "Authenticated read activity_log" on public.activity_log for select to authenticated using (true);
create policy "Authenticated insert activity_log" on public.activity_log for insert to authenticated with check (true);
