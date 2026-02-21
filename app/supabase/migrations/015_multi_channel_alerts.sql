-- Multi-channel alert system: Slack, Email, Telegram support
-- plus unified alert_deliveries table

-- alert_deliveries table (normalized, replaces per-channel columns)
CREATE TABLE IF NOT EXISTS alert_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id UUID NOT NULL REFERENCES outreach_signals(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('discord', 'slack', 'email', 'telegram')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (signal_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_alert_deliveries_project ON alert_deliveries(project_id);
CREATE INDEX IF NOT EXISTS idx_alert_deliveries_status ON alert_deliveries(project_id, status);
CREATE INDEX IF NOT EXISTS idx_alert_deliveries_channel ON alert_deliveries(project_id, channel);

ALTER TABLE alert_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own alert deliveries"
  ON alert_deliveries FOR SELECT
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own alert deliveries"
  ON alert_deliveries FOR INSERT
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own alert deliveries"
  ON alert_deliveries FOR UPDATE
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

-- Slack columns on outreach_configs
ALTER TABLE outreach_configs
  ADD COLUMN IF NOT EXISTS slack_team_id TEXT,
  ADD COLUMN IF NOT EXISTS slack_team_name TEXT,
  ADD COLUMN IF NOT EXISTS slack_channel_id TEXT,
  ADD COLUMN IF NOT EXISTS slack_channel_name TEXT,
  ADD COLUMN IF NOT EXISTS slack_webhook_url TEXT,
  ADD COLUMN IF NOT EXISTS slack_access_token TEXT,
  ADD COLUMN IF NOT EXISTS slack_connected BOOLEAN DEFAULT false;

-- Email columns on outreach_configs
ALTER TABLE outreach_configs
  ADD COLUMN IF NOT EXISTS email_address TEXT,
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_connected BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_realtime_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_digest_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_digest_frequency TEXT DEFAULT 'daily'
    CHECK (email_digest_frequency IS NULL OR email_digest_frequency IN ('daily', 'weekly')),
  ADD COLUMN IF NOT EXISTS email_last_digest_at TIMESTAMPTZ;

-- Telegram columns on outreach_configs
ALTER TABLE outreach_configs
  ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT,
  ADD COLUMN IF NOT EXISTS telegram_username TEXT,
  ADD COLUMN IF NOT EXISTS telegram_connected BOOLEAN DEFAULT false;

-- Pending Telegram connections (ephemeral, for deep-link flow)
CREATE TABLE IF NOT EXISTS pending_telegram_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pending_telegram_token ON pending_telegram_connections(token);

ALTER TABLE pending_telegram_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own telegram connections"
  ON pending_telegram_connections FOR ALL
  USING (user_id = auth.uid());
