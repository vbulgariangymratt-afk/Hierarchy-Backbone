-- ============================================================
-- WALLPAPER SYNC SCHEMA
-- Add this to your Supabase SQL editor after the existing schema
-- ============================================================

-- 4. Wallpaper Configs Table
-- One row per user. Stores the full wallpaperConfig JSON blob.
-- Data URLs are NOT stored here — images are in Storage and only
-- their public URLs appear in this config.
create table if not exists public.wallpaper_configs (
    user_id uuid references auth.users(id) on delete cascade primary key,
    config  jsonb not null default '{}'::jsonb,
    updated_at timestamptz default now()
);

-- Auto-update updated_at on upsert
create or replace function update_wallpaper_config_timestamp()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists trg_wallpaper_config_timestamp on public.wallpaper_configs;
create trigger trg_wallpaper_config_timestamp
    before update on public.wallpaper_configs
    for each row execute procedure update_wallpaper_config_timestamp();

-- RLS
alter table public.wallpaper_configs enable row level security;

create policy "Users can read their own wallpaper config"
    on public.wallpaper_configs for select
    using (auth.uid() = user_id);

create policy "Users can insert their own wallpaper config"
    on public.wallpaper_configs for insert
    with check (auth.uid() = user_id);

create policy "Users can update their own wallpaper config"
    on public.wallpaper_configs for update
    using (auth.uid() = user_id);

create policy "Users can delete their own wallpaper config"
    on public.wallpaper_configs for delete
    using (auth.uid() = user_id);


