-- AI Wardrobe database + private photo storage.
-- Paste this whole file into Supabase -> SQL Editor -> New query -> Run. Safe to run again.

create table if not exists public.photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  path text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  path text not null,
  name text not null default '',
  category text not null default 'top',
  brand text not null default '',
  price text not null default '',
  url text not null default '',
  source text not null default '',
  notes text not null default '',
  status text not null default 'wishlist',
  created_at timestamptz not null default now()
);

create table if not exists public.outfits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null default 'New outfit',
  item_ids uuid[] not null default '{}',
  tryon_id uuid,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.tryons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  photo_id uuid,
  item_ids uuid[] not null default '{}',
  outfit_id uuid,
  provider text not null default '',
  status text not null default 'running',
  path text,
  error text,
  created_at timestamptz not null default now()
);

-- Row level security: every row is visible only to the person who created it.
do $$
declare t text;
begin
  foreach t in array array['photos', 'items', 'outfits', 'tryons'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- Private storage bucket. Files live under <user id>/..., and only that user can touch them.
insert into storage.buckets (id, name, public)
values ('wardrobe', 'wardrobe', false)
on conflict (id) do update set public = false;

drop policy if exists "wardrobe own files" on storage.objects;
create policy "wardrobe own files" on storage.objects for all to authenticated
  using (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'wardrobe' and (storage.foldername(name))[1] = auth.uid()::text);

-- Premium fields (photo angles, colours, sizes, favourites, tags) and the profile table.
alter table public.photos add column if not exists angle text not null default 'full';
alter table public.items add column if not exists colour text not null default '';
alter table public.items add column if not exists size text not null default '';
alter table public.items add column if not exists favourite boolean not null default false;
alter table public.outfits add column if not exists tags text[] not null default '{}';
alter table public.outfits add column if not exists favourite boolean not null default false;
alter table public.tryons add column if not exists favourite boolean not null default false;

create table if not exists public.profiles (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  display_name text not null default '',
  city text not null default '',
  budget text not null default '',
  sizes jsonb not null default '{}',
  measurements jsonb not null default '{}',
  styles text[] not null default '{}',
  brands text[] not null default '{}',
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
