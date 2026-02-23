-- Add urgency and match_reason columns to outreach_signals
ALTER TABLE outreach_signals ADD COLUMN IF NOT EXISTS urgency TEXT DEFAULT 'none';
ALTER TABLE outreach_signals ADD COLUMN IF NOT EXISTS match_reason TEXT;
