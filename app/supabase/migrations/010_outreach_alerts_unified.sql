-- Migration: Outreach Alerts Unified Schema
-- Adds Discord integration columns, keyword/subreddit monitoring tables,
-- content dedup cache, competitor mentions, and enhanced signal columns.

-- ============================================================
-- 1. Extend outreach_configs with Discord columns
-- ============================================================
ALTER TABLE outreach_configs
  ADD COLUMN IF NOT EXISTS discord_guild_id TEXT,
  ADD COLUMN IF NOT EXISTS discord_guild_name TEXT,
  ADD COLUMN IF NOT EXISTS discord_channel_id TEXT,
  ADD COLUMN IF NOT EXISTS discord_webhook_url TEXT,
  ADD COLUMN IF NOT EXISTS discord_connected BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS poll_interval_minutes INTEGER DEFAULT 5;

-- ============================================================
-- 2. Extend outreach_signals with enhanced classification columns
-- ============================================================
ALTER TABLE outreach_signals
  ADD COLUMN IF NOT EXISTS signal_types TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS pain_severity TEXT,
  ADD COLUMN IF NOT EXISTS decision_maker BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_comment BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS parent_post_id TEXT,
  ADD COLUMN IF NOT EXISTS discord_alert_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS discord_alert_sent_at TIMESTAMPTZ;

-- Add check constraint for pain_severity
ALTER TABLE outreach_signals
  ADD CONSTRAINT outreach_signals_pain_severity_check
  CHECK (pain_severity IS NULL OR pain_severity IN ('low', 'medium', 'high'));

-- Add check constraint for discord_alert_status
ALTER TABLE outreach_signals
  ADD CONSTRAINT outreach_signals_discord_alert_status_check
  CHECK (discord_alert_status IS NULL OR discord_alert_status IN ('pending', 'sent', 'failed'));

-- ============================================================
-- 3. outreach_keywords — per-project keyword phrase groups
-- ============================================================
CREATE TABLE IF NOT EXISTS outreach_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  phrases TEXT[] NOT NULL DEFAULT '{}',
  exclusions TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  source TEXT DEFAULT 'manual',
  silenced_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outreach_keywords_project
  ON outreach_keywords(project_id);

ALTER TABLE outreach_keywords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own project keywords"
  ON outreach_keywords FOR ALL
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- ============================================================
-- 4. outreach_monitored_subs — subreddits to poll per project
-- ============================================================
CREATE TABLE IF NOT EXISTS outreach_monitored_subs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  safety_level TEXT DEFAULT 'caution',
  last_polled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (project_id, name)
);

CREATE INDEX IF NOT EXISTS idx_outreach_monitored_subs_project
  ON outreach_monitored_subs(project_id);

ALTER TABLE outreach_monitored_subs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own project monitored subs"
  ON outreach_monitored_subs FOR ALL
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- Add check constraint for safety_level
ALTER TABLE outreach_monitored_subs
  ADD CONSTRAINT outreach_monitored_subs_safety_level_check
  CHECK (safety_level IN ('safe', 'caution', 'strict'));

-- ============================================================
-- 5. outreach_content_cache — dedup via content hash
-- ============================================================
CREATE TABLE IF NOT EXISTS outreach_content_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_hash TEXT NOT NULL UNIQUE,
  reddit_url TEXT,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outreach_content_cache_hash
  ON outreach_content_cache(content_hash);

CREATE INDEX IF NOT EXISTS idx_outreach_content_cache_project
  ON outreach_content_cache(project_id);

-- Open policy: bot uses service role key
ALTER TABLE outreach_content_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage content cache"
  ON outreach_content_cache FOR ALL
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 6. competitor_mentions — extracted from signals
-- ============================================================
CREATE TABLE IF NOT EXISTS competitor_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  signal_id UUID REFERENCES outreach_signals(id) ON DELETE CASCADE,
  competitor_name TEXT NOT NULL,
  mention_context TEXT,
  sentiment TEXT DEFAULT 'neutral',
  switching_intent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_competitor_mentions_project
  ON competitor_mentions(project_id);

CREATE INDEX IF NOT EXISTS idx_competitor_mentions_signal
  ON competitor_mentions(signal_id);

CREATE INDEX IF NOT EXISTS idx_competitor_mentions_competitor
  ON competitor_mentions(project_id, competitor_name);

ALTER TABLE competitor_mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own project competitor mentions"
  ON competitor_mentions FOR ALL
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- Add check constraint for sentiment
ALTER TABLE competitor_mentions
  ADD CONSTRAINT competitor_mentions_sentiment_check
  CHECK (sentiment IN ('positive', 'neutral', 'negative'));

-- ============================================================
-- 7. Additional indexes on outreach_signals for new columns
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_outreach_signals_discord_status
  ON outreach_signals(discord_alert_status)
  WHERE discord_alert_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_outreach_signals_signal_types
  ON outreach_signals USING gin(signal_types);
