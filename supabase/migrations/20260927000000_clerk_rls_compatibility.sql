-- ==============================================================================
-- Sculra Clerk RLS Compatibility & Production Authorization Migration
-- Migration: 20260927000000_clerk_rls_compatibility.sql
-- ==============================================================================
-- Remediates PostgreSQL 22P02 UUID casting errors when authenticated Clerk users
-- interact with tables whose RLS policies previously invoked auth.uid()::text.
-- Supabase's internal auth.uid() function returns UUID and fails when Clerk JWT sub
-- is a string (e.g. user_2...). Replaces auth.uid()::text with public.clerk_user_id()
-- while preserving all existing organization isolation, project ownership, role,
-- and service-role invariants.

-- ------------------------------------------------------------------------------
-- 1. public.credential_records Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view credential records for their organization" ON public.credential_records;
CREATE POLICY "Users can view credential records for their organization"
  ON public.credential_records
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_memberships
      WHERE clerk_user_id = public.clerk_user_id()
    )
    OR
    (project_id IS NOT NULL AND project_id IN (
      SELECT id FROM public.projects
      WHERE organization_id IN (
        SELECT organization_id FROM public.organization_memberships
        WHERE clerk_user_id = public.clerk_user_id()
      )
    ))
  );

DROP POLICY IF EXISTS "Owners and Admins can create credential records" ON public.credential_records;
CREATE POLICY "Owners and Admins can create credential records"
  ON public.credential_records
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_memberships
      WHERE clerk_user_id = public.clerk_user_id()
        AND LOWER(role) IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "Owners and Admins can update credential records" ON public.credential_records;
CREATE POLICY "Owners and Admins can update credential records"
  ON public.credential_records
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_memberships
      WHERE clerk_user_id = public.clerk_user_id()
        AND LOWER(role) IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "Owners and Admins can delete credential records" ON public.credential_records;
CREATE POLICY "Owners and Admins can delete credential records"
  ON public.credential_records
  FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_memberships
      WHERE clerk_user_id = public.clerk_user_id()
        AND LOWER(role) IN ('owner', 'admin')
    )
  );

-- ------------------------------------------------------------------------------
-- 2. public.credential_access_logs Policy
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins and Owners can view credential access logs" ON public.credential_access_logs;
CREATE POLICY "Admins and Owners can view credential access logs"
  ON public.credential_access_logs
  FOR SELECT
  USING (
    credential_id IN (
      SELECT id FROM public.credential_records
      WHERE organization_id IN (
        SELECT organization_id FROM public.organization_memberships
        WHERE clerk_user_id = public.clerk_user_id()
          AND LOWER(role) IN ('owner', 'admin')
      )
    )
  );

-- ------------------------------------------------------------------------------
-- 3. public.credential_rotations Policy
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins and Owners can view credential rotations" ON public.credential_rotations;
CREATE POLICY "Admins and Owners can view credential rotations"
  ON public.credential_rotations
  FOR SELECT
  USING (
    credential_id IN (
      SELECT id FROM public.credential_records
      WHERE organization_id IN (
        SELECT organization_id FROM public.organization_memberships
        WHERE clerk_user_id = public.clerk_user_id()
          AND LOWER(role) IN ('owner', 'admin')
      )
    )
  );

-- ------------------------------------------------------------------------------
-- 4. public.project_environments Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view environments in their workspace" ON public.project_environments;
CREATE POLICY "Users can view environments in their workspace"
  ON public.project_environments
  FOR SELECT
  USING (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND project_id IN (
      SELECT id FROM public.projects WHERE created_by = public.clerk_user_id()
    ))
  );

DROP POLICY IF EXISTS "Authorized users can insert environments" ON public.project_environments;
CREATE POLICY "Authorized users can insert environments"
  ON public.project_environments
  FOR INSERT
  WITH CHECK (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND project_id IN (
      SELECT id FROM public.projects WHERE created_by = public.clerk_user_id()
    ))
  );

DROP POLICY IF EXISTS "Authorized users can update environments" ON public.project_environments;
CREATE POLICY "Authorized users can update environments"
  ON public.project_environments
  FOR UPDATE
  USING (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND project_id IN (
      SELECT id FROM public.projects WHERE created_by = public.clerk_user_id()
    ))
  );

