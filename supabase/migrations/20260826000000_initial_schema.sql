-- ==============================================================================
-- Sculra INITIAL SCHEMAS MIGRATIONS (supabase/migrations/20260826000000_initial_schema.sql)
-- Defines multi-tenant tables, indexes, and strict Row Level Security policies.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Helper Functions to extract Clerk session details from request claims JWT
-- ------------------------------------------------------------------------------

-- Retrieve active Clerk Organization ID. Returns null if in a Personal Workspace context.
CREATE OR REPLACE FUNCTION auth.org_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'org_id', ''),
    nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'orgId', '')
  );
$$;

-- Retrieve active Clerk User ID.
CREATE OR REPLACE FUNCTION auth.clerk_user_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT current_setting('request.jwt.claims', true)::jsonb ->> 'sub';
$$;

-- ------------------------------------------------------------------------------
-- 2. Core Relational Tables
-- ------------------------------------------------------------------------------

-- Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id text UNIQUE NOT NULL,
  display_name text,
  avatar_url text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Organizations
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_organization_id text UNIQUE NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  logo_url text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Organization Memberships
CREATE TABLE IF NOT EXISTS public.organization_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  clerk_user_id text NOT NULL,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT unique_org_user UNIQUE (organization_id, clerk_user_id)
);

-- Projects
CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE, -- Nullable for Personal Workspaces
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  source_type text NOT NULL CHECK (source_type IN ('website', 'github', 'zip', 'desktop', 'api')),
  source_url text,
  repository_url text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  created_by text NOT NULL, -- clerk_user_id
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Test Runs
CREATE TABLE IF NOT EXISTS public.test_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('queued', 'running', 'passed', 'failed', 'cancelled', 'needs_review')),
  trigger_type text NOT NULL CHECK (trigger_type IN ('manual', 'github', 'scheduled', 'api', 'future_ai_agent')),
  started_at timestamptz,
  completed_at timestamptz,
  duration_ms integer,
  overall_score integer CHECK (overall_score >= 0 AND overall_score <= 100),
  created_by text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Issues / Vulnerabilities
CREATE TABLE IF NOT EXISTS public.issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  test_run_id uuid REFERENCES public.test_runs(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  severity text NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  category text NOT NULL CHECK (category IN ('functional', 'visual', 'responsive', 'performance', 'accessibility', 'security', 'ux', 'other')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'ignored')),
  source text,
  url text,
  selector text,
  screenshot_url text,
  metadata jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- PDF Reports
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  test_run_id uuid REFERENCES public.test_runs(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  summary text,
  report_url text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Release Scores History
CREATE TABLE IF NOT EXISTS public.release_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  test_run_id uuid REFERENCES public.test_runs(id) ON DELETE CASCADE NOT NULL,
  overall_score integer NOT NULL,
  functionality_score integer NOT NULL,
  ui_score integer NOT NULL,
  responsive_score integer NOT NULL,
  performance_score integer NOT NULL,
  accessibility_score integer NOT NULL,
  security_score integer NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- AI Insights Diagnostics
CREATE TABLE IF NOT EXISTS public.ai_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  test_run_id uuid REFERENCES public.test_runs(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  severity text NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  category text NOT NULL CHECK (category IN ('functional', 'visual', 'responsive', 'performance', 'accessibility', 'security', 'ux', 'other')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'ignored')),
  metadata jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  clerk_user_id text NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  read_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Activity Events Feed
CREATE TABLE IF NOT EXISTS public.activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  clerk_user_id text NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  metadata jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- ------------------------------------------------------------------------------
-- 3. Optimization Indexes
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_profiles_clerk ON public.profiles(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_orgs_clerk ON public.organizations(clerk_organization_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON public.organization_memberships(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_projects_org ON public.projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_test_runs_org ON public.test_runs(organization_id);
CREATE INDEX IF NOT EXISTS idx_issues_org ON public.issues(organization_id);
CREATE INDEX IF NOT EXISTS idx_issues_project ON public.issues(project_id);
CREATE INDEX IF NOT EXISTS idx_issues_run ON public.issues(test_run_id);
CREATE INDEX IF NOT EXISTS idx_reports_run ON public.reports(test_run_id);
CREATE INDEX IF NOT EXISTS idx_release_scores_run ON public.release_scores(test_run_id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_run ON public.ai_insights(test_run_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_activity_events_org ON public.activity_events(organization_id);

-- ------------------------------------------------------------------------------
-- 4. Timestamp Update Automation Triggers
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_update BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_organizations_update BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_organization_memberships_update BEFORE UPDATE ON public.organization_memberships FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_projects_update BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_test_runs_update BEFORE UPDATE ON public.test_runs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_issues_update BEFORE UPDATE ON public.issues FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_ai_insights_update BEFORE UPDATE ON public.ai_insights FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ------------------------------------------------------------------------------
-- 5. Row Level Security Policies (Enforces Organization & User boundaries)
-- ------------------------------------------------------------------------------

-- Enable RLS across every table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.release_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;

-- Profiles RLS
CREATE POLICY "Profiles read to authenticated users" ON public.profiles
  FOR SELECT USING (auth.clerk_user_id() IS NOT NULL);

CREATE POLICY "Users can edit own profile" ON public.profiles
  FOR ALL USING (clerk_user_id = auth.clerk_user_id());

-- Organizations RLS
CREATE POLICY "Members can read organizations" ON public.organizations
  FOR SELECT USING (
    clerk_organization_id = auth.org_id() OR
    EXISTS (
      SELECT 1 FROM public.organization_memberships m
      WHERE m.organization_id = organizations.id
      AND m.clerk_user_id = auth.clerk_user_id()
    )
  );

-- Organization Memberships RLS
CREATE POLICY "Members can view memberships" ON public.organization_memberships
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.organization_memberships self
      WHERE self.organization_id = organization_memberships.organization_id
      AND self.clerk_user_id = auth.clerk_user_id()
    )
  );

-- Projects RLS
CREATE POLICY "Members can query projects" ON public.projects
  FOR SELECT USING (
    (organization_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.organization_memberships m
      WHERE m.organization_id = projects.organization_id
      AND m.clerk_user_id = auth.clerk_user_id()
    ))
    OR
    (organization_id IS NULL AND created_by = auth.clerk_user_id())
  );

CREATE POLICY "Members can write projects" ON public.projects
  FOR INSERT WITH CHECK (
    (organization_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.organization_memberships m
      WHERE m.organization_id = projects.organization_id
      AND m.clerk_user_id = auth.clerk_user_id()
    ))
    OR
    (organization_id IS NULL AND created_by = auth.clerk_user_id())
  );

CREATE POLICY "Members can update own projects" ON public.projects
  FOR UPDATE USING (
    (organization_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.organization_memberships m
      WHERE m.organization_id = projects.organization_id
      AND m.clerk_user_id = auth.clerk_user_id()
    ))
    OR
    (organization_id IS NULL AND created_by = auth.clerk_user_id())
  );

CREATE POLICY "Members can delete own projects" ON public.projects
  FOR DELETE USING (
    (organization_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.organization_memberships m
      WHERE m.organization_id = projects.organization_id
      AND m.clerk_user_id = auth.clerk_user_id()
    ))
    OR
    (organization_id IS NULL AND created_by = auth.clerk_user_id())
  );

