-- ==============================================================================
-- Sculra Autonomous QA Observability, Explainability & Human-in-the-Loop Control Center
-- Migration: 20260915000000_autonomous_observability.sql
-- ==============================================================================

-- 1. Create public.autonomous_events table (Append-Only Event Stream)
CREATE TABLE IF NOT EXISTS public.autonomous_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  campaign_id UUID REFERENCES public.qa_campaigns(id) ON DELETE SET NULL,
  test_run_id UUID REFERENCES public.test_runs(id) ON DELETE SET NULL,
  issue_id UUID REFERENCES public.issues(id) ON DELETE SET NULL,
  remediation_id UUID REFERENCES public.fix_remediations(id) ON DELETE SET NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('SYSTEM', 'WORKER', 'AI', 'HUMAN', 'GITHUB', 'CI')),
  actor_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  stage TEXT NOT NULL,
  status TEXT NOT NULL,
  summary TEXT NOT NULL,
  reason TEXT,
  confidence TEXT CHECK (confidence IS NULL OR confidence IN ('HIGH', 'MEDIUM', 'LOW', 'INSUFFICIENT_EVIDENCE')),
  source TEXT NOT NULL CHECK (source IN ('DETERMINISTIC', 'AI', 'HUMAN', 'EXTERNAL')),
  fact_category TEXT NOT NULL CHECK (fact_category IN (
    'OBSERVED_FACT',
    'INFERRED_CONCLUSION',
    'AI_HYPOTHESIS',
    'RECOMMENDATION',
    'ACTION',
    'ACTION_RESULT',
    'HUMAN_DECISION'
  )),
  evidence_ids TEXT[] DEFAULT ARRAY[]::TEXT[] NOT NULL,
  related_entity_ids TEXT[] DEFAULT ARRAY[]::TEXT[] NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Optimization indexes for autonomous_events
