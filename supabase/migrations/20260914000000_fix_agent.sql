-- ==============================================================================
-- Sculra Autonomous Safe Fix Agent & Code Remediation Migration
-- Migration: 20260914000000_fix_agent.sql
-- ==============================================================================

-- 1. Add Fix Agent project configuration columns to public.projects
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS fix_agent_enabled BOOLEAN DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS fix_agent_mode TEXT DEFAULT 'PLAN_ONLY' NOT NULL,
  ADD COLUMN IF NOT EXISTS fix_agent_allowed_branches JSONB DEFAULT '["main", "master", "develop"]'::jsonb NOT NULL,
  ADD COLUMN IF NOT EXISTS fix_agent_max_files INTEGER DEFAULT 10 NOT NULL,
  ADD COLUMN IF NOT EXISTS fix_agent_max_diff_lines INTEGER DEFAULT 500 NOT NULL,
  ADD COLUMN IF NOT EXISTS fix_agent_max_test_commands INTEGER DEFAULT 5 NOT NULL,
  ADD COLUMN IF NOT EXISTS fix_agent_allow_dependency_changes BOOLEAN DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS fix_agent_allow_config_changes BOOLEAN DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS fix_agent_allow_database_changes BOOLEAN DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS fix_agent_allow_auth_changes BOOLEAN DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS fix_agent_allow_security_sensitive_changes BOOLEAN DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS fix_agent_require_pr BOOLEAN DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS fix_agent_auto_verify BOOLEAN DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS fix_agent_allowed_paths JSONB DEFAULT '["src/**", "app/**", "pages/**", "components/**", "lib/**"]'::jsonb NOT NULL,
  ADD COLUMN IF NOT EXISTS fix_agent_blocked_paths JSONB DEFAULT '[".env*", "**/.env*", "**/secrets/**", "**/*.pem", "**/*.key", "**/credentials/**", "supabase/config.toml", ".github/workflows/**", "package-lock.json", "pnpm-lock.yaml"]'::jsonb NOT NULL;

-- Constraint on fix_agent_mode
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_projects_fix_agent_mode'
  ) THEN
    ALTER TABLE public.projects
      ADD CONSTRAINT check_projects_fix_agent_mode
      CHECK (fix_agent_mode IN ('PLAN_ONLY', 'DRY_RUN', 'APPLY_AND_VERIFY', 'CREATE_PR'));
  END IF;
END $$;

-- 2. Create public.fix_remediations table
CREATE TABLE IF NOT EXISTS public.fix_remediations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  issue_id UUID REFERENCES public.issues(id) ON DELETE CASCADE NOT NULL,
  test_run_id UUID REFERENCES public.test_runs(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES public.qa_campaigns(id) ON DELETE SET NULL,
  diagnosis_id UUID REFERENCES public.issue_remediation_analyses(id) ON DELETE SET NULL,
  fix_plan_id TEXT,
  requester_user_id TEXT NOT NULL,
  source_commit_sha TEXT NOT NULL,
  target_branch TEXT NOT NULL DEFAULT 'main',
  remediation_branch TEXT,
  mode TEXT NOT NULL CHECK (mode IN ('PLAN_ONLY', 'DRY_RUN', 'APPLY_AND_VERIFY', 'CREATE_PR')),
  status TEXT NOT NULL CHECK (status IN (
    'REQUESTED',
    'AUTHORIZED',
    'DIAGNOSIS_VALIDATED',
    'CONTEXT_COLLECTED',
    'PATCH_GENERATED',
    'PATCH_VALIDATED',
    'WORKSPACE_CREATED',
    'BASELINE_VERIFIED',
    'PATCH_APPLIED',
    'DIFF_REVIEWED',
    'VERIFICATION_RUNNING',
    'VERIFIED',
    'FAILED',
    'ROLLED_BACK',
    'BRANCH_CREATED',
    'PR_CREATED',
    'CANCELLED',
    'BLOCKED'
  )),
  baseline_status TEXT CHECK (baseline_status IN (
    'BASELINE_REPRODUCED',
    'BASELINE_NOT_REPRODUCED',
    'BASELINE_INCONCLUSIVE',
    'SKIPPED'
  )),
  verification_status TEXT CHECK (verification_status IN (
    'VERIFIED_FIXED',
    'VERIFIED_NOT_FIXED',
    'PARTIALLY_VERIFIED',
    'VERIFICATION_FAILED',
    'VERIFICATION_TIMEOUT',
    'INCONCLUSIVE',
    'BLOCKED',
    'CANCELLED'
  )),
  changed_files JSONB DEFAULT '[]'::jsonb NOT NULL,
  changed_lines INTEGER DEFAULT 0 NOT NULL,
  test_commands JSONB DEFAULT '[]'::jsonb NOT NULL,
  verification_summary JSONB DEFAULT '{}'::jsonb NOT NULL,
  diff_summary JSONB DEFAULT '{}'::jsonb NOT NULL,
  patch_data JSONB DEFAULT '{}'::jsonb NOT NULL,
  error_code TEXT,
  error_message TEXT,
  pr_number INTEGER,
  pr_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  completed_at TIMESTAMPTZ
);

