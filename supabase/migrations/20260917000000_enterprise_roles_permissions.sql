-- ==============================================================================
-- Sculra ENTERPRISE ROLES & PERMISSION CONTROL PLANE MIGRATION
-- (supabase/migrations/20260917000000_enterprise_roles_permissions.sql)
-- Enhances organization memberships with 5-role model, membership statuses,
-- owner safety helpers, and hardened Row Level Security.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Alter public.organization_memberships table
-- ------------------------------------------------------------------------------

-- Update role check constraint to support 5 canonical roles:
-- owner, admin, qa_lead, developer, viewer
ALTER TABLE public.organization_memberships 
  DROP CONSTRAINT IF EXISTS organization_memberships_role_check;

-- Note: map existing 'member' rows to 'developer' if any exist
UPDATE public.organization_memberships
  SET role = 'developer'
  WHERE role = 'member';

ALTER TABLE public.organization_memberships
  ADD CONSTRAINT organization_memberships_role_check 
  CHECK (role IN ('owner', 'admin', 'qa_lead', 'developer', 'viewer'));

-- Add membership status: active, invited, suspended, removed
ALTER TABLE public.organization_memberships
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active' 
  CHECK (status IN ('active', 'invited', 'suspended', 'removed'));

-- Add invitation metadata and last active timestamp
ALTER TABLE public.organization_memberships
  ADD COLUMN IF NOT EXISTS invited_by text;

ALTER TABLE public.organization_memberships
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz;

-- Composite index for fast membership lookup by organization, user, and status
CREATE INDEX IF NOT EXISTS idx_memberships_org_user_status 
  ON public.organization_memberships(organization_id, clerk_user_id, status);

CREATE INDEX IF NOT EXISTS idx_memberships_org_role 
  ON public.organization_memberships(organization_id, role);

-- ------------------------------------------------------------------------------
-- 2. Security Definer Helper Functions
-- ------------------------------------------------------------------------------

-- Enhanced is_org_member: requires status = 'active'
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
    AND status = 'active'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_org_member(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid) TO authenticated;

-- Helper to retrieve caller's role inside the target organization
CREATE OR REPLACE FUNCTION public.get_org_role(target_org_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role
  FROM public.organization_memberships
  WHERE organization_id = target_org_id
  AND clerk_user_id = (auth.jwt() ->> 'sub')
  AND status = 'active'
  LIMIT 1;

  RETURN v_role;
END;
$$;

REVOKE ALL ON FUNCTION public.get_org_role(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_org_role(uuid) TO authenticated;

-- Helper to verify caller is owner or admin in the target organization
CREATE OR REPLACE FUNCTION public.is_org_owner_or_admin(target_org_id uuid)
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
    AND role IN ('owner', 'admin')
    AND status = 'active'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_org_owner_or_admin(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.is_org_owner_or_admin(uuid) TO authenticated;

-- ------------------------------------------------------------------------------
-- 3. Hardened Row Level Security for Organization Memberships
-- ------------------------------------------------------------------------------

DROP POLICY IF EXISTS "Members can view memberships" ON public.organization_memberships;
DROP POLICY IF EXISTS "Admins can insert memberships" ON public.organization_memberships;
DROP POLICY IF EXISTS "Admins can update memberships" ON public.organization_memberships;
DROP POLICY IF EXISTS "Admins can delete memberships" ON public.organization_memberships;

-- Read: active members can view memberships of their own organization
CREATE POLICY "Members can view memberships" ON public.organization_memberships
  FOR SELECT USING (public.is_org_member(organization_id));

-- Write / Insert: Only Owners or Admins can add members
CREATE POLICY "Admins can insert memberships" ON public.organization_memberships
  FOR INSERT WITH CHECK (public.is_org_owner_or_admin(organization_id));

-- Update: Only Owners or Admins can update memberships
CREATE POLICY "Admins can update memberships" ON public.organization_memberships
  FOR UPDATE USING (public.is_org_owner_or_admin(organization_id));

-- Delete / Remove: Only Owners or Admins can remove memberships
CREATE POLICY "Admins can delete memberships" ON public.organization_memberships
  FOR DELETE USING (public.is_org_owner_or_admin(organization_id));