DROP POLICY IF EXISTS "Owners and admins can delete environments" ON public.project_environments;
CREATE POLICY "Owners and admins can delete environments"
  ON public.project_environments
  FOR DELETE
  USING (
    (organization_id IS NOT NULL AND public.is_org_owner_or_admin(organization_id))
    OR
    (organization_id IS NULL AND project_id IN (
      SELECT id FROM public.projects WHERE created_by = public.clerk_user_id()
    ))
  );

-- ------------------------------------------------------------------------------
-- 5. public.deployments Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view deployments in their workspace" ON public.deployments;
CREATE POLICY "Users can view deployments in their workspace"
  ON public.deployments
  FOR SELECT
  USING (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND project_id IN (
      SELECT id FROM public.projects WHERE created_by = public.clerk_user_id()
    ))
  );

DROP POLICY IF EXISTS "Authorized users can insert deployments" ON public.deployments;
CREATE POLICY "Authorized users can insert deployments"
  ON public.deployments
  FOR INSERT
  WITH CHECK (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND project_id IN (
      SELECT id FROM public.projects WHERE created_by = public.clerk_user_id()
    ))
  );

DROP POLICY IF EXISTS "Authorized users can update deployments" ON public.deployments;
CREATE POLICY "Authorized users can update deployments"
  ON public.deployments
  FOR UPDATE
  USING (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND project_id IN (
      SELECT id FROM public.projects WHERE created_by = public.clerk_user_id()
    ))
  );

-- ------------------------------------------------------------------------------
-- 6. public.releases Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view releases in their workspace" ON public.releases;
CREATE POLICY "Users can view releases in their workspace"
  ON public.releases
  FOR SELECT
  USING (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND project_id IN (
      SELECT id FROM public.projects WHERE created_by = public.clerk_user_id()
    ))
  );

DROP POLICY IF EXISTS "Authorized users can insert releases" ON public.releases;
CREATE POLICY "Authorized users can insert releases"
  ON public.releases
  FOR INSERT
  WITH CHECK (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND project_id IN (
      SELECT id FROM public.projects WHERE created_by = public.clerk_user_id()
    ))
  );

DROP POLICY IF EXISTS "Authorized users can update releases" ON public.releases;
CREATE POLICY "Authorized users can update releases"
  ON public.releases
  FOR UPDATE
  USING (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND project_id IN (
      SELECT id FROM public.projects WHERE created_by = public.clerk_user_id()
    ))
  );

-- ------------------------------------------------------------------------------
-- 7. public.release_checks Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view release checks in their workspace" ON public.release_checks;
CREATE POLICY "Users can view release checks in their workspace"
  ON public.release_checks
  FOR SELECT
  USING (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND project_id IN (
      SELECT id FROM public.projects WHERE created_by = public.clerk_user_id()
    ))
  );

DROP POLICY IF EXISTS "Authorized users can insert release checks" ON public.release_checks;
CREATE POLICY "Authorized users can insert release checks"
  ON public.release_checks
  FOR INSERT
  WITH CHECK (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND project_id IN (
      SELECT id FROM public.projects WHERE created_by = public.clerk_user_id()
    ))
  );

DROP POLICY IF EXISTS "Authorized users can update release checks" ON public.release_checks;
CREATE POLICY "Authorized users can update release checks"
  ON public.release_checks
  FOR UPDATE
  USING (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND project_id IN (
      SELECT id FROM public.projects WHERE created_by = public.clerk_user_id()
    ))
  );

-- ------------------------------------------------------------------------------
-- 8. public.release_decisions Policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view release decisions in their workspace" ON public.release_decisions;
CREATE POLICY "Users can view release decisions in their workspace"
  ON public.release_decisions
  FOR SELECT
  USING (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND project_id IN (
      SELECT id FROM public.projects WHERE created_by = public.clerk_user_id()
    ))
  );

DROP POLICY IF EXISTS "Authorized users can record release decisions" ON public.release_decisions;
CREATE POLICY "Authorized users can record release decisions"
  ON public.release_decisions
  FOR INSERT
  WITH CHECK (
    (organization_id IS NOT NULL AND public.is_org_member(organization_id))
    OR
    (organization_id IS NULL AND project_id IN (
      SELECT id FROM public.projects WHERE created_by = public.clerk_user_id()
    ))
  );
