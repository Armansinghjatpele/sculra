-- ==============================================================================
-- Sculra Release Orchestration, Environment Management & Deployment-Aware QA
-- Migration: 20260920000000_release_orchestration.sql
-- ==============================================================================

-- 1. Create public.project_environments table
CREATE TABLE IF NOT EXISTS public.project_environments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  source_id UUID REFERENCES public.project_sources(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('DEVELOPMENT', 'STAGING', 'PREVIEW', 'PRODUCTION', 'CUSTOM')),
  base_url TEXT NOT NULL,
  branch TEXT,
  commit_sha TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'UNREACHABLE', 'MISCONFIGURED', 'AUTH_REQUIRED')),
  is_production BOOLEAN NOT NULL DEFAULT false,
  health_status TEXT NOT NULL DEFAULT 'UNKNOWN' CHECK (health_status IN ('HEALTHY', 'DEGRADED', 'UNREACHABLE', 'AUTH_REQUIRED', 'MISCONFIGURED', 'UNKNOWN')),
  last_health_check_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT uq_project_environment_slug UNIQUE (project_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_project_environments_project
  ON public.project_environments(project_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_project_environments_org
  ON public.project_environments(organization_id);

CREATE INDEX IF NOT EXISTS idx_project_environments_type
  ON public.project_environments(type);

-- 2. Create public.deployments table
CREATE TABLE IF NOT EXISTS public.deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  environment_id UUID REFERENCES public.project_environments(id) ON DELETE CASCADE NOT NULL,
  source_id UUID REFERENCES public.project_sources(id) ON DELETE SET NULL,
  commit_sha TEXT NOT NULL,
  branch TEXT,
  deployment_url TEXT,
  provider TEXT NOT NULL DEFAULT 'GENERIC',
  status TEXT NOT NULL DEFAULT 'UNKNOWN' CHECK (status IN ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'UNKNOWN')),
  trigger TEXT NOT NULL DEFAULT 'MANUAL' CHECK (trigger IN ('GITHUB_PUSH', 'GITHUB_PR', 'MANUAL', 'WEBHOOK', 'API', 'UNKNOWN')),
  idempotency_key TEXT,
  metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_deployments_project
  ON public.deployments(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_deployments_env
  ON public.deployments(environment_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_deployments_commit
  ON public.deployments(commit_sha);

CREATE UNIQUE INDEX IF NOT EXISTS idx_deployments_idempotency
  ON public.deployments(project_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- 3. Create public.releases table
CREATE TABLE IF NOT EXISTS public.releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  environment_id UUID REFERENCES public.project_environments(id) ON DELETE CASCADE NOT NULL,
  deployment_id UUID REFERENCES public.deployments(id) ON DELETE SET NULL,
  source_id UUID REFERENCES public.project_sources(id) ON DELETE SET NULL,
  version TEXT NOT NULL,
  commit_sha TEXT NOT NULL,
  branch TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'CANDIDATE', 'TESTING', 'READY', 'BLOCKED', 'RELEASED', 'ABANDONED')),
  previous_release_id UUID REFERENCES public.releases(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_releases_project
  ON public.releases(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_releases_env
  ON public.releases(environment_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_releases_status
  ON public.releases(status);

CREATE INDEX IF NOT EXISTS idx_releases_commit
  ON public.releases(commit_sha);

-- 4. Create public.release_checks table
CREATE TABLE IF NOT EXISTS public.release_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  release_id UUID REFERENCES public.releases(id) ON DELETE CASCADE NOT NULL,
  campaign_id UUID REFERENCES public.qa_campaigns(id) ON DELETE SET NULL,
  policy_level TEXT NOT NULL DEFAULT 'STANDARD' CHECK (policy_level IN ('SMOKE_ONLY', 'STANDARD', 'FULL', 'CUSTOM')),
  status TEXT NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'INSUFFICIENT_EVIDENCE')),
  overall_score NUMERIC(5, 2),
  release_decision TEXT CHECK (release_decision IN ('RELEASE', 'RELEASE_WITH_CAUTION', 'DO_NOT_RELEASE', 'INSUFFICIENT_EVIDENCE')),
  gates JSONB DEFAULT '[]'::jsonb NOT NULL,
  evidence_summary JSONB DEFAULT '{}'::jsonb NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_release_checks_release
  ON public.release_checks(release_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_release_checks_campaign
  ON public.release_checks(campaign_id);

-- 5. Create public.release_decisions table
CREATE TABLE IF NOT EXISTS public.release_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  release_id UUID REFERENCES public.releases(id) ON DELETE CASCADE NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('APPROVE', 'BLOCK', 'REQUEST_RETEST')),
  decided_by TEXT NOT NULL,
  decided_by_role TEXT NOT NULL,
  notes TEXT,
  decided_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_release_decisions_release
  ON public.release_decisions(release_id, created_at DESC);

-- 6. Enable Row Level Security (RLS) on all tables
ALTER TABLE public.project_environments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.release_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.release_decisions ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies for project_environments
CREATE POLICY "Users can view environments in their workspace"
  ON public.project_environments FOR SELECT
  USING (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND project_id IN (
      SELECT id FROM public.projects WHERE created_by = auth.uid()::text
    ))
  );

CREATE POLICY "Authorized users can insert environments"
  ON public.project_environments FOR INSERT
  WITH CHECK (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND project_id IN (
      SELECT id FROM public.projects WHERE created_by = auth.uid()::text
    ))
  );

CREATE POLICY "Authorized users can update environments"
  ON public.project_environments FOR UPDATE
  USING (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND project_id IN (
      SELECT id FROM public.projects WHERE created_by = auth.uid()::text
    ))
  );

