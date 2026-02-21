-- Signal poll queue for background processing
CREATE TABLE IF NOT EXISTS signal_poll_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('high', 'normal')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  signals_found INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_poll_queue_status ON signal_poll_queue(status, priority DESC, created_at ASC);
CREATE INDEX idx_poll_queue_project ON signal_poll_queue(project_id, status);

-- Shared search cache
CREATE TABLE IF NOT EXISTS signal_search_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT NOT NULL UNIQUE,
  posts JSONB NOT NULL DEFAULT '[]',
  source TEXT NOT NULL DEFAULT 'reddit' CHECK (source IN ('reddit', 'pullpush')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_search_cache_key ON signal_search_cache(cache_key);
CREATE INDEX idx_search_cache_expires ON signal_search_cache(expires_at);

-- RLS
ALTER TABLE signal_poll_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE signal_search_cache ENABLE ROW LEVEL SECURITY;

-- Poll queue: users can see their own project's queue entries
CREATE POLICY "Users can view own poll queue"
  ON signal_poll_queue FOR SELECT
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own poll queue"
  ON signal_poll_queue FOR INSERT
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

-- Cache: readable by all authenticated users (shared resource)
CREATE POLICY "Authenticated users can read cache"
  ON signal_search_cache FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can write cache"
  ON signal_search_cache FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update cache"
  ON signal_search_cache FOR UPDATE
  USING (auth.role() = 'authenticated');
