-- ==============================================================================
-- Sculra Continuous Deployment QA Automation & Release Gate Enforcement Migration
-- Migration: 20260928000001_cd_automation_release_gates.sql
-- ==============================================================================

-- 1. Create public.deployment_events table
CREATE TABLE IF NOT EXISTS public.deployment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_event_id TEXT,
  deployment_id UUID REFERENCES public.deployments(id) ON DELETE SET NULL,
  environment_id UUID REFERENCES public.project_environments(id) ON DELETE SET NULL,
  environment_name TEXT,
  environment_type TEXT,
  deployment_status TEXT NOT NULL DEFAULT 'RECEIVED' CHECK (deployment_status IN ('RECEIVED', 'VALIDATING', 'DEPLOYING', 'READY', 'FAILED', 'CANCELLED', 'UNKNOWN')),
  commit_sha TEXT,
  branch TEXT,
  repository TEXT,
  deployment_url TEXT,
  release_id UUID REFERENCES public.releases(id) ON DELETE SET NULL,
  occurred_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  source TEXT NOT NULL DEFAULT 'UNKNOWN',
  confidence NUMERIC(3,2) NOT NULL DEFAULT 0.00,
  raw_metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_deployment_events_proj
  ON public.deployment_events(project_id, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_deployment_events_provider
  ON public.deployment_events(provider, provider_event_id);

CREATE INDEX IF NOT EXISTS idx_deployment_events_dep
  ON public.deployment_events(deployment_id);

CREATE INDEX IF NOT EXISTS idx_deployment_events_commit
  ON public.deployment_events(commit_sha);

-- 2. Create public.qa_trigger_decisions table
CREATE TABLE IF NOT EXISTS public.qa_trigger_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  deployment_id UUID REFERENCES public.deployments(id) ON DELETE SET NULL,
  environment_id UUID REFERENCES public.project_environments(id) ON DELETE SET NULL,
  event_id UUID REFERENCES public.deployment_events(id) ON DELETE SET NULL,
  decision TEXT NOT NULL CHECK (decision IN ('RUN_FULL', 'RUN_TARGETED', 'RUN_CRITICAL_ONLY', 'DEFER', 'REVIEW', 'DO_NOT_RUN')),
  campaign_type TEXT NOT NULL,
  campaign_id UUID REFERENCES public.qa_campaigns(id) ON DELETE SET NULL,
  selected_targets TEXT[] DEFAULT ARRAY[]::TEXT[] NOT NULL,
  skipped_targets TEXT[] DEFAULT ARRAY[]::TEXT[] NOT NULL,
  deferred_targets TEXT[] DEFAULT ARRAY[]::TEXT[] NOT NULL,
  review_targets TEXT[] DEFAULT ARRAY[]::TEXT[] NOT NULL,
  reasons TEXT[] DEFAULT ARRAY[]::TEXT[] NOT NULL,
  confidence NUMERIC(3,2) NOT NULL DEFAULT 0.00,
  evidence JSONB DEFAULT '[]'::jsonb NOT NULL,
  evaluated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_qa_trigger_decisions_proj
  ON public.qa_trigger_decisions(project_id, evaluated_at DESC);

CREATE INDEX IF NOT EXISTS idx_qa_trigger_decisions_dep
  ON public.qa_trigger_decisions(deployment_id);

CREATE INDEX IF NOT EXISTS idx_qa_trigger_decisions_camp
  ON public.qa_trigger_decisions(campaign_id);

-- 3. Create public.release_gate_policies table
CREATE TABLE IF NOT EXISTS public.release_gate_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0.0',
  is_default BOOLEAN NOT NULL DEFAULT true,
  rules JSONB DEFAULT '[]'::jsonb NOT NULL,
  require_approval_on_review BOOLEAN NOT NULL DEFAULT true,
  require_approval_on_warn BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_release_gate_policies_proj
  ON public.release_gate_policies(project_id, version);

-- 4. Create public.release_gate_decisions table
CREATE TABLE IF NOT EXISTS public.release_gate_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  release_id UUID REFERENCES public.releases(id) ON DELETE SET NULL,
  deployment_id UUID REFERENCES public.deployments(id) ON DELETE SET NULL,
  environment_id UUID REFERENCES public.project_environments(id) ON DELETE SET NULL,
  policy_id UUID REFERENCES public.release_gate_policies(id) ON DELETE SET NULL,
  policy_version TEXT NOT NULL DEFAULT '1.0.0',
  decision TEXT NOT NULL CHECK (decision IN ('PASS', 'BLOCK', 'REVIEW', 'INSUFFICIENT_EVIDENCE')),
  blockers JSONB DEFAULT '[]'::jsonb NOT NULL,
  warnings JSONB DEFAULT '[]'::jsonb NOT NULL,
  evidence JSONB DEFAULT '[]'::jsonb NOT NULL,
  confidence NUMERIC(3,2) NOT NULL DEFAULT 0.00,
  evaluated_by TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'CI_CD_ORCHESTRATION',
  evaluated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_release_gate_decisions_proj
  ON public.release_gate_decisions(project_id, evaluated_at DESC);

CREATE INDEX IF NOT EXISTS idx_release_gate_decisions_rel
  ON public.release_gate_decisions(release_id);

CREATE INDEX IF NOT EXISTS idx_release_gate_decisions_dep
  ON public.release_gate_decisions(deployment_id);

CREATE INDEX IF NOT EXISTS idx_release_gate_decisions_dec
  ON public.release_gate_decisions(decision);

-- 5. Create public.release_gate_approvals table
CREATE TABLE IF NOT EXISTS public.release_gate_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id UUID REFERENCES public.release_gate_decisions(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  release_id UUID REFERENCES public.releases(id) ON DELETE SET NULL,
  deployment_id UUID REFERENCES public.deployments(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED')),
  requester_id TEXT NOT NULL,
  approver_id TEXT,
  reason TEXT,
  requested_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  decided_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_release_gate_approvals_proj
  ON public.release_gate_approvals(project_id, status);

CREATE INDEX IF NOT EXISTS idx_release_gate_approvals_dec
  ON public.release_gate_approvals(decision_id);

-- 6. Enable Row Level Security (RLS)
ALTER TABLE public.deployment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_trigger_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.release_gate_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.release_gate_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.release_gate_approvals ENABLE ROW LEVEL SECURITY;

-- 7. Clerk-Compatible RLS Policies for deployment_events
DROP POLICY IF EXISTS "Users can view deployment events for their organization" ON public.deployment_events;
CREATE POLICY "Users can view deployment events for their organization"
  ON public.deployment_events FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM public.projects
      WHERE organization_id IN (
        SELECT organization_id FROM public.organization_memberships
        WHERE clerk_user_id = public.clerk_user_id()
      )
    )
    OR
    organization_id IN (
      SELECT organization_id FROM public.organization_memberships
      WHERE clerk_user_id = public.clerk_user_id()
    )
  );

DROP POLICY IF EXISTS "Members can create deployment events" ON public.deployment_events;
CREATE POLICY "Members can create deployment events"
  ON public.deployment_events FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM public.projects
      WHERE organization_id IN (
        SELECT organization_id FROM public.organization_memberships
        WHERE clerk_user_id = public.clerk_user_id()
      )
    )
    OR organization_id IS NULL OR project_id IS NULL
  );

