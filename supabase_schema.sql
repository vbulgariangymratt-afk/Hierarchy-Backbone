-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Nodes Table (Central hierarchy for Life Areas, Skills, Tasks, etc.)
create table if not exists public.nodes (
    id text primary key, -- Using text to support existing custom IDs during migration
    user_id uuid references auth.users(id) on delete cascade not null,
    name text not null,
    type text not null,
    parent_id text references public.nodes(id) on delete cascade,
    metadata jsonb default '{}'::jsonb,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

-- Index for parent searches
create index if not exists idx_nodes_parent_id on public.nodes(parent_id);
create index if not exists idx_nodes_user_id on public.nodes(user_id);

-- 2. Journal Entries Table
create table if not exists public.journal_entries (
    id text primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    date date not null,
    biological jsonb default '{}'::jsonb,
    activation jsonb default '{}'::jsonb,
    regulation jsonb default '{}'::jsonb,
    notes text default '',
    metadata jsonb default '{}'::jsonb,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

create index if not exists idx_journal_user_id on public.journal_entries(user_id);
create index if not exists idx_journal_date on public.journal_entries(date);

-- 3. Habits Table
create table if not exists public.habits (
    id text primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    type text default 'HABIT',
    if_trigger text,
    metadata jsonb default '{}'::jsonb, -- Stores phases, completions, evolutionConfig, etc.
    is_active boolean default true,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

create index if not exists idx_habits_user_id on public.habits(user_id);

-- RLS (Row Level Security) - Basic Setup
alter table public.nodes enable row level security;
alter table public.journal_entries enable row level security;
alter table public.habits enable row level security;

-- Policies
create policy "Users can only view their own nodes" on public.nodes
    for select using (auth.uid() = user_id);
create policy "Users can only insert their own nodes" on public.nodes
    for insert with check (auth.uid() = user_id);
create policy "Users can only update their own nodes" on public.nodes
    for update using (auth.uid() = user_id);
create policy "Users can only delete their own nodes" on public.nodes
    for delete using (auth.uid() = user_id);

-- (Repeat for journal_entries and habits)
create policy "Users can manage their own journal entries" on public.journal_entries
    for all using (auth.uid() = user_id);

create policy "Users can manage their own habits" on public.habits
    for all using (auth.uid() = user_id);
