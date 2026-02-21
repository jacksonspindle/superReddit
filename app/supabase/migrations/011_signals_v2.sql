-- New scoring columns on outreach_signals
ALTER TABLE outreach_signals
  ADD COLUMN IF NOT EXISTS fit_score REAL,
  ADD COLUMN IF NOT EXISTS lead_score REAL,
  ADD COLUMN IF NOT EXISTS engage_score REAL,
  ADD COLUMN IF NOT EXISTS lead_tier TEXT,
  ADD COLUMN IF NOT EXISTS is_unseen BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_favorited BOOLEAN DEFAULT false;

ALTER TABLE outreach_signals
  ADD CONSTRAINT outreach_signals_lead_tier_check
  CHECK (lead_tier IS NULL OR lead_tier IN ('hot', 'warm', 'cold'));

CREATE INDEX IF NOT EXISTS idx_signals_lead_tier ON outreach_signals(project_id, lead_tier);
CREATE INDEX IF NOT EXISTS idx_signals_unseen ON outreach_signals(project_id, is_unseen) WHERE is_unseen = true;
CREATE INDEX IF NOT EXISTS idx_signals_favorited ON outreach_signals(project_id, is_favorited) WHERE is_favorited = true;

-- Product context table (AI-generated vocabulary, patterns, embeddings)
CREATE TABLE IF NOT EXISTS outreach_product_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  problems_solved JSONB DEFAULT '[]',
  solution_features JSONB DEFAULT '[]',
  audience_behaviors JSONB DEFAULT '[]',
  competitor_weaknesses JSONB DEFAULT '[]',
  vocabulary TEXT[] DEFAULT '{}',
  audience_patterns TEXT[] DEFAULT '{}',
  problem_embeddings JSONB DEFAULT '[]',
  audience_embeddings JSONB DEFAULT '[]',
  generated_at TIMESTAMPTZ,
  generated_from_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT outreach_product_context_project_key UNIQUE (project_id)
);

ALTER TABLE outreach_product_context ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own product context"
  ON outreach_product_context FOR ALL
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()))
  WITH CHECK (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));