-- 8. Clerk-Compatible RLS Policies for qa_trigger_decisions
DROP POLICY IF EXISTS "Users can view qa trigger decisions for their organization" ON public.qa_trigger_decisions;
CREATE POLICY "Users can view qa trigger decisions for their organization"
  ON public.qa_trigger_decisions FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM public.projects
      WHERE organization_id IN (
        SELECT organization_id FROM public.organization_memberships
        WHERE clerk_user_id = public.clerk_user_id()
      )
    )
  );

DROP POLICY IF EXISTS "Members can insert qa trigger decisions" ON public.qa_trigger_decisions;
CREATE POLICY "Members can insert qa trigger decisions"
  ON public.qa_trigger_decisions FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM public.projects
      WHERE organization_id IN (
        SELECT organization_id FROM public.organization_memberships
        WHERE clerk_user_id = public.clerk_user_id()
      )
    )
  );

-- 9. Clerk-Compatible RLS Policies for release_gate_policies
DROP POLICY IF EXISTS "Users can view release gate policies for their organization" ON public.release_gate_policies;
CREATE POLICY "Users can view release gate policies for their organization"
  ON public.release_gate_policies FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM public.projects
      WHERE organization_id IN (
        SELECT organization_id FROM public.organization_memberships
        WHERE clerk_user_id = public.clerk_user_id()
      )
    )
  );

