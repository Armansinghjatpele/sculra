-- ==============================================================================
-- Sculra CI/CD QA Gates, Automatic Triggers & Developer Feedback Loop Migration
-- Migration: 20260911000000_cicd_integration.sql
-- ==============================================================================

-- 1. Extend public.projects with CI/CD configuration fields
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS ci_enabled BOOLEAN DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS github_repo_owner TEXT,
  ADD COLUMN IF NOT EXISTS github_repo_name TEXT,
  ADD COLUMN IF NOT EXISTS ci_default_branch TEXT DEFAULT 'main',
  ADD COLUMN IF NOT EXISTS ci_trigger_on_push BOOLEAN DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS ci_trigger_on_pr BOOLEAN DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS ci_gate_policy TEXT DEFAULT 'BLOCK_ON_CRITICAL_ISSUE' NOT NULL,
  ADD COLUMN IF NOT EXISTS ci_webhook_secret TEXT;

-- Constraint on ci_gate_policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_projects_ci_gate_policy'
  ) THEN
    ALTER TABLE public.projects
      ADD CONSTRAINT check_projects_ci_gate_policy
      CHECK (ci_gate_policy IN ('BLOCK_ON_CRITICAL_ISSUE', 'STRICT', 'PERMISSIVE', 'BLOCK_ON_REGRESSION'));
  END IF;
END $$;

-- 2. Create public.cicd_webhook_events table
CREATE TABLE IF NOT EXISTS public.cicd_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id TEXT UNIQUE NOT NULL,
  provider TEXT NOT NULL DEFAULT 'github',
  event_type TEXT NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  repository TEXT NOT NULL,
  commit_sha TEXT,
  pull_request_number INTEGER,
  status TEXT NOT NULL CHECK (status IN (
    'RECEIVED',
    'PROCESSING',
    'SCHEDULED',
    'IGNORED',
    'FAILED',
    'COMPLETED'
  )),
  campaign_id UUID REFERENCES public.qa_campaigns(id) ON DELETE SET NULL,
  error_code TEXT,
  metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
  received_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  processed_at TIMESTAMPTZ
);

-- 3. Create public.cicd_gate_results table
CREATE TABLE IF NOT EXISTS public.cicd_gate_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.qa_campaigns(id) ON DELETE CASCADE,
  test_run_id UUID REFERENCES public.test_runs(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  commit_sha TEXT,
  pull_request_number INTEGER,
  branch TEXT,
  gate_verdict TEXT NOT NULL CHECK (gate_verdict IN (
    'PASS',
    'FAIL',
    'INSUFFICIENT_EVIDENCE',
    'ERROR',
    'CANCELLED'
  )),
  gate_policy TEXT NOT NULL,
  release_verdict TEXT,
  reason_codes TEXT[] DEFAULT ARRAY[]::TEXT[] NOT NULL,
  critical_findings_count INTEGER DEFAULT 0 NOT NULL,
  regression_count INTEGER DEFAULT 0 NOT NULL,
  evidence_status TEXT NOT NULL,
  summary_markdown TEXT,
  feedback_json JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 4. Optimization indexes for CI/CD events and gate results
CREATE INDEX IF NOT EXISTS idx_cicd_webhook_events_delivery
  ON public.cicd_webhook_events(delivery_id);

CREATE INDEX IF NOT EXISTS idx_cicd_webhook_events_project
  ON public.cicd_webhook_events(project_id, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_cicd_webhook_events_org
  ON public.cicd_webhook_events(organization_id);

CREATE INDEX IF NOT EXISTS idx_cicd_gate_results_project
  ON public.cicd_gate_results(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_cicd_gate_results_campaign
  ON public.cicd_gate_results(campaign_id);

CREATE INDEX IF NOT EXISTS idx_cicd_gate_results_org
  ON public.cicd_gate_results(organization_id);

CREATE INDEX IF NOT EXISTS idx_projects_github_repo
  ON public.projects(github_repo_owner, github_repo_name)
  WHERE github_repo_owner IS NOT NULL AND github_repo_name IS NOT NULL;

-- 5. Row Level Security Policies

-- Enable RLS
ALTER TABLE public.cicd_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cicd_gate_results ENABLE ROW LEVEL SECURITY;

-- Read policies: Org members or project owners
CREATE POLICY "CICD webhook events read by org members or owners" ON public.cicd_webhook_events
  FOR SELECT USING (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND project_id IN (
      SELECT id FROM public.projects WHERE created_by = (auth.jwt() ->> 'sub')
    ))
  );

CREATE POLICY "CICD gate results read by org members or owners" ON public.cicd_gate_results
  FOR SELECT USING (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND project_id IN (
      SELECT id FROM public.projects WHERE created_by = (auth.jwt() ->> 'sub')
    ))
  );

-- Service-role full access (for webhook receiver and background worker)
CREATE POLICY "Service role full access on cicd_webhook_events" ON public.cicd_webhook_events
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access on cicd_gate_results" ON public.cicd_gate_results
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
