-- ==============================================================================
-- Sculra Post-Release QA Intelligence + Incident Correlation + Production Feedback Loop
-- Migration: 20260930000000_post_release_intelligence.sql
--
-- Strict Invariants:
-- - NO EVIDENCE -> NO INFERENCE
-- - Clerk-compatible RLS using public.clerk_user_id() (NO auth.uid())
-- - Tenant & organization isolation via project_id and organization_id
-- - Factual timestamps, fingerprints, and correlation states
-- - Missing monitoring data is INSUFFICIENT_EVIDENCE, never HEALTHY
-- ==============================================================================

-- 1. Create public.production_signals table
CREATE TABLE IF NOT EXISTS public.production_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  environment_id UUID REFERENCES public.project_environments(id) ON DELETE SET NULL,
  deployment_id TEXT,
  release_id TEXT,
  provider TEXT NOT NULL CHECK (provider IN ('SENTRY', 'POSTHOG', 'GENERIC_WEBHOOK', 'MANUAL', 'CI_CD')),
  provider_signal_id TEXT,
  signal_type TEXT NOT NULL CHECK (signal_type IN (
    'ERROR',
    'EXCEPTION',
    'PERFORMANCE_DEGRADATION',
    'AVAILABILITY_FAILURE',
    'USER_JOURNEY_FAILURE',
    'HTTP_ERROR',
    'API_FAILURE',
    'SECURITY_EVENT',
    'ACCESSIBILITY_REGRESSION',
    'VISUAL_REGRESSION',
    'RESOURCE_FAILURE',
    'CUSTOM_INCIDENT'
  )),
  severity TEXT NOT NULL CHECK (severity IN ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN (
    'OPEN',
    'INVESTIGATING',
    'CONFIRMED_REGRESSION',
    'POSSIBLE_REGRESSION',
    'RESOLVED',
    'SUPPRESSED',
    'IGNORED'
  )),
  title TEXT NOT NULL,
  description TEXT,
  fingerprint TEXT NOT NULL,
  first_observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  affected_url TEXT,
  affected_route TEXT,
  affected_service TEXT,
  affected_version TEXT,
  affected_commit TEXT,
  affected_branch TEXT,
  occurrence_count INT NOT NULL DEFAULT 1,
  raw_reference JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence NUMERIC(3,2) NOT NULL DEFAULT 1.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_production_signals_proj
  ON public.production_signals(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_production_signals_org
  ON public.production_signals(organization_id);

CREATE INDEX IF NOT EXISTS idx_production_signals_dep
  ON public.production_signals(deployment_id);

CREATE INDEX IF NOT EXISTS idx_production_signals_env
  ON public.production_signals(environment_id);

CREATE INDEX IF NOT EXISTS idx_production_signals_fingerprint
  ON public.production_signals(fingerprint);

CREATE INDEX IF NOT EXISTS idx_production_signals_commit
  ON public.production_signals(affected_commit);

CREATE INDEX IF NOT EXISTS idx_production_signals_status
  ON public.production_signals(status);

CREATE INDEX IF NOT EXISTS idx_production_signals_observed
  ON public.production_signals(last_observed_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_production_signals_provider_id
  ON public.production_signals(provider, provider_signal_id)
  WHERE provider_signal_id IS NOT NULL;

-- 2. Create public.signal_correlations table
CREATE TABLE IF NOT EXISTS public.signal_correlations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id UUID REFERENCES public.production_signals(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  deployment_id TEXT,
  release_id TEXT,
  correlation_state TEXT NOT NULL CHECK (correlation_state IN (
    'EXACT_MATCH',
    'STRONG_CORRELATION',
    'POSSIBLE_CORRELATION',
    'TEMPORAL_ONLY',
    'NO_CORRELATION',
    'INSUFFICIENT_EVIDENCE',
    'AMBIGUOUS'
  )),
  confidence NUMERIC(3,2) NOT NULL DEFAULT 0.00,
  reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidence_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_signal_correlations_sig
  ON public.signal_correlations(signal_id);

CREATE INDEX IF NOT EXISTS idx_signal_correlations_dep
  ON public.signal_correlations(deployment_id);

CREATE INDEX IF NOT EXISTS idx_signal_correlations_proj
  ON public.signal_correlations(project_id, evaluated_at DESC);

-- 3. Create public.post_release_verifications table
CREATE TABLE IF NOT EXISTS public.post_release_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  deployment_id TEXT NOT NULL,
  campaign_id UUID REFERENCES public.qa_campaigns(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED')),
  target_workflows JSONB NOT NULL DEFAULT '[]'::jsonb,
  findings JSONB NOT NULL DEFAULT '{}'::jsonb,
  health_state TEXT NOT NULL CHECK (health_state IN (
    'HEALTHY',
    'DEGRADED',
    'REGRESSION_DETECTED',
    'INCIDENT_ACTIVE',
    'RECOVERY_OBSERVED',
    'INSUFFICIENT_EVIDENCE',
    'UNKNOWN'
  )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_post_release_verifications_dep
  ON public.post_release_verifications(deployment_id);

CREATE INDEX IF NOT EXISTS idx_post_release_verifications_proj
  ON public.post_release_verifications(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_post_release_verifications_camp
  ON public.post_release_verifications(campaign_id);

-- 4. Create public.qa_feedback_memory table
CREATE TABLE IF NOT EXISTS public.qa_feedback_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  relationship_type TEXT NOT NULL,
  signal_id UUID REFERENCES public.production_signals(id) ON DELETE SET NULL,
  deployment_id TEXT,
  evidence_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence NUMERIC(3,2) NOT NULL DEFAULT 1.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qa_feedback_memory_proj
  ON public.qa_feedback_memory(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_qa_feedback_memory_entity
  ON public.qa_feedback_memory(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_qa_feedback_memory_signal
  ON public.qa_feedback_memory(signal_id);

CREATE INDEX IF NOT EXISTS idx_qa_feedback_memory_dep
  ON public.qa_feedback_memory(deployment_id);

-- ==============================================================================
-- 5. Row Level Security Policies (Clerk Compatible)
-- ==============================================================================

ALTER TABLE public.production_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.signal_correlations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_release_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qa_feedback_memory ENABLE ROW LEVEL SECURITY;

-- Policies for production_signals
DROP POLICY IF EXISTS "Users can view production signals for their organization" ON public.production_signals;
CREATE POLICY "Users can view production signals for their organization"
  ON public.production_signals FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM public.projects
      WHERE organization_id IN (
        SELECT organization_id FROM public.organization_memberships
        WHERE clerk_user_id = public.clerk_user_id()
      )
    )
  );

DROP POLICY IF EXISTS "Members can insert production signals" ON public.production_signals;
CREATE POLICY "Members can insert production signals"
  ON public.production_signals FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM public.projects
      WHERE organization_id IN (
        SELECT organization_id FROM public.organization_memberships
        WHERE clerk_user_id = public.clerk_user_id()
      )
    )
  );

DROP POLICY IF EXISTS "Members can update production signals" ON public.production_signals;
CREATE POLICY "Members can update production signals"
  ON public.production_signals FOR UPDATE
  USING (
    project_id IN (
      SELECT id FROM public.projects
      WHERE organization_id IN (
        SELECT organization_id FROM public.organization_memberships
        WHERE clerk_user_id = public.clerk_user_id()
      )
    )
  );

-- Policies for signal_correlations
DROP POLICY IF EXISTS "Users can view signal correlations for their organization" ON public.signal_correlations;
CREATE POLICY "Users can view signal correlations for their organization"
  ON public.signal_correlations FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM public.projects
      WHERE organization_id IN (
        SELECT organization_id FROM public.organization_memberships
        WHERE clerk_user_id = public.clerk_user_id()
      )
    )
  );

DROP POLICY IF EXISTS "Members can insert signal correlations" ON public.signal_correlations;
CREATE POLICY "Members can insert signal correlations"
  ON public.signal_correlations FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM public.projects
      WHERE organization_id IN (
        SELECT organization_id FROM public.organization_memberships
        WHERE clerk_user_id = public.clerk_user_id()
      )
    )
  );

