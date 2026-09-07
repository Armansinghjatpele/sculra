-- ==============================================================================
-- Sculra Deterministic Issue Detection & Occurrences Migration
-- Migration: 20260907000003_deterministic_issues.sql
-- ==============================================================================

-- 1. Extend public.issues with fingerprinting and occurrence tracking
ALTER TABLE public.issues
  ADD COLUMN IF NOT EXISTS fingerprint text,
  ADD COLUMN IF NOT EXISTS occurrence_count integer DEFAULT 1 NOT NULL,
  ADD COLUMN IF NOT EXISTS first_seen_at timestamptz DEFAULT now() NOT NULL,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz DEFAULT now() NOT NULL;

-- Create unique index on (project_id, fingerprint) for idempotent deduplication
CREATE UNIQUE INDEX IF NOT EXISTS idx_issues_project_fingerprint
  ON public.issues(project_id, fingerprint)
  WHERE fingerprint IS NOT NULL;

-- Index for fast lookup by last seen and status
CREATE INDEX IF NOT EXISTS idx_issues_status_last_seen
  ON public.issues(project_id, status, last_seen_at DESC);

-- 2. Create public.issue_occurrences table
CREATE TABLE IF NOT EXISTS public.issue_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid REFERENCES public.issues(id) ON DELETE CASCADE NOT NULL,
  test_run_id uuid REFERENCES public.test_runs(id) ON DELETE CASCADE NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  journey_id text,
  step_id text,
  evidence_id uuid REFERENCES public.test_evidence(id) ON DELETE SET NULL,
  fingerprint text NOT NULL,
  metadata jsonb,
  observed_at timestamptz DEFAULT now() NOT NULL
);

-- Optimization indexes for issue occurrences
CREATE INDEX IF NOT EXISTS idx_occurrences_issue ON public.issue_occurrences(issue_id);
CREATE INDEX IF NOT EXISTS idx_occurrences_run ON public.issue_occurrences(test_run_id);
CREATE INDEX IF NOT EXISTS idx_occurrences_project ON public.issue_occurrences(project_id);
CREATE INDEX IF NOT EXISTS idx_occurrences_fingerprint ON public.issue_occurrences(fingerprint);

-- 3. Enable RLS on issue_occurrences
ALTER TABLE public.issue_occurrences ENABLE ROW LEVEL SECURITY;

-- Read policy: Organization members or project owners can view occurrences
CREATE POLICY "Occurrences read by organization members" ON public.issue_occurrences
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_memberships
      WHERE clerk_user_id = auth.clerk_user_id()
    ) OR
    (organization_id IS NULL AND project_id IN (
      SELECT id FROM public.projects WHERE clerk_user_id = auth.clerk_user_id()
    ))
  );

-- Service role full access policy
CREATE POLICY "Service role full access on occurrences" ON public.issue_occurrences
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
