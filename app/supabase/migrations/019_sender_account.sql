-- Add sender_account column to track which Reddit account synced each DM.
-- Nullable: old DMs get NULL (hidden until backfilled or re-synced).
-- New DMs get stamped with the Reddit account that synced them.
ALTER TABLE outreach_dms ADD COLUMN IF NOT EXISTS sender_account TEXT;
