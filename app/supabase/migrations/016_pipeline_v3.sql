-- Pipeline V3: Add 4-dimension scoring, buyer intent, and discovery source tracking
-- All columns nullable for backward compatibility with existing signals

ALTER TABLE outreach_signals
  ADD COLUMN IF NOT EXISTS authenticity_score REAL,
  ADD COLUMN IF NOT EXISTS relevance_score REAL,
  ADD COLUMN IF NOT EXISTS buyer_intent TEXT,
  ADD COLUMN IF NOT EXISTS discovery_source TEXT DEFAULT 'keyword_search',
  ADD COLUMN IF NOT EXISTS pipeline_version INTEGER DEFAULT 2;

-- Indexes for filtering by buyer intent and pipeline version
CREATE INDEX IF NOT EXISTS idx_outreach_signals_buyer_intent
  ON outreach_signals (buyer_intent)
  WHERE buyer_intent IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_outreach_signals_pipeline_version
  ON outreach_signals (pipeline_version);