DROP POLICY IF EXISTS "Members can insert release gate policies" ON public.release_gate_policies;
CREATE POLICY "Members can insert release gate policies"
  ON public.release_gate_policies FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM public.projects
      WHERE organization_id IN (
        SELECT organization_id FROM public.organization_memberships
        WHERE clerk_user_id = public.clerk_user_id()
      )
    )
  );

DROP POLICY IF EXISTS "Members can update release gate policies" ON public.release_gate_policies;
CREATE POLICY "Members can update release gate policies"
  ON public.release_gate_policies FOR UPDATE
  USING (
    project_id IN (
      SELECT id FROM public.projects
      WHERE organization_id IN (
        SELECT organization_id FROM public.organization_memberships
        WHERE clerk_user_id = public.clerk_user_id()
      )
    )
  );

-- 10. Clerk-Compatible RLS Policies for release_gate_decisions
DROP POLICY IF EXISTS "Users can view release gate decisions for their organization" ON public.release_gate_decisions;
CREATE POLICY "Users can view release gate decisions for their organization"
  ON public.release_gate_decisions FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM public.projects
      WHERE organization_id IN (
        SELECT organization_id FROM public.organization_memberships
        WHERE clerk_user_id = public.clerk_user_id()
      )
    )
  );

DROP POLICY IF EXISTS "Members can insert release gate decisions" ON public.release_gate_decisions;
CREATE POLICY "Members can insert release gate decisions"
  ON public.release_gate_decisions FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM public.projects
      WHERE organization_id IN (
        SELECT organization_id FROM public.organization_memberships
        WHERE clerk_user_id = public.clerk_user_id()
      )
    )
  );

DROP POLICY IF EXISTS "Members can update release gate decisions" ON public.release_gate_decisions;
CREATE POLICY "Members can update release gate decisions"
  ON public.release_gate_decisions FOR UPDATE
  USING (
    project_id IN (
      SELECT id FROM public.projects
      WHERE organization_id IN (
        SELECT organization_id FROM public.organization_memberships
        WHERE clerk_user_id = public.clerk_user_id()
      )
    )
  );

-- 11. Clerk-Compatible RLS Policies for release_gate_approvals
DROP POLICY IF EXISTS "Users can view release gate approvals for their organization" ON public.release_gate_approvals;
CREATE POLICY "Users can view release gate approvals for their organization"
  ON public.release_gate_approvals FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM public.projects
      WHERE organization_id IN (
        SELECT organization_id FROM public.organization_memberships
        WHERE clerk_user_id = public.clerk_user_id()
      )
    )
  );

DROP POLICY IF EXISTS "Members can insert release gate approvals" ON public.release_gate_approvals;
CREATE POLICY "Members can insert release gate approvals"
  ON public.release_gate_approvals FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM public.projects
      WHERE organization_id IN (
        SELECT organization_id FROM public.organization_memberships
        WHERE clerk_user_id = public.clerk_user_id()
      )
    )
  );

DROP POLICY IF EXISTS "Members can update release gate approvals" ON public.release_gate_approvals;
CREATE POLICY "Members can update release gate approvals"
  ON public.release_gate_approvals FOR UPDATE
  USING (
    project_id IN (
      SELECT id FROM public.projects
      WHERE organization_id IN (
        SELECT organization_id FROM public.organization_memberships
        WHERE clerk_user_id = public.clerk_user_id()
      )
    )
  );
