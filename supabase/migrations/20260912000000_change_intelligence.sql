-- ==============================================================================
-- Sculra Code Change Intelligence, Impact Analysis & Change-Aware QA Migration
-- Migration: 20260912000000_change_intelligence.sql
-- ==============================================================================

-- 1. Create public.change_analyses table
CREATE TABLE IF NOT EXISTS public.change_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  campaign_id UUID REFERENCES public.qa_campaigns(id) ON DELETE CASCADE,
  commit_sha TEXT NOT NULL,
  base_sha TEXT,
  branch TEXT,
  pull_request_number INTEGER,
  change_count INTEGER DEFAULT 0 NOT NULL,
  additions_count INTEGER DEFAULT 0 NOT NULL,
  deletions_count INTEGER DEFAULT 0 NOT NULL,
  risk_score INTEGER CHECK (risk_score >= 0 AND risk_score <= 100),
  risk_level TEXT CHECK (risk_level IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
  analysis_status TEXT NOT NULL CHECK (analysis_status IN (
    'QUEUED',
    'RUNNING',
    'COMPLETED',
    'PARTIAL',
    'FAILED',
    'NOT_AVAILABLE'
  )),
  classifications TEXT[] DEFAULT ARRAY[]::TEXT[] NOT NULL,
  summary JSONB DEFAULT '{}'::jsonb NOT NULL,
  impact_graph JSONB DEFAULT '{}'::jsonb NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. Optimization indexes for change_analyses
CREATE INDEX IF NOT EXISTS idx_change_analyses_project
  ON public.change_analyses(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_change_analyses_campaign
  ON public.change_analyses(campaign_id);

CREATE INDEX IF NOT EXISTS idx_change_analyses_commit
  ON public.change_analyses(commit_sha);

CREATE INDEX IF NOT EXISTS idx_change_analyses_org
  ON public.change_analyses(organization_id);

-- 3. Enable Row Level Security
ALTER TABLE public.change_analyses ENABLE ROW LEVEL SECURITY;

-- Read policy: Org members or project owners
CREATE POLICY "Change analyses read by org members or owners" ON public.change_analyses
  FOR SELECT USING (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND project_id IN (
      SELECT id FROM public.projects WHERE created_by = (auth.jwt() ->> 'sub')
    ))
  );

-- Service-role full access (for background workers and webhook processors)
CREATE POLICY "Service role full access on change_analyses" ON public.change_analyses
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