CREATE INDEX IF NOT EXISTS idx_autonomous_events_project_time
  ON public.autonomous_events(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_autonomous_events_org_time
  ON public.autonomous_events(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_autonomous_events_campaign
  ON public.autonomous_events(campaign_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_autonomous_events_test_run
  ON public.autonomous_events(test_run_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_autonomous_events_issue
  ON public.autonomous_events(issue_id);

CREATE INDEX IF NOT EXISTS idx_autonomous_events_remediation
  ON public.autonomous_events(remediation_id);

CREATE INDEX IF NOT EXISTS idx_autonomous_events_type
  ON public.autonomous_events(event_type);

CREATE INDEX IF NOT EXISTS idx_autonomous_events_stage
  ON public.autonomous_events(stage);

CREATE INDEX IF NOT EXISTS idx_autonomous_events_fact_cat
  ON public.autonomous_events(fact_category);

-- 2. Create public.autonomous_decisions table (Audit log of WHY decisions were made)
CREATE TABLE IF NOT EXISTS public.autonomous_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  campaign_id UUID REFERENCES public.qa_campaigns(id) ON DELETE SET NULL,
  test_run_id UUID REFERENCES public.test_runs(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  decision_type TEXT NOT NULL CHECK (decision_type IN (
    'TARGET_SELECTION',
    'TARGET_SKIP',
    'STRATEGY_DECISION',
    'RELEASE_STATUS',
    'REMEDIATION_AUTHORIZATION',
    'FIX_BLOCK',
    'PR_CREATION',
    'CAMPAIGN_CANCELLATION',
    'HUMAN_APPROVAL'
  )),
  actor_type TEXT NOT NULL CHECK (actor_type IN ('SYSTEM', 'WORKER', 'AI', 'HUMAN', 'GITHUB', 'CI')),
  actor_id TEXT NOT NULL,
  decision TEXT NOT NULL,
  reason TEXT NOT NULL,
  skip_reason TEXT CHECK (skip_reason IS NULL OR skip_reason IN (
    'AUTH_REQUIRED',
    'POLICY_BLOCKED',
    'DESTRUCTIVE_ACTION',
    'DUPLICATE_TARGET',
    'BUDGET_EXHAUSTED',
    'LOW_PRIORITY',
    'ALREADY_COVERED',
    'UNSUPPORTED_SURFACE',
    'INSUFFICIENT_CONTEXT',
    'SECURITY_RESTRICTION',
    'CANCELLED'
  )),
  evidence_ids TEXT[] DEFAULT ARRAY[]::TEXT[] NOT NULL,
  policy_checks JSONB DEFAULT '[]'::jsonb NOT NULL,
  confidence TEXT NOT NULL CHECK (confidence IN ('HIGH', 'MEDIUM', 'LOW', 'INSUFFICIENT_EVIDENCE')),
  source TEXT NOT NULL CHECK (source IN ('DETERMINISTIC', 'AI', 'HUMAN', 'EXTERNAL')),
  result TEXT,
  next_action TEXT,
  metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Optimization indexes for autonomous_decisions
CREATE INDEX IF NOT EXISTS idx_autonomous_decisions_project
  ON public.autonomous_decisions(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_autonomous_decisions_campaign
  ON public.autonomous_decisions(campaign_id);

CREATE INDEX IF NOT EXISTS idx_autonomous_decisions_type
  ON public.autonomous_decisions(decision_type);

CREATE INDEX IF NOT EXISTS idx_autonomous_decisions_skip
  ON public.autonomous_decisions(skip_reason)
  WHERE skip_reason IS NOT NULL;

-- 3. Create public.human_approvals table (Human-in-the-Loop Governance)
CREATE TABLE IF NOT EXISTS public.human_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  remediation_id UUID REFERENCES public.fix_remediations(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN (
    'APPLY_REMEDIATION',
    'CREATE_PR',
    'ENABLE_FIX_AGENT',
    'SECURITY_SENSITIVE_FIX',
    'AUTH_SENSITIVE_FIX',
    'DATABASE_MODIFICATION',
    'RELEASE_GATE_OVERRIDE'
  )),
  status TEXT NOT NULL DEFAULT 'APPROVAL_REQUIRED' CHECK (status IN (
    'APPROVAL_REQUIRED',
    'APPROVED',
    'REJECTED',
    'EXPIRED',
    'CANCELLED'
  )),
  source_sha TEXT NOT NULL,
  fix_plan_version INTEGER DEFAULT 1 NOT NULL,
  files_affected TEXT[] DEFAULT ARRAY[]::TEXT[] NOT NULL,
  diff_preview TEXT,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')),
  reason TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  approved_by TEXT,
  rejected_by TEXT,
  decision_reason TEXT,
  policy_context JSONB DEFAULT '{}'::jsonb NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Optimization indexes for human_approvals
CREATE INDEX IF NOT EXISTS idx_human_approvals_project
  ON public.human_approvals(project_id, status);

CREATE INDEX IF NOT EXISTS idx_human_approvals_remediation
  ON public.human_approvals(remediation_id);

CREATE INDEX IF NOT EXISTS idx_human_approvals_expires
  ON public.human_approvals(expires_at)
  WHERE status = 'APPROVAL_REQUIRED';

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.autonomous_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.autonomous_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.human_approvals ENABLE ROW LEVEL SECURITY;

-- Read policies: Org members or personal project owners
CREATE POLICY "Autonomous events read by org members or owners" ON public.autonomous_events
  FOR SELECT USING (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND project_id IN (
      SELECT id FROM public.projects WHERE created_by = (auth.jwt() ->> 'sub')
    ))
  );

CREATE POLICY "Autonomous decisions read by org members or owners" ON public.autonomous_decisions
  FOR SELECT USING (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND project_id IN (
      SELECT id FROM public.projects WHERE created_by = (auth.jwt() ->> 'sub')
    ))
  );

CREATE POLICY "Human approvals read by org members or owners" ON public.human_approvals
  FOR SELECT USING (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND project_id IN (
      SELECT id FROM public.projects WHERE created_by = (auth.jwt() ->> 'sub')
    ))
  );

-- Insert policies: Append-only for org members or project owners
CREATE POLICY "Autonomous events insert by org members or owners" ON public.autonomous_events
  FOR INSERT WITH CHECK (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND project_id IN (
      SELECT id FROM public.projects WHERE created_by = (auth.jwt() ->> 'sub')
    ))
  );

CREATE POLICY "Autonomous decisions insert by org members or owners" ON public.autonomous_decisions
  FOR INSERT WITH CHECK (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND project_id IN (
      SELECT id FROM public.projects WHERE created_by = (auth.jwt() ->> 'sub')
    ))
  );

CREATE POLICY "Human approvals insert by org members or owners" ON public.human_approvals
  FOR INSERT WITH CHECK (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND project_id IN (
      SELECT id FROM public.projects WHERE created_by = (auth.jwt() ->> 'sub')
    ))
  );

-- Update policy for approvals: Only status and decision fields can be updated
CREATE POLICY "Human approvals update by org members or owners" ON public.human_approvals
  FOR UPDATE USING (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND project_id IN (
      SELECT id FROM public.projects WHERE created_by = (auth.jwt() ->> 'sub')
    ))
  );

-- Service role full access
CREATE POLICY "Autonomous events service role full access" ON public.autonomous_events
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Autonomous decisions service role full access" ON public.autonomous_decisions
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Human approvals service role full access" ON public.human_approvals
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
