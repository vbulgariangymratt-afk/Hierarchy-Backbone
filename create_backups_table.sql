-- Run this in your Supabase SQL Editor to enable Cloud History

create table if not exists user_backups (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  content jsonb,
  backup_type text, -- 'session_start', 'manual', 'daily'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Turn on Security
alter table user_backups enable row level security;

-- Allow users to save backups
create policy "Users can insert their own backups"
  on user_backups for insert
  with check (auth.uid() = user_id);

-- Allow users to see their backups
create policy "Users can view their own backups"
  on user_backups for select
  using (auth.uid() = user_id);
