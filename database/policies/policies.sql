-- ==============================================================================
-- Sculra Database Security Policies (policies.sql)
-- ==============================================================================
-- This file configures Row Level Security (RLS) for multi-tenant isolation.
-- Every table containing tenant metadata must have RLS enabled.

-- Enable RLS on core tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bugs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 1. Users RLS Policies
-- ------------------------------------------------------------------------------
CREATE POLICY "Users can read and update their own profile records"
ON public.users
FOR ALL
USING (auth.uid() = id);

-- ------------------------------------------------------------------------------
-- 2. Organizations RLS Policies
-- ------------------------------------------------------------------------------
CREATE POLICY "Users can read organizations they belong to"
ON public.organizations
FOR SELECT
USING (
    id IN (
        SELECT organization_id FROM public.members
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Owners can update organization settings"
ON public.organizations
FOR UPDATE
USING (
    id IN (
        SELECT organization_id FROM public.members
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
);

-- ------------------------------------------------------------------------------
-- 3. Projects RLS Policies
-- ------------------------------------------------------------------------------
CREATE POLICY "Members can view projects in their organization"
ON public.projects
FOR SELECT
USING (
    organization_id IN (
        SELECT organization_id FROM public.members
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Admins and Owners can insert/update projects"
ON public.projects
FOR ALL
USING (
    organization_id IN (
        SELECT organization_id FROM public.members
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
);

