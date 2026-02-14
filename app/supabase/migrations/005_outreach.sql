-- ============================================================
-- 005_outreach.sql — Outreach feature tables + RLS
-- ============================================================

-- 1. outreach_configs: one per project
create table if not exists outreach_configs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  reddit_username text,
  keywords jsonb default '[]'::jsonb,
  competitors jsonb default '[]'::jsonb,
  webhook_url text,
  webhook_type text,
  subreddit_limit integer default 20,
  polling_enabled boolean default true,
  setup_completed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint outreach_configs_project_id_key unique (project_id)
);

alter table outreach_configs enable row level security;

create policy "Users can manage their own outreach configs"
  on outreach_configs for all
  using (project_id in (select id from projects where user_id = auth.uid()))
  with check (project_id in (select id from projects where user_id = auth.uid()));

-- 2. outreach_signals: detected leads
create table if not exists outreach_signals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  reddit_id text not null,
  subreddit text not null,
  title text not null,
  body text,
  author text not null,
  score integer default 0,
  num_comments integer default 0,
  permalink text not null,
  created_utc bigint not null,
  intent_type text,
  intent_score real default 0,
  combined_score real default 0,
  matched_keywords text[] default '{}',
  competitor_mentioned boolean default false,
  status text default 'new',
  fetched_at timestamptz default now(),
  constraint outreach_signals_project_reddit unique (project_id, reddit_id)
);

alter table outreach_signals enable row level security;

create policy "Users can manage their own outreach signals"
  on outreach_signals for all
  using (project_id in (select id from projects where user_id = auth.uid()))
  with check (project_id in (select id from projects where user_id = auth.uid()));

-- 3. outreach_replies: reply drafts + tracking
create table if not exists outreach_replies (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  signal_id uuid references outreach_signals(id) on delete set null,
  thread_permalink text,
  draft_text text,
  reply_mode text,
  reddit_comment_id text,
  posted_at timestamptz,
  current_score integer,
  reply_count integer default 0,
  op_replied boolean default false,
  last_checked_at timestamptz,
  status text default 'draft',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table outreach_replies enable row level security;

create policy "Users can manage their own outreach replies"
  on outreach_replies for all
  using (project_id in (select id from projects where user_id = auth.uid()))
  with check (project_id in (select id from projects where user_id = auth.uid()));

-- 4. subreddit_rules: cached compliance profiles (shared, no RLS)
create table if not exists subreddit_rules (
  id uuid primary key default gen_random_uuid(),
  subreddit text not null,
  rules_json jsonb default '[]'::jsonb,
  compliance_profile jsonb default '{}'::jsonb,
  safety_score real,
  analyzed_at timestamptz default now(),
  constraint subreddit_rules_subreddit_key unique (subreddit)
);

-- No RLS for subreddit_rules — shared data accessed via service role

-- Indexes
create index if not exists idx_outreach_signals_project_status on outreach_signals(project_id, status);
create index if not exists idx_outreach_signals_combined_score on outreach_signals(project_id, combined_score desc);
create index if not exists idx_outreach_replies_project_status on outreach_replies(project_id, status);

-- updated_at triggers
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger outreach_configs_updated_at
  before update on outreach_configs
  for each row execute function update_updated_at();

create trigger outreach_replies_updated_at
  before update on outreach_replies
  for each row execute function update_updated_at();
