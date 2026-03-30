-- Research topics and literature reviews
create table public.research_topics (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  query text not null,
  content text default '',
  status text not null default 'pending' check (status in ('pending', 'researching', 'completed', 'error')),
  sources text default '',
  created_by uuid references auth.users,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.research_topics enable row level security;

create policy "Authenticated read research" on public.research_topics for select to authenticated using (true);
create policy "Authenticated insert research" on public.research_topics for insert to authenticated with check (true);
create policy "Authenticated update research" on public.research_topics for update to authenticated using (true);
create policy "Authenticated delete research" on public.research_topics for delete to authenticated using (true);
