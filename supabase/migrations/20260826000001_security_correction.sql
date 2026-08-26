-- ==============================================================================
-- Sculra SECURITY CORRECTION MIGRATIONS (supabase/migrations/20260826000001_security_correction.sql)
-- Redesigns RLS policies to eliminate recursion and configure Clerk Third-Party Auth compatibility.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Helper function to check organization membership (SECURITY DEFINER to prevent RLS recursion)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_org_member(target_org_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.organization_memberships
    WHERE organization_id = target_org_id
    AND clerk_user_id = (auth.jwt() ->> 'sub')
  );
END;
$$;

-- Grant execute permissions on the security helper function
REVOKE ALL ON FUNCTION public.is_org_member(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid) TO authenticated;

-- ------------------------------------------------------------------------------
-- 2. Refactor Profiles RLS Policies (Profile Privacy constraint)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Profiles read to authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "Users can edit own profile" ON public.profiles;

CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT USING (clerk_user_id = (auth.jwt() ->> 'sub'));

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (clerk_user_id = (auth.jwt() ->> 'sub'));

-- ------------------------------------------------------------------------------
-- 3. Refactor Memberships RLS Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Members can view memberships" ON public.organization_memberships;

CREATE POLICY "Members can view memberships" ON public.organization_memberships
  FOR SELECT USING (public.is_org_member(organization_id));

-- ------------------------------------------------------------------------------
-- 4. Refactor Projects RLS Policies (Project Ownership constraint)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Members can query projects" ON public.projects;
DROP POLICY IF EXISTS "Members can write projects" ON public.projects;
DROP POLICY IF EXISTS "Members can update own projects" ON public.projects;
DROP POLICY IF EXISTS "Members can delete own projects" ON public.projects;

CREATE POLICY "Members can query projects" ON public.projects
  FOR SELECT USING (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND created_by = (auth.jwt() ->> 'sub'))
  );

CREATE POLICY "Members can write projects" ON public.projects
  FOR INSERT WITH CHECK (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id) AND (
      EXISTS (
        SELECT 1 FROM public.organizations o
        WHERE o.id = projects.organization_id
        AND o.clerk_organization_id = (auth.jwt() ->> 'org_id')
      )
    ))
    OR
    (organization_id IS NULL AND created_by = (auth.jwt() ->> 'sub'))
  );

CREATE POLICY "Members can update own projects" ON public.projects
  FOR UPDATE USING (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND created_by = (auth.jwt() ->> 'sub'))
  );

CREATE POLICY "Members can delete own projects" ON public.projects
  FOR DELETE USING (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND created_by = (auth.jwt() ->> 'sub'))
  );

-- ------------------------------------------------------------------------------
-- 5. Refactor Test Runs RLS Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Members can view test runs" ON public.test_runs;
DROP POLICY IF EXISTS "Members can insert test runs" ON public.test_runs;

CREATE POLICY "Members can view test runs" ON public.test_runs
  FOR SELECT USING (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND created_by = (auth.jwt() ->> 'sub'))
  );

CREATE POLICY "Members can insert test runs" ON public.test_runs
  FOR INSERT WITH CHECK (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND created_by = (auth.jwt() ->> 'sub'))
  );

-- ------------------------------------------------------------------------------
-- 6. Refactor Issues RLS Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Members can view issues" ON public.issues;

CREATE POLICY "Members can view issues" ON public.issues
  FOR SELECT USING (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = issues.project_id
      AND p.created_by = (auth.jwt() ->> 'sub')
    ))
  );

-- ------------------------------------------------------------------------------
-- 7. Refactor Reports RLS Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Members can view reports" ON public.reports;

CREATE POLICY "Members can view reports" ON public.reports
  FOR SELECT USING (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = reports.project_id
      AND p.created_by = (auth.jwt() ->> 'sub')
    ))
  );

-- ------------------------------------------------------------------------------
-- 8. Refactor Release Scores RLS Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Members can view scores" ON public.release_scores;

CREATE POLICY "Members can view scores" ON public.release_scores
  FOR SELECT USING (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = release_scores.project_id
      AND p.created_by = (auth.jwt() ->> 'sub')
    ))
  );

-- ------------------------------------------------------------------------------
-- 9. Refactor AI Insights RLS Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Members can view AI insights" ON public.ai_insights;

CREATE POLICY "Members can view AI insights" ON public.ai_insights
  FOR SELECT USING (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = ai_insights.project_id
      AND p.created_by = (auth.jwt() ->> 'sub')
    ))
  );

-- ------------------------------------------------------------------------------
-- 10. Refactor Activity Events RLS Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Members can view activity feed" ON public.activity_events;

CREATE POLICY "Members can view activity feed" ON public.activity_events
  FOR SELECT USING (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND clerk_user_id = (auth.jwt() ->> 'sub'))
  );
