-- ==============================================================================
-- Sculra Autonomous QA Control Plane & End-to-End Test Campaigns Migration
-- Migration: 20260909000000_autonomous_qa_campaigns.sql
-- ==============================================================================

-- 1. Create public.qa_campaigns table
CREATE TABLE IF NOT EXISTS public.qa_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  test_run_id uuid REFERENCES public.test_runs(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (status IN (
    'QUEUED',
    'PLANNING',
    'READY',
    'RUNNING',
    'PAUSED',
    'CANCELLING',
    'COMPLETED',
    'FAILED',
    'CANCELLED',
    'NEEDS_REVIEW'
  )),
  objective text NOT NULL CHECK (objective IN (
    'release_readiness',
    'smoke',
    'regression',
    'full_suite',
    'security_audit',
    'accessibility_audit',
    'performance_audit',
    'custom'
  )),
  configuration jsonb DEFAULT '{}'::jsonb NOT NULL,
  budget jsonb DEFAULT '{}'::jsonb NOT NULL,
  state jsonb DEFAULT '{}'::jsonb NOT NULL,
  summary jsonb DEFAULT '{}'::jsonb NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Optimization indexes for qa_campaigns
CREATE INDEX IF NOT EXISTS idx_qa_campaigns_project ON public.qa_campaigns(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_qa_campaigns_org ON public.qa_campaigns(organization_id);
CREATE INDEX IF NOT EXISTS idx_qa_campaigns_status ON public.qa_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_qa_campaigns_test_run ON public.qa_campaigns(test_run_id) WHERE test_run_id IS NOT NULL;

-- Enable RLS on qa_campaigns
ALTER TABLE public.qa_campaigns ENABLE ROW LEVEL SECURITY;

-- Read policy: Organization members or project owners can view campaigns
CREATE POLICY "Campaigns read by organization members or owners" ON public.qa_campaigns
  FOR SELECT USING (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND project_id IN (
      SELECT id FROM public.projects WHERE created_by = (auth.jwt() ->> 'sub')
    ))
  );

-- Insert policy: Organization members or project owners can create campaigns
CREATE POLICY "Campaigns insert by organization members or owners" ON public.qa_campaigns
  FOR INSERT WITH CHECK (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND project_id IN (
      SELECT id FROM public.projects WHERE created_by = (auth.jwt() ->> 'sub')
    ))
  );

-- Update policy: Organization members or project owners can update campaigns
CREATE POLICY "Campaigns update by organization members or owners" ON public.qa_campaigns
  FOR UPDATE USING (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND project_id IN (
      SELECT id FROM public.projects WHERE created_by = (auth.jwt() ->> 'sub')
    ))
  );

-- Service role full access policy for worker
CREATE POLICY "Service role full access on qa_campaigns" ON public.qa_campaigns
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');


-- 2. Create public.qa_campaign_tasks table
CREATE TABLE IF NOT EXISTS public.qa_campaign_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.qa_campaigns(id) ON DELETE CASCADE NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  task_type text NOT NULL,
  target_type text NOT NULL,
  target_identifier text NOT NULL,
  status text NOT NULL CHECK (status IN (
    'QUEUED',
    'PENDING_DEPENDENCIES',
    'RUNNING',
    'PASSED',
    'FAILED',
    'BLOCKED',
    'SKIPPED',
    'CANCELLED'
  )),
  priority integer DEFAULT 50 NOT NULL,
  reason text NOT NULL,
  dependencies jsonb DEFAULT '[]'::jsonb NOT NULL,
  result jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Optimization indexes for qa_campaign_tasks
CREATE INDEX IF NOT EXISTS idx_qa_campaign_tasks_campaign ON public.qa_campaign_tasks(campaign_id, priority DESC);
CREATE INDEX IF NOT EXISTS idx_qa_campaign_tasks_target ON public.qa_campaign_tasks(project_id, target_identifier);
CREATE INDEX IF NOT EXISTS idx_qa_campaign_tasks_status ON public.qa_campaign_tasks(campaign_id, status);

-- Enable RLS on qa_campaign_tasks
ALTER TABLE public.qa_campaign_tasks ENABLE ROW LEVEL SECURITY;

-- Read policy: Organization members or project owners can view campaign tasks
CREATE POLICY "Campaign tasks read by organization members or owners" ON public.qa_campaign_tasks
  FOR SELECT USING (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND project_id IN (
      SELECT id FROM public.projects WHERE created_by = (auth.jwt() ->> 'sub')
    ))
  );

-- Service role full access policy for worker
CREATE POLICY "Service role full access on qa_campaign_tasks" ON public.qa_campaign_tasks
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');


-- 3. Extend test_evidence type check constraint to include campaign evidence types
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
    'historical_comparison',
    'campaign_summary',
    'campaign_task_result',
    'campaign_observation',
    'campaign_correlation'
  ));
