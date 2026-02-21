ALTER TABLE outreach_configs
  ADD COLUMN IF NOT EXISTS time_filter TEXT DEFAULT 'week'
    CHECK (time_filter IN ('hour', 'day', 'week', 'month', 'year', 'all')),
  ADD COLUMN IF NOT EXISTS max_results INTEGER DEFAULT 100,
  ADD COLUMN IF NOT EXISTS include_comments BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS pain_points TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS customer_goals TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS target_activities TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS scan_wizard_completed BOOLEAN DEFAULT false;
