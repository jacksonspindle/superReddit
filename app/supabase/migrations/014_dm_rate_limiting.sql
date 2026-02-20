-- Add first_touch_sent_at to track when a first-touch DM was sent (for rate limiting)
ALTER TABLE outreach_dms
  ADD COLUMN first_touch_sent_at timestamptz;

-- Backfill: for DMs already sent (touch_number >= 1), use dm_sent_at
UPDATE outreach_dms
  SET first_touch_sent_at = dm_sent_at
  WHERE touch_number >= 1 AND dm_sent_at IS NOT NULL;

-- Index for rate limit queries
CREATE INDEX idx_outreach_dms_first_touch
  ON outreach_dms (project_id, first_touch_sent_at DESC)
  WHERE first_touch_sent_at IS NOT NULL;