CREATE POLICY "Owners and admins can delete environments"
  ON public.project_environments FOR DELETE
  USING (
    (organization_id IS NOT NULL AND public.is_org_owner_or_admin(organization_id))
    OR
    (organization_id IS NULL AND project_id IN (
      SELECT id FROM public.projects WHERE created_by = auth.uid()::text
    ))
  );

-- 8. RLS Policies for deployments
CREATE POLICY "Users can view deployments in their workspace"
  ON public.deployments FOR SELECT
  USING (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND project_id IN (
      SELECT id FROM public.projects WHERE created_by = auth.uid()::text
    ))
  );

CREATE POLICY "Authorized users can insert deployments"
  ON public.deployments FOR INSERT
  WITH CHECK (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND project_id IN (
      SELECT id FROM public.projects WHERE created_by = auth.uid()::text
    ))
  );

CREATE POLICY "Authorized users can update deployments"
  ON public.deployments FOR UPDATE
  USING (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND project_id IN (
      SELECT id FROM public.projects WHERE created_by = auth.uid()::text
    ))
  );

-- 9. RLS Policies for releases
CREATE POLICY "Users can view releases in their workspace"
  ON public.releases FOR SELECT
  USING (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND project_id IN (
      SELECT id FROM public.projects WHERE created_by = auth.uid()::text
    ))
  );

CREATE POLICY "Authorized users can insert releases"
  ON public.releases FOR INSERT
  WITH CHECK (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND project_id IN (
      SELECT id FROM public.projects WHERE created_by = auth.uid()::text
    ))
  );

CREATE POLICY "Authorized users can update releases"
  ON public.releases FOR UPDATE
  USING (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND project_id IN (
      SELECT id FROM public.projects WHERE created_by = auth.uid()::text
    ))
  );

-- 10. RLS Policies for release_checks
CREATE POLICY "Users can view release checks in their workspace"
  ON public.release_checks FOR SELECT
  USING (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND project_id IN (
      SELECT id FROM public.projects WHERE created_by = auth.uid()::text
    ))
  );

CREATE POLICY "Authorized users can insert release checks"
  ON public.release_checks FOR INSERT
  WITH CHECK (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND project_id IN (
      SELECT id FROM public.projects WHERE created_by = auth.uid()::text
    ))
  );

CREATE POLICY "Authorized users can update release checks"
  ON public.release_checks FOR UPDATE
  USING (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND project_id IN (
      SELECT id FROM public.projects WHERE created_by = auth.uid()::text
    ))
  );

-- 11. RLS Policies for release_decisions
CREATE POLICY "Users can view release decisions in their workspace"
  ON public.release_decisions FOR SELECT
  USING (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND project_id IN (
      SELECT id FROM public.projects WHERE created_by = auth.uid()::text
    ))
  );

CREATE POLICY "Authorized users can record release decisions"
  ON public.release_decisions FOR INSERT
  WITH CHECK (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND project_id IN (
      SELECT id FROM public.projects WHERE created_by = auth.uid()::text
    ))
  );
