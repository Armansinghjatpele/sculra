-- ==============================================================================
-- Sculra AI Release Readiness Engine Schema Extension (20260907000004_release_readiness.sql)
-- ==============================================================================

-- 1. Extend release_scores with structured metrics, blockers, AI analysis and versioning
ALTER TABLE public.release_scores
  ADD COLUMN IF NOT EXISTS recommendation text NOT NULL DEFAULT 'DO_NOT_RELEASE',
  ADD COLUMN IF NOT EXISTS risk_level text NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN IF NOT EXISTS confidence_level text NOT NULL DEFAULT 'LOW',
  ADD COLUMN IF NOT EXISTS scoring_version text NOT NULL DEFAULT '1.0',
  ADD COLUMN IF NOT EXISTS blockers_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reliability_score integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS coverage_score integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS breakdown jsonb,
  ADD COLUMN IF NOT EXISTS blockers jsonb,
  ADD COLUMN IF NOT EXISTS ai_analysis jsonb,
  ADD COLUMN IF NOT EXISTS metadata jsonb;

-- 2. Indices for fast lookup of project release history and test run scores
CREATE INDEX IF NOT EXISTS idx_release_scores_proj_created ON public.release_scores(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_release_scores_rec ON public.release_scores(recommendation);
CREATE INDEX IF NOT EXISTS idx_release_scores_version ON public.release_scores(scoring_version);
