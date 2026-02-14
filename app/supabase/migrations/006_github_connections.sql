-- GitHub repository connections for project context
create table if not exists github_connections (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  repo_url text not null,
  owner text not null,
  repo_name text not null,
  description text,
  homepage text,
  language text,
  stars integer default 0,
  topics text[] default '{}',
  readme_summary text,
  recent_commits jsonb default '[]'::jsonb,
  access_token text,
  last_synced_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint github_connections_project_id_key unique (project_id)
);

-- RLS
alter table github_connections enable row level security;

create policy "Users can view their own github connections"
  on github_connections for select
  using (
    project_id in (
      select id from projects where user_id = auth.uid()
    )
  );

create policy "Users can insert their own github connections"
  on github_connections for insert
  with check (
    project_id in (
      select id from projects where user_id = auth.uid()
    )
  );

create policy "Users can update their own github connections"
  on github_connections for update
  using (
    project_id in (
      select id from projects where user_id = auth.uid()
    )
  );

create policy "Users can delete their own github connections"
  on github_connections for delete
  using (
    project_id in (
      select id from projects where user_id = auth.uid()
    )
  );