-- 3. Optimization indexes for fix_remediations
CREATE INDEX IF NOT EXISTS idx_fix_remediations_project
  ON public.fix_remediations(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fix_remediations_issue
  ON public.fix_remediations(issue_id);

CREATE INDEX IF NOT EXISTS idx_fix_remediations_campaign
  ON public.fix_remediations(campaign_id);

CREATE INDEX IF NOT EXISTS idx_fix_remediations_status
  ON public.fix_remediations(status);

CREATE INDEX IF NOT EXISTS idx_fix_remediations_org
  ON public.fix_remediations(organization_id);

-- 4. Create public.fix_evidence table
CREATE TABLE IF NOT EXISTS public.fix_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  remediation_id UUID REFERENCES public.fix_remediations(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    'baseline_reproduction',
    'patch_generated',
    'patch_applied',
    'diff_review',
    'test_result',
    'verification_result',
    'rollback',
    'pr_created',
    'policy_blocked',
    'audit_event'
  )),
  summary TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index for fix_evidence
CREATE INDEX IF NOT EXISTS idx_fix_evidence_remediation
  ON public.fix_evidence(remediation_id, created_at ASC);

-- 5. Enable Row Level Security
ALTER TABLE public.fix_remediations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fix_evidence ENABLE ROW LEVEL SECURITY;

-- Read policy: Org members or personal project owners
CREATE POLICY "Fix remediations read by org members or owners" ON public.fix_remediations
  FOR SELECT USING (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND project_id IN (
      SELECT id FROM public.projects WHERE created_by = (auth.jwt() ->> 'sub')
    ))
  );

CREATE POLICY "Fix evidence read by org members or owners" ON public.fix_evidence
  FOR SELECT USING (
    remediation_id IN (
      SELECT id FROM public.fix_remediations WHERE
        (organization_id IS NOT NULL AND public.is_org_member(organization_id))
        OR
        (organization_id IS NULL AND project_id IN (
          SELECT id FROM public.projects WHERE created_by = (auth.jwt() ->> 'sub')
        ))
    )
  );

-- Insert policy: Org members or project owners
CREATE POLICY "Fix remediations insert by org members or owners" ON public.fix_remediations
  FOR INSERT WITH CHECK (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND project_id IN (
      SELECT id FROM public.projects WHERE created_by = (auth.jwt() ->> 'sub')
    ))
  );

CREATE POLICY "Fix evidence insert by org members or owners" ON public.fix_evidence
  FOR INSERT WITH CHECK (
    remediation_id IN (
      SELECT id FROM public.fix_remediations WHERE
        (organization_id IS NOT NULL AND public.is_org_member(organization_id))
        OR
        (organization_id IS NULL AND project_id IN (
          SELECT id FROM public.projects WHERE created_by = (auth.jwt() ->> 'sub')
        ))
    )
  );

-- Update policy: Org members or project owners
CREATE POLICY "Fix remediations update by org members or owners" ON public.fix_remediations
  FOR UPDATE USING (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND project_id IN (
      SELECT id FROM public.projects WHERE created_by = (auth.jwt() ->> 'sub')
    ))
  );

-- Service role full access
CREATE POLICY "Fix remediations service role full access" ON public.fix_remediations
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Fix evidence service role full access" ON public.fix_evidence
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
