-- ==============================================================================
-- Sculra AI Root Cause Analysis, Code-Aware Bug Diagnosis & Fix Planning Migration
-- Migration: 20260913000000_issue_remediation.sql
-- ==============================================================================

-- 1. Create public.issue_remediation_analyses table
CREATE TABLE IF NOT EXISTS public.issue_remediation_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  issue_id UUID REFERENCES public.issues(id) ON DELETE CASCADE NOT NULL,
  campaign_id UUID REFERENCES public.qa_campaigns(id) ON DELETE SET NULL,
  test_run_id UUID REFERENCES public.test_runs(id) ON DELETE SET NULL,
  fingerprint TEXT NOT NULL,
  analysis_version INTEGER DEFAULT 1 NOT NULL,
  status TEXT NOT NULL CHECK (status IN (
    'NOT_ANALYZED',
    'ANALYZING',
    'DIAGNOSED',
    'PARTIAL',
    'INSUFFICIENT_EVIDENCE',
    'FAILED'
  )),
  confidence TEXT NOT NULL CHECK (confidence IN (
    'VERY_LOW',
    'LOW',
    'MEDIUM',
    'HIGH',
    'VERY_HIGH'
  )),
  diagnosis JSONB NOT NULL DEFAULT '{}'::jsonb,
  hypotheses JSONB NOT NULL DEFAULT '[]'::jsonb,
  fix_plan JSONB NOT NULL DEFAULT '{}'::jsonb,
  verification_plan JSONB NOT NULL DEFAULT '{}'::jsonb,
  code_context_summary JSONB DEFAULT '{}'::jsonb,
  change_context_summary JSONB DEFAULT '{}'::jsonb,
  historical_context_summary JSONB DEFAULT '{}'::jsonb,
  telemetry JSONB DEFAULT '{}'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. Optimization indexes for issue_remediation_analyses
CREATE INDEX IF NOT EXISTS idx_remediation_analyses_issue
  ON public.issue_remediation_analyses(issue_id);

CREATE INDEX IF NOT EXISTS idx_remediation_analyses_project
  ON public.issue_remediation_analyses(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_remediation_analyses_campaign
  ON public.issue_remediation_analyses(campaign_id);

CREATE INDEX IF NOT EXISTS idx_remediation_analyses_fingerprint
  ON public.issue_remediation_analyses(fingerprint);

CREATE INDEX IF NOT EXISTS idx_remediation_analyses_org
  ON public.issue_remediation_analyses(organization_id);

-- 3. Enable Row Level Security
ALTER TABLE public.issue_remediation_analyses ENABLE ROW LEVEL SECURITY;

-- Read policy: Org members or project owners
CREATE POLICY "Remediation analyses read by org members or owners" ON public.issue_remediation_analyses
  FOR SELECT USING (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND project_id IN (
      SELECT id FROM public.projects WHERE created_by = (auth.jwt() ->> 'sub')
    ))
  );

-- Insert policy: Org members or project owners
CREATE POLICY "Remediation analyses insert by org members or owners" ON public.issue_remediation_analyses
  FOR INSERT WITH CHECK (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND project_id IN (
      SELECT id FROM public.projects WHERE created_by = (auth.jwt() ->> 'sub')
    ))
  );

-- Update policy: Org members or project owners
CREATE POLICY "Remediation analyses update by org members or owners" ON public.issue_remediation_analyses
  FOR UPDATE USING (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND project_id IN (
      SELECT id FROM public.projects WHERE created_by = (auth.jwt() ->> 'sub')
    ))
  );

-- Service role full access
CREATE POLICY "Remediation analyses service role full access" ON public.issue_remediation_analyses
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- 4. Update test_evidence type check constraint to include remediation evidence types
ALTER TABLE public.test_evidence DROP CONSTRAINT IF EXISTS test_evidence_type_check;

ALTER TABLE public.test_evidence ADD CONSTRAINT test_evidence_type_check 
  CHECK (type IN (
    'screenshot',
    'console_error',
    'network_error',
    'dom_snapshot',
    'navigation',
    'application_map',
    'discovered_page',
    'responsive_capture',
    'journey_result',
    'journey_step',
    'action_trace',
    'observation',
    'visual_comparison',
    'responsive_observation',
    'ai_qa_plan',
    'ai_qa_result',
    'ai_qa_state_summary',
    'ai_qa_stop',
    'strategy_decision',
    'product_model',
    'product_workflow',
    'authenticated_session',
    'role_context',
    'authorization_check',
    'unauthorized_access',
    'role_difference',
    'api_endpoint',
    'api_response',
    'api_coverage_summary',
    'api_failure',
    'api_contract',
    'security_summary',
    'security_finding',
    'security_header_check',
    'security_cookie_check',
    'security_cors_check',
    'security_redirect_check',
    'security_exposure_check',
    'security_auth_check',
    'performance_summary',
    'performance_finding',
    'performance_budget_check',
    'performance_metric',
    'performance_reliability_finding',
    'performance_regression',
    'accessibility_summary',
    'accessibility_finding',
    'accessibility_violation',
    'accessibility_contrast_check',
    'accessibility_tree_snapshot',
    'accessibility_keyboard_check',
    'accessibility_screen_reader_check',
    'historical_summary',
    'historical_comparison',
    'historical_regression',
    'historical_recovery',
    'historical_recurrence',
    'historical_stability_baseline',
    'historical_trend',
    'campaign_summary',
    'campaign_task_result',
    'campaign_observation',
    'campaign_decision',
    'change_intelligence',
    'change_impact_graph',
    'change_risk_assessment',
    'root_cause_analysis',
    'root_cause_hypothesis',
    'code_context',
    'change_context',
    'historical_context',
    'fix_plan',
    'verification_plan'
  ));
