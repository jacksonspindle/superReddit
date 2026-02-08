-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- Profiles (extends auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text,
  avatar_url text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.profiles enable row level security;

create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Projects
create table public.projects (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users on delete cascade not null,
  name text not null,
  product_name text not null default '',
  product_description text not null default '',
  product_url text,
  target_audience text,
  tone text not null default 'Professional',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.projects enable row level security;

create policy "Users can CRUD own projects" on public.projects
  for all using (auth.uid() = user_id);

-- Subreddits (tracked per project)
create table public.subreddits (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references public.projects on delete cascade not null,
  name text not null,
  subscribers integer,
  description text,
  created_at timestamptz default now() not null,
  unique(project_id, name)
);

alter table public.subreddits enable row level security;

create policy "Users can CRUD subreddits for own projects" on public.subreddits
  for all using (
    project_id in (select id from public.projects where user_id = auth.uid())
  );

-- Discovered Posts (fetched from Reddit)
create table public.discovered_posts (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references public.projects on delete cascade not null,
  subreddit_name text not null,
  reddit_id text not null,
  title text not null,
  body text,
  author text not null,
  score integer not null default 0,
  num_comments integer not null default 0,
  url text not null,
  permalink text not null,
  created_utc bigint not null,
  fetched_at timestamptz default now() not null
);

alter table public.discovered_posts enable row level security;

create policy "Users can CRUD discovered posts for own projects" on public.discovered_posts
  for all using (
    project_id in (select id from public.projects where user_id = auth.uid())
  );

-- Generated Posts (AI-generated content)
create table public.generated_posts (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references public.projects on delete cascade not null,
  title text not null,
  body text not null,
  tone text not null default 'Professional',
  strategy_note text,
  status text not null default 'draft' check (status in ('draft', 'edited', 'posted')),
  based_on_post_ids uuid[] default '{}',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.generated_posts enable row level security;

create policy "Users can CRUD generated posts for own projects" on public.generated_posts
  for all using (
    project_id in (select id from public.projects where user_id = auth.uid())
  );

-- Chat Messages
create table public.chat_messages (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references public.projects on delete cascade not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz default now() not null
);

alter table public.chat_messages enable row level security;

create policy "Users can CRUD chat messages for own projects" on public.chat_messages
  for all using (
    project_id in (select id from public.projects where user_id = auth.uid())
  );

-- Canvas States (persisted React Flow state)
create table public.canvas_states (
  id uuid default uuid_generate_v4() primary key,
  project_id uuid references public.projects on delete cascade not null unique,
  nodes jsonb not null default '[]',
  edges jsonb not null default '[]',
  viewport jsonb not null default '{"x": 0, "y": 0, "zoom": 1}',
  updated_at timestamptz default now() not null
);

alter table public.canvas_states enable row level security;

create policy "Users can CRUD canvas states for own projects" on public.canvas_states
  for all using (
    project_id in (select id from public.projects where user_id = auth.uid())
  );

-- Reddit Cache (service role only, no RLS)
create table public.reddit_cache (
  id uuid default uuid_generate_v4() primary key,
  cache_key text not null unique,
  data jsonb not null,
  created_at timestamptz default now() not null,
  expires_at timestamptz not null
);

-- Index for cache lookups
create index idx_reddit_cache_key on public.reddit_cache(cache_key);
create index idx_reddit_cache_expires on public.reddit_cache(expires_at);

-- Updated_at trigger function
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_projects_updated_at
  before update on public.projects
  for each row execute function public.update_updated_at();

create trigger update_generated_posts_updated_at
  before update on public.generated_posts
  for each row execute function public.update_updated_at();

create trigger update_canvas_states_updated_at
  before update on public.canvas_states
  for each row execute function public.update_updated_at();

create trigger update_profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at();
