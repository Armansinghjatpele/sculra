-- ==============================================================================
-- Sculra TEST EVIDENCE & TEST RUN UPDATE MIGRATION
-- (supabase/migrations/20260907000000_test_evidence.sql)
-- Defines test_evidence table, indexes, and RLS policies.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Create test_evidence table
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.test_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_run_id uuid REFERENCES public.test_runs(id) ON DELETE CASCADE NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN ('screenshot', 'console_error', 'network_error', 'dom_snapshot', 'navigation')),
  title text NOT NULL,
  url text,
  message text,
  metadata jsonb,
  storage_path text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- ------------------------------------------------------------------------------
-- 2. Indexes for fast retrieval by test run, project, and type
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_test_evidence_run ON public.test_evidence(test_run_id);
CREATE INDEX IF NOT EXISTS idx_test_evidence_project ON public.test_evidence(project_id);
CREATE INDEX IF NOT EXISTS idx_test_evidence_type ON public.test_evidence(type);

-- ------------------------------------------------------------------------------
-- 3. Row Level Security Policies for test_evidence
-- ------------------------------------------------------------------------------
ALTER TABLE public.test_evidence ENABLE ROW LEVEL SECURITY;

-- Allow members to view test evidence belonging to their org or personal projects
CREATE POLICY "Members can view test evidence" ON public.test_evidence
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = test_evidence.project_id
      AND (
        (p.organization_id IS NOT NULL AND public.is_org_member(p.organization_id))
        OR
        (p.organization_id IS NULL AND p.created_by = (auth.jwt() ->> 'sub'))
      )
    )
  );

-- Allow inserting test evidence for authorized projects
CREATE POLICY "Members can insert test evidence" ON public.test_evidence
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = test_evidence.project_id
      AND (
        (p.organization_id IS NOT NULL AND public.is_org_member(p.organization_id))
        OR
        (p.organization_id IS NULL AND p.created_by = (auth.jwt() ->> 'sub'))
      )
    )
  );

-- Allow deleting test evidence for authorized projects
CREATE POLICY "Members can delete test evidence" ON public.test_evidence
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = test_evidence.project_id
      AND (
        (p.organization_id IS NOT NULL AND public.is_org_member(p.organization_id))
        OR
        (p.organization_id IS NULL AND p.created_by = (auth.jwt() ->> 'sub'))
      )
    )
  );

-- ------------------------------------------------------------------------------
-- 4. Enable test_runs UPDATE policy for user-driven actions (e.g. cancellation)
-- ------------------------------------------------------------------------------
CREATE POLICY "Members can update test runs" ON public.test_runs
  FOR UPDATE USING (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND created_by = (auth.jwt() ->> 'sub'))
  );
