-- Referrals tracking table
create table public.referrals (
  id uuid default uuid_generate_v4() primary key,
  doctor_name text not null,
  specialty text not null default '',
  hospital text not null default '',
  phone text default '',
  fax text default '',
  email text default '',
  date_referred date,
  date_faxed date,
  date_called date,
  response_status text not null default 'Pending' check (response_status in ('Pending', 'Fax Sent', 'Called', 'Appointment Booked', 'Waiting for Response', 'Declined', 'Completed')),
  appointment_date date,
  next_steps text default '',
  notes text default '',
  created_by uuid references auth.users,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS
alter table public.referrals enable row level security;

create policy "Authenticated read referrals" on public.referrals for select to authenticated using (true);
create policy "Authenticated insert referrals" on public.referrals for insert to authenticated with check (true);
create policy "Authenticated update referrals" on public.referrals for update to authenticated using (true);
create policy "Authenticated delete referrals" on public.referrals for delete to authenticated using (true);
