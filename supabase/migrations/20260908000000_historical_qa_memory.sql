-- ==============================================================================
-- Sculra Historical QA Memory & Cross-Run Signals Migration
-- Migration: 20260908000000_historical_qa_memory.sql
-- ==============================================================================

-- 1. Create public.qa_history_signals table
CREATE TABLE IF NOT EXISTS public.qa_history_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  test_run_id uuid REFERENCES public.test_runs(id) ON DELETE CASCADE NOT NULL,
  signal_type text NOT NULL CHECK (signal_type IN (
    'NEW_REGRESSION',
    'RECOVERED_DEFECT',
    'RECURRING_DEFECT',
    'STABLE_PASS',
    'STABLE_FAILURE',
    'INTERMITTENT_TARGET',
    'RELEASE_SCORE_DEGRADED',
    'RELEASE_SCORE_IMPROVED',
    'UNTESTED_CRITICAL_WORKFLOW',
    'PERFORMANCE_REGRESSION',
    'ACCESSIBILITY_REGRESSION',
    'SECURITY_REGRESSION',
    'API_REGRESSION',
    'VISUAL_REGRESSION'
  )),
  target_type text NOT NULL,
  target_identifier text NOT NULL,
  fingerprint text,
  severity text NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info')),
  confidence text NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
  occurrence_count integer DEFAULT 1 NOT NULL,
  consecutive_count integer DEFAULT 1 NOT NULL,
  environment text DEFAULT 'staging',
  viewport text,
  role text,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  first_seen_at timestamptz DEFAULT now() NOT NULL,
  last_seen_at timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Optimization indexes for historical signals
CREATE INDEX IF NOT EXISTS idx_qa_signals_project_run ON public.qa_history_signals(project_id, test_run_id);
CREATE INDEX IF NOT EXISTS idx_qa_signals_project_type ON public.qa_history_signals(project_id, signal_type);
CREATE INDEX IF NOT EXISTS idx_qa_signals_project_fingerprint ON public.qa_history_signals(project_id, fingerprint) WHERE fingerprint IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_qa_signals_last_seen ON public.qa_history_signals(project_id, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_qa_signals_target ON public.qa_history_signals(project_id, target_identifier);

-- 2. Enable RLS on qa_history_signals
ALTER TABLE public.qa_history_signals ENABLE ROW LEVEL SECURITY;

-- Read policy: Organization members or project owners can view signals
CREATE POLICY "Signals read by organization members or owners" ON public.qa_history_signals
  FOR SELECT USING (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND project_id IN (
      SELECT id FROM public.projects WHERE created_by = (auth.jwt() ->> 'sub')
    ))
  );

-- Service role full access policy
CREATE POLICY "Service role full access on qa_history_signals" ON public.qa_history_signals
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- 3. Extend test_evidence type check constraint to include historical evidence types
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
    'performance_navigation',
    'performance_web_vitals',
    'performance_network',
    'performance_resource',
    'performance_action',
    'performance_reliability',
    'performance_regression',
    'accessibility_summary',
    'accessibility_finding',
    'accessibility_check',
    'accessibility_keyboard',
    'accessibility_contrast',
    'accessibility_touch_target',
    'accessibility_form',
    'accessibility_heading',
    'accessibility_landmark',
    'accessibility_dialog',
    'release_report',
    'historical_summary',
    'regression_event',
    'recovery_event',
    'recurrence_event',
    'stability_signal',
    'trend_snapshot',
    'coverage_trend',
    'historical_comparison'
  ));
