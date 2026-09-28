-- ==============================================================================
-- Sculra Deployment-Aware Regression Intelligence & Release Impact Migration
-- Migration: 20260928000000_deployment_regression_intelligence.sql
-- ==============================================================================

-- 1. Create public.deployment_snapshots table
CREATE TABLE IF NOT EXISTS public.deployment_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id UUID REFERENCES public.deployments(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  environment_id UUID REFERENCES public.project_environments(id) ON DELETE SET NULL,
  environment_name TEXT,
  environment_type TEXT,
  deployment_status TEXT CHECK (deployment_status IN ('DEPLOYING', 'READY', 'FAILED', 'CANCELLED', 'UNKNOWN')),
  deployment_url TEXT,
  commit_sha TEXT,
  branch TEXT,
  previous_deployment_id UUID REFERENCES public.deployments(id) ON DELETE SET NULL,
  previous_commit_sha TEXT,
  release_id UUID REFERENCES public.releases(id) ON DELETE SET NULL,
  release_version TEXT,
  provider TEXT,
  source TEXT NOT NULL DEFAULT 'UNKNOWN',
  confidence NUMERIC(3,2) NOT NULL DEFAULT 0.00,
  evidence JSONB DEFAULT '[]'::jsonb NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_deployment_snapshots_proj
  ON public.deployment_snapshots(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_deployment_snapshots_dep
  ON public.deployment_snapshots(deployment_id);

CREATE INDEX IF NOT EXISTS idx_deployment_snapshots_env
  ON public.deployment_snapshots(environment_id);

CREATE INDEX IF NOT EXISTS idx_deployment_snapshots_commit
  ON public.deployment_snapshots(commit_sha);

-- 2. Create public.release_impacts table
CREATE TABLE IF NOT EXISTS public.release_impacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id UUID REFERENCES public.releases(id) ON DELETE SET NULL,
  deployment_id UUID REFERENCES public.deployments(id) ON DELETE SET NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  environment_id UUID REFERENCES public.project_environments(id) ON DELETE SET NULL,
  changed_area_count INT NOT NULL DEFAULT 0,
  affected_workflow_count INT NOT NULL DEFAULT 0,
  critical_workflow_count INT NOT NULL DEFAULT 0,
  new_regression_count INT NOT NULL DEFAULT 0,
  recovered_count INT NOT NULL DEFAULT 0,
  persistent_failure_count INT NOT NULL DEFAULT 0,
  unresolved_issue_count INT NOT NULL DEFAULT 0,
  security_impact BOOLEAN,
  authentication_impact BOOLEAN,
  performance_impact BOOLEAN,
  accessibility_impact BOOLEAN,
  visual_impact BOOLEAN,
  api_impact BOOLEAN,
  confidence NUMERIC(3,2) NOT NULL DEFAULT 0.00,
  status TEXT NOT NULL DEFAULT 'INCONCLUSIVE' CHECK (status IN ('LOW_IMPACT', 'MATERIAL_IMPACT', 'HIGH_IMPACT', 'INCONCLUSIVE')),
  evidence JSONB DEFAULT '[]'::jsonb NOT NULL,
  unknown_fields TEXT[] DEFAULT ARRAY[]::TEXT[] NOT NULL,
  calculated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_release_impacts_proj
  ON public.release_impacts(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_release_impacts_release
  ON public.release_impacts(release_id);

CREATE INDEX IF NOT EXISTS idx_release_impacts_dep
  ON public.release_impacts(deployment_id);

CREATE INDEX IF NOT EXISTS idx_release_impacts_status
  ON public.release_impacts(status);

-- 3. Enable RLS
ALTER TABLE public.deployment_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.release_impacts ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for deployment_snapshots
DROP POLICY IF EXISTS "Users can view deployment snapshots for their organization" ON public.deployment_snapshots;
CREATE POLICY "Users can view deployment snapshots for their organization"
  ON public.deployment_snapshots
  FOR SELECT
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

DROP POLICY IF EXISTS "Members can create deployment snapshots" ON public.deployment_snapshots;
CREATE POLICY "Members can create deployment snapshots"
  ON public.deployment_snapshots
  FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM public.projects
      WHERE organization_id IN (
        SELECT organization_id FROM public.organization_memberships
        WHERE clerk_user_id = public.clerk_user_id()
      )
    )
  );

DROP POLICY IF EXISTS "Members can update deployment snapshots" ON public.deployment_snapshots;
CREATE POLICY "Members can update deployment snapshots"
  ON public.deployment_snapshots
  FOR UPDATE
  USING (
    project_id IN (
      SELECT id FROM public.projects
      WHERE organization_id IN (
        SELECT organization_id FROM public.organization_memberships
        WHERE clerk_user_id = public.clerk_user_id()
      )
    )
  );

-- 5. RLS Policies for release_impacts
DROP POLICY IF EXISTS "Users can view release impacts for their organization" ON public.release_impacts;
CREATE POLICY "Users can view release impacts for their organization"
  ON public.release_impacts
  FOR SELECT
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

DROP POLICY IF EXISTS "Members can create release impacts" ON public.release_impacts;
CREATE POLICY "Members can create release impacts"
  ON public.release_impacts
  FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM public.projects
      WHERE organization_id IN (
        SELECT organization_id FROM public.organization_memberships
        WHERE clerk_user_id = public.clerk_user_id()
      )
    )
  );

DROP POLICY IF EXISTS "Members can update release impacts" ON public.release_impacts;
CREATE POLICY "Members can update release impacts"
  ON public.release_impacts
  FOR UPDATE
  USING (
    project_id IN (
      SELECT id FROM public.projects
      WHERE organization_id IN (
        SELECT organization_id FROM public.organization_memberships
        WHERE clerk_user_id = public.clerk_user_id()
      )
    )
  );
