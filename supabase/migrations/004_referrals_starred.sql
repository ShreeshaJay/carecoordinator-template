-- Add starred column to referrals
alter table public.referrals add column if not exists starred boolean not null default false;
