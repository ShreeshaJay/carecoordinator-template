-- Chat messages table for shared family chat with Claude
create table public.chat_messages (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  user_display_name text default '',
  created_at timestamptz default now()
);

create index idx_chat_messages_created_at on public.chat_messages(created_at asc);

alter table public.chat_messages enable row level security;

create policy "Authenticated read chat" on public.chat_messages for select to authenticated using (true);
create policy "Authenticated insert chat" on public.chat_messages for insert to authenticated with check (true);
