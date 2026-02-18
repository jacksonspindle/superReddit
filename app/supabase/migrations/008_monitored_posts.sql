-- ============================================================
-- 008_monitored_posts.sql — Persisted user Reddit posts for DM pipeline
-- ============================================================

create table if not exists monitored_posts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  reddit_id text not null,
  title text not null,
  selftext text,
  subreddit text not null,
  author text not null,
  score integer default 0,
  num_comments integer default 0,
  permalink text not null,
  url text,
  created_utc bigint not null,
  is_self boolean default true,
  thumbnail text,
  link_flair_text text,
  synced_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint monitored_posts_project_reddit unique (project_id, reddit_id)
);

alter table monitored_posts enable row level security;

create policy "Users can manage their own monitored posts"
  on monitored_posts for all
  using (project_id in (select id from projects where user_id = auth.uid()))
  with check (project_id in (select id from projects where user_id = auth.uid()));

-- Indexes
create index if not exists idx_monitored_posts_project_created on monitored_posts(project_id, created_utc desc);
create index if not exists idx_monitored_posts_project_permalink on monitored_posts(project_id, permalink);

-- updated_at trigger (reuses existing function from 005_outreach.sql)
create trigger monitored_posts_updated_at
  before update on monitored_posts
  for each row execute function update_updated_at();
