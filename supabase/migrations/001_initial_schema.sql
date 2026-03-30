-- CareCoordinator Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles table (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  display_name text not null,
  created_at timestamptz default now()
);

-- Auto-create profile on user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Summary (singleton row)
create table public.summary (
  id int primary key default 1 check (id = 1),
  content text default '',
  updated_at timestamptz default now()
);

insert into public.summary (content) values ('No information has been added yet. Submit your first entry to get started.');

-- Entries (raw submissions)
create table public.entries (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  content text not null,
  category text not null default 'General',
  entry_type text not null default 'text',
  image_urls text[] default '{}',
  created_at timestamptz default now()
);

-- Timeline events
create table public.timeline_events (
  id uuid default uuid_generate_v4() primary key,
  event_date date not null,
  category text not null default 'General',
  description text not null,
  related_entry_id uuid references public.entries,
  related_report_url text,
  created_at timestamptz default now()
);

-- Action items
create table public.action_items (
  id uuid default uuid_generate_v4() primary key,
  assignee text not null,
  description text not null,
  due_date date,
  status text not null default 'open' check (status in ('open', 'done')),
  created_by uuid references auth.users,
  created_at timestamptz default now()
);

-- Reports (uploaded files)
create table public.reports (
  id uuid default uuid_generate_v4() primary key,
  filename text not null,
  file_url text not null,
  description text default '',
  uploaded_by uuid references auth.users,
  uploaded_at timestamptz default now()
);

-- Patient info (singleton row, flexible JSONB)
create table public.patient_info (
  id int primary key default 1 check (id = 1),
  data jsonb default '{
    "name": "",
    "dob": "",
    "health_card": "",
    "diagnoses": [
      {"organ": "Kidney", "details": ""},
      {"organ": "Uterus", "details": ""}
    ],
    "medications": "",
    "allergies": "",
    "doctors": [],
    "insurance_notes": ""
  }'::jsonb,
  updated_at timestamptz default now(),
  updated_by uuid references auth.users
);

insert into public.patient_info (data) values ('{
  "name": "",
  "dob": "",
  "health_card": "",
  "diagnoses": [
    {"organ": "Kidney", "details": ""},
    {"organ": "Uterus", "details": ""}
  ],
  "medications": "",
  "allergies": "",
  "doctors": [],
  "insurance_notes": ""
}'::jsonb);

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.summary enable row level security;
alter table public.entries enable row level security;
alter table public.timeline_events enable row level security;
alter table public.action_items enable row level security;
alter table public.reports enable row level security;
alter table public.patient_info enable row level security;

-- Policies: all authenticated users can read and write everything
create policy "Authenticated users can view profiles" on public.profiles for select to authenticated using (true);
create policy "Users can update own profile" on public.profiles for update to authenticated using (auth.uid() = id);

create policy "Authenticated read summary" on public.summary for select to authenticated using (true);
create policy "Authenticated update summary" on public.summary for update to authenticated using (true);

create policy "Authenticated read entries" on public.entries for select to authenticated using (true);
create policy "Authenticated insert entries" on public.entries for insert to authenticated with check (true);

create policy "Authenticated read timeline" on public.timeline_events for select to authenticated using (true);
create policy "Authenticated insert timeline" on public.timeline_events for insert to authenticated with check (true);
create policy "Authenticated update timeline" on public.timeline_events for update to authenticated using (true);
create policy "Authenticated delete timeline" on public.timeline_events for delete to authenticated using (true);

create policy "Authenticated read action_items" on public.action_items for select to authenticated using (true);
create policy "Authenticated insert action_items" on public.action_items for insert to authenticated with check (true);
create policy "Authenticated update action_items" on public.action_items for update to authenticated using (true);
create policy "Authenticated delete action_items" on public.action_items for delete to authenticated using (true);

create policy "Authenticated read reports" on public.reports for select to authenticated using (true);
create policy "Authenticated insert reports" on public.reports for insert to authenticated with check (true);
create policy "Authenticated delete reports" on public.reports for delete to authenticated using (true);

create policy "Authenticated read patient_info" on public.patient_info for select to authenticated using (true);
create policy "Authenticated update patient_info" on public.patient_info for update to authenticated using (true);

-- Create storage bucket for uploads
insert into storage.buckets (id, name, public) values ('uploads', 'uploads', false);

-- Storage policies
create policy "Authenticated users can upload" on storage.objects for insert to authenticated with check (bucket_id = 'uploads');
create policy "Authenticated users can view uploads" on storage.objects for select to authenticated using (bucket_id = 'uploads');
create policy "Authenticated users can delete uploads" on storage.objects for delete to authenticated using (bucket_id = 'uploads');
