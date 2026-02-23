-- Add pipeline subreddit filter preferences to outreach_configs
-- NULL = all selected (default). When set, it's a string[] of selected subreddit names.
ALTER TABLE outreach_configs
ADD COLUMN IF NOT EXISTS pipeline_subreddit_filters JSONB DEFAULT NULL;