-- Policies for post_release_verifications
DROP POLICY IF EXISTS "Users can view post release verifications for their organization" ON public.post_release_verifications;
CREATE POLICY "Users can view post release verifications for their organization"
  ON public.post_release_verifications FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM public.projects
      WHERE organization_id IN (
        SELECT organization_id FROM public.organization_memberships
        WHERE clerk_user_id = public.clerk_user_id()
      )
    )
  );

DROP POLICY IF EXISTS "Members can insert post release verifications" ON public.post_release_verifications;
CREATE POLICY "Members can insert post release verifications"
  ON public.post_release_verifications FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM public.projects
      WHERE organization_id IN (
        SELECT organization_id FROM public.organization_memberships
        WHERE clerk_user_id = public.clerk_user_id()
      )
    )
  );

DROP POLICY IF EXISTS "Members can update post release verifications" ON public.post_release_verifications;
CREATE POLICY "Members can update post release verifications"
  ON public.post_release_verifications FOR UPDATE
  USING (
    project_id IN (
      SELECT id FROM public.projects
      WHERE organization_id IN (
        SELECT organization_id FROM public.organization_memberships
        WHERE clerk_user_id = public.clerk_user_id()
      )
    )
  );

-- Policies for qa_feedback_memory
DROP POLICY IF EXISTS "Users can view qa feedback memory for their organization" ON public.qa_feedback_memory;
CREATE POLICY "Users can view qa feedback memory for their organization"
  ON public.qa_feedback_memory FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM public.projects
      WHERE organization_id IN (
        SELECT organization_id FROM public.organization_memberships
        WHERE clerk_user_id = public.clerk_user_id()
      )
    )
  );

DROP POLICY IF EXISTS "Members can insert qa feedback memory" ON public.qa_feedback_memory;
CREATE POLICY "Members can insert qa feedback memory"
  ON public.qa_feedback_memory FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM public.projects
      WHERE organization_id IN (
        SELECT organization_id FROM public.organization_memberships
        WHERE clerk_user_id = public.clerk_user_id()
      )
    )
  );
