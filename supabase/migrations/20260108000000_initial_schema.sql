-- Track Speed Database Schema
-- Initial migration: profiles, athletes, sessions, results, splits

-- ============================================
-- Profiles (extends auth.users)
-- ============================================
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  full_name text,
  avatar_url text,
  -- Preferences
  preferred_units text default 'metric' check (preferred_units in ('metric', 'imperial')),
  preferred_velocity_unit text default 'm/s' check (preferred_velocity_unit in ('m/s', 'km/h', 'mph')),
  -- Metadata
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Enable RLS
alter table public.profiles enable row level security;

-- Policies: users can only access their own profile
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================
-- Athletes
-- ============================================
create table public.athletes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  team text,
  birth_year integer,
  gender text check (gender in ('male', 'female', 'other')),
  notes text,
  -- Personal bests stored as JSONB: { "100": 10.52, "200": 21.34 }
  personal_bests jsonb default '{}'::jsonb,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Enable RLS
alter table public.athletes enable row level security;

-- Policies: users can only access their own athletes
create policy "Users can view own athletes"
  on public.athletes for select
  using (auth.uid() = user_id);

create policy "Users can insert own athletes"
  on public.athletes for insert
  with check (auth.uid() = user_id);

create policy "Users can update own athletes"
  on public.athletes for update
  using (auth.uid() = user_id);

create policy "Users can delete own athletes"
  on public.athletes for delete
  using (auth.uid() = user_id);

-- Index for faster lookups
create index athletes_user_id_idx on public.athletes(user_id);

-- ============================================
-- Sessions
-- ============================================
create table public.sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  date date default current_date not null,
  location text,
  -- Session configuration
  session_type text not null check (session_type in ('flying', 'standing', 'block_start', 'series')),
  start_method text not null check (start_method in ('sound', 'thumb', 'gate', 'touch', 'ready_set_go')),
  -- Distance configuration (stored as JSONB for flexibility)
  config jsonb default '{}'::jsonb,
  -- Weather conditions (optional)
  weather jsonb,
  notes text,
  -- Metadata
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Enable RLS
alter table public.sessions enable row level security;

-- Policies
create policy "Users can view own sessions"
  on public.sessions for select
  using (auth.uid() = user_id);

create policy "Users can insert own sessions"
  on public.sessions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own sessions"
  on public.sessions for update
  using (auth.uid() = user_id);

create policy "Users can delete own sessions"
  on public.sessions for delete
  using (auth.uid() = user_id);

-- Indexes
create index sessions_user_id_idx on public.sessions(user_id);
create index sessions_date_idx on public.sessions(date desc);

-- ============================================
-- Results (timing results)
-- ============================================
create table public.results (
  id uuid default gen_random_uuid() primary key,
  session_id uuid references public.sessions(id) on delete cascade not null,
  athlete_id uuid references public.athletes(id) on delete set null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  -- Timing data
  time_ms integer not null, -- Time in milliseconds
  distance_m numeric(6,2), -- Distance in meters
  velocity_ms numeric(5,3), -- Max velocity in m/s
  -- Detection metadata
  source text not null check (source in ('auto_detected', 'manual_override', 'manual_only')),
  confidence numeric(3,2), -- 0.00 to 1.00
  frame_number integer,
  video_frame_rate integer,
  -- Photos
  finish_photo_url text,
  -- Run configuration snapshot
  run_config jsonb,
  -- Metadata
  created_at timestamptz default now() not null
);

-- Enable RLS
alter table public.results enable row level security;

-- Policies
create policy "Users can view own results"
  on public.results for select
  using (auth.uid() = user_id);

create policy "Users can insert own results"
  on public.results for insert
  with check (auth.uid() = user_id);

create policy "Users can update own results"
  on public.results for update
  using (auth.uid() = user_id);

create policy "Users can delete own results"
  on public.results for delete
  using (auth.uid() = user_id);

-- Indexes
create index results_session_id_idx on public.results(session_id);
create index results_athlete_id_idx on public.results(athlete_id);
create index results_user_id_idx on public.results(user_id);
create index results_created_at_idx on public.results(created_at desc);

-- ============================================
-- Splits (split times within a result)
-- ============================================
create table public.splits (
  id uuid default gen_random_uuid() primary key,
  result_id uuid references public.results(id) on delete cascade not null,
  distance_m numeric(6,2) not null,
  time_ms integer not null,
  velocity_ms numeric(5,3),
  photo_url text,
  created_at timestamptz default now() not null
);

-- Enable RLS
alter table public.splits enable row level security;

-- Policies (inherit from results via result_id -> session_id -> user_id)
create policy "Users can view own splits"
  on public.splits for select
  using (
    exists (
      select 1 from public.results r
      where r.id = splits.result_id
      and r.user_id = auth.uid()
    )
  );

create policy "Users can insert own splits"
  on public.splits for insert
  with check (
    exists (
      select 1 from public.results r
      where r.id = result_id
      and r.user_id = auth.uid()
    )
  );

create policy "Users can delete own splits"
  on public.splits for delete
  using (
    exists (
      select 1 from public.results r
      where r.id = splits.result_id
      and r.user_id = auth.uid()
    )
  );

-- Index
create index splits_result_id_idx on public.splits(result_id);

-- ============================================
-- Updated_at trigger function
-- ============================================
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Apply to tables with updated_at
create trigger update_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.update_updated_at_column();

create trigger update_athletes_updated_at
  before update on public.athletes
  for each row execute procedure public.update_updated_at_column();

create trigger update_sessions_updated_at
  before update on public.sessions
  for each row execute procedure public.update_updated_at_column();

-- ============================================
-- Useful views
-- ============================================

-- View: Results with athlete name and session info
create view public.results_with_details as
select
  r.id,
  r.session_id,
  r.athlete_id,
  r.user_id,
  r.time_ms,
  r.distance_m,
  r.velocity_ms,
  r.source,
  r.confidence,
  r.created_at,
  a.name as athlete_name,
  s.name as session_name,
  s.session_type,
  s.date as session_date
from public.results r
left join public.athletes a on r.athlete_id = a.id
left join public.sessions s on r.session_id = s.id;

-- Grant access to authenticated users
grant select on public.results_with_details to authenticated;