-- Test Runs RLS
CREATE POLICY "Members can view test runs" ON public.test_runs
  FOR SELECT USING (
    (organization_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.organization_memberships m
      WHERE m.organization_id = test_runs.organization_id
      AND m.clerk_user_id = auth.clerk_user_id()
    ))
    OR
    (organization_id IS NULL AND created_by = auth.clerk_user_id())
  );

CREATE POLICY "Members can insert test runs" ON public.test_runs
  FOR INSERT WITH CHECK (
    (organization_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.organization_memberships m
      WHERE m.organization_id = test_runs.organization_id
      AND m.clerk_user_id = auth.clerk_user_id()
    ))
    OR
    (organization_id IS NULL AND created_by = auth.clerk_user_id())
  );

-- Issues RLS
CREATE POLICY "Members can view issues" ON public.issues
  FOR SELECT USING (
    (organization_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.organization_memberships m
      WHERE m.organization_id = issues.organization_id
      AND m.clerk_user_id = auth.clerk_user_id()
    ))
    OR
    (organization_id IS NULL AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = issues.project_id
      AND p.created_by = auth.clerk_user_id()
    ))
  );

-- Reports RLS
CREATE POLICY "Members can view reports" ON public.reports
  FOR SELECT USING (
    (organization_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.organization_memberships m
      WHERE m.organization_id = reports.organization_id
      AND m.clerk_user_id = auth.clerk_user_id()
    ))
    OR
    (organization_id IS NULL AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = reports.project_id
      AND p.created_by = auth.clerk_user_id()
    ))
  );

-- Release Scores RLS
CREATE POLICY "Members can view scores" ON public.release_scores
  FOR SELECT USING (
    (organization_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.organization_memberships m
      WHERE m.organization_id = release_scores.organization_id
      AND m.clerk_user_id = auth.clerk_user_id()
    ))
    OR
    (organization_id IS NULL AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = release_scores.project_id
      AND p.created_by = auth.clerk_user_id()
    ))
  );

-- AI Insights RLS
CREATE POLICY "Members can view AI insights" ON public.ai_insights
  FOR SELECT USING (
    (organization_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.organization_memberships m
      WHERE m.organization_id = ai_insights.organization_id
      AND m.clerk_user_id = auth.clerk_user_id()
    ))
    OR
    (organization_id IS NULL AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = ai_insights.project_id
      AND p.created_by = auth.clerk_user_id()
    ))
  );

-- Notifications RLS
CREATE POLICY "Users can query notifications" ON public.notifications
  FOR SELECT USING (clerk_user_id = auth.clerk_user_id());

-- Activity Events RLS
CREATE POLICY "Members can view activity feed" ON public.activity_events
  FOR SELECT USING (
    (organization_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.organization_memberships m
      WHERE m.organization_id = activity_events.organization_id
      AND m.clerk_user_id = auth.clerk_user_id()
    ))
    OR
    (organization_id IS NULL AND clerk_user_id = auth.clerk_user_id())
  );
