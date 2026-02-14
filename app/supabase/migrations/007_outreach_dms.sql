-- ============================================================
-- 007_outreach_dms.sql — DM workflow manager table + RLS
-- ============================================================

create table if not exists outreach_dms (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  reddit_username text not null,
  comment_text text,
  comment_permalink text,
  source_thread_permalink text not null,
  source_signal_id uuid references outreach_signals(id) on delete set null,
  permission_type text not null default 'passive_commenter',
  permission_score real default 0.3,
  matched_pattern text,
  pipeline_stage text not null default 'detected',
  dm_subject text,
  dm_body text,
  dm_template_id text,
  dm_sent_at timestamptz,
  follow_up_due timestamptz,
  touch_number integer default 0,
  outcome text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint outreach_dms_unique_lead unique (project_id, reddit_username, source_thread_permalink)
);

alter table outreach_dms enable row level security;

create policy "Users can manage their own outreach DMs"
  on outreach_dms for all
  using (project_id in (select id from projects where user_id = auth.uid()))
  with check (project_id in (select id from projects where user_id = auth.uid()));

-- Indexes
create index if not exists idx_outreach_dms_project_stage on outreach_dms(project_id, pipeline_stage);
create index if not exists idx_outreach_dms_follow_up on outreach_dms(follow_up_due) where follow_up_due is not null;
create index if not exists idx_outreach_dms_created on outreach_dms(project_id, created_at desc);

-- updated_at trigger
create trigger outreach_dms_updated_at
  before update on outreach_dms
  for each row execute function update_updated_at();
