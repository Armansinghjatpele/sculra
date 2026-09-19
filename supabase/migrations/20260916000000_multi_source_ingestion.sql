-- ==============================================================================
-- Sculra Multi-Source Project Ingestion & Unified Connection Intelligence
-- Migration: 20260916000000_multi_source_ingestion.sql
-- ==============================================================================

-- 1. Create public.project_sources table
CREATE TABLE IF NOT EXISTS public.project_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('website', 'github', 'zip', 'desktop', 'api')),
  locator TEXT NOT NULL,
  branch TEXT,
  environment TEXT NOT NULL DEFAULT 'Production',
  status TEXT NOT NULL DEFAULT 'CONFIGURED' CHECK (status IN (
    'CONFIGURED',
    'AVAILABLE',
    'UNAVAILABLE',
    'UNSUPPORTED',
    'NOT_READY',
    'DEGRADED'
  )),
  configuration JSONB DEFAULT '{}'::jsonb NOT NULL,
  capabilities JSONB DEFAULT '[]'::jsonb NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Optimization indexes for project_sources
CREATE INDEX IF NOT EXISTS idx_project_sources_project
  ON public.project_sources(project_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_project_sources_type
  ON public.project_sources(source_type);

CREATE INDEX IF NOT EXISTS idx_project_sources_status
  ON public.project_sources(status);

-- 2. Create public.source_snapshots table (Immutable audit record of what Sculra observed)
CREATE TABLE IF NOT EXISTS public.source_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  project_source_id UUID REFERENCES public.project_sources(id) ON DELETE CASCADE NOT NULL,
  fingerprint TEXT NOT NULL,
  revision TEXT,
  environment TEXT,
  capabilities JSONB DEFAULT '[]'::jsonb NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
  status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN (
    'AVAILABLE',
    'UNAVAILABLE',
    'DEGRADED',
    'UNSUPPORTED',
    'NOT_READY'
  )),
  observed_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Optimization indexes for source_snapshots
CREATE INDEX IF NOT EXISTS idx_source_snapshots_source
  ON public.source_snapshots(project_source_id, observed_at DESC);

CREATE INDEX IF NOT EXISTS idx_source_snapshots_project
  ON public.source_snapshots(project_id, observed_at DESC);

CREATE INDEX IF NOT EXISTS idx_source_snapshots_fingerprint
  ON public.source_snapshots(fingerprint);

-- 3. Create public.source_health_observations table (Chronological health checks)
CREATE TABLE IF NOT EXISTS public.source_health_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_source_id UUID REFERENCES public.project_sources(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL CHECK (status IN (
    'HEALTHY',
    'DEGRADED',
    'UNREACHABLE',
    'AUTH_REQUIRED',
    'FORBIDDEN',
    'MISCONFIGURED',
    'UNSUPPORTED',
    'NOT_READY',
    'UNKNOWN'
  )),
  latency_ms INTEGER,
  error_code TEXT,
  metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
  observed_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Optimization indexes for source_health_observations
CREATE INDEX IF NOT EXISTS idx_source_health_source
  ON public.source_health_observations(project_source_id, observed_at DESC);

-- ==============================================================================
-- Row-Level Security (RLS) Policies
-- ==============================================================================

ALTER TABLE public.project_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_health_observations ENABLE ROW LEVEL SECURITY;

-- Project Sources Policies
CREATE POLICY "Project sources read by org members or owners" ON public.project_sources
  FOR SELECT USING (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND project_id IN (
      SELECT id FROM public.projects WHERE created_by = (auth.jwt() ->> 'sub')
    ))
  );

CREATE POLICY "Project sources insert by org members or owners" ON public.project_sources
  FOR INSERT WITH CHECK (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND project_id IN (
      SELECT id FROM public.projects WHERE created_by = (auth.jwt() ->> 'sub')
    ))
  );

CREATE POLICY "Project sources update by org members or owners" ON public.project_sources
  FOR UPDATE USING (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND project_id IN (
      SELECT id FROM public.projects WHERE created_by = (auth.jwt() ->> 'sub')
    ))
  );

CREATE POLICY "Project sources delete by org members or owners" ON public.project_sources
  FOR DELETE USING (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND project_id IN (
      SELECT id FROM public.projects WHERE created_by = (auth.jwt() ->> 'sub')
    ))
  );

-- Source Snapshots Policies (Append-only)
CREATE POLICY "Source snapshots read by org members or owners" ON public.source_snapshots
  FOR SELECT USING (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND project_id IN (
      SELECT id FROM public.projects WHERE created_by = (auth.jwt() ->> 'sub')
    ))
  );

CREATE POLICY "Source snapshots insert by org members or owners" ON public.source_snapshots
  FOR INSERT WITH CHECK (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND project_id IN (
      SELECT id FROM public.projects WHERE created_by = (auth.jwt() ->> 'sub')
    ))
  );

-- Source Health Observations Policies (Append-only)
CREATE POLICY "Source health read by org members or owners" ON public.source_health_observations
  FOR SELECT USING (
    project_source_id IN (
      SELECT id FROM public.project_sources
      WHERE (organization_id IS NOT NULL AND public.is_org_member(organization_id))
         OR (organization_id IS NULL AND project_id IN (
              SELECT id FROM public.projects WHERE created_by = (auth.jwt() ->> 'sub')
            ))
    )
  );

CREATE POLICY "Source health insert by org members or owners" ON public.source_health_observations
  FOR INSERT WITH CHECK (
    project_source_id IN (
      SELECT id FROM public.project_sources
      WHERE (organization_id IS NOT NULL AND public.is_org_member(organization_id))
         OR (organization_id IS NULL AND project_id IN (
              SELECT id FROM public.projects WHERE created_by = (auth.jwt() ->> 'sub')
            ))
    )
  );

-- Service Role full access policies
CREATE POLICY "Project sources service role full access" ON public.project_sources
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Source snapshots service role full access" ON public.source_snapshots
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Source health service role full access" ON public.source_health_observations
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
