-- ==============================================================================
-- Sculra Secure Integration & Credential Management Vault Migration
-- Migration: 20260923000000_credentials_vault.sql
-- ==============================================================================

-- 1. Create public.credential_records table (Safe Non-Sensitive Metadata Only)
CREATE TABLE IF NOT EXISTS public.credential_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN (
    'GITHUB',
    'OPENAI',
    'GENERIC_HTTP',
    'CI_WEBHOOK',
    'PROJECT_SOURCE',
    'ENVIRONMENT_AUTH'
  )),
  credential_type TEXT NOT NULL CHECK (credential_type IN (
    'API_KEY',
    'BEARER_TOKEN',
    'BASIC_AUTH',
    'OAUTH_TOKEN',
    'GITHUB_TOKEN',
    'WEBHOOK_SECRET',
    'OPENAI_API_KEY',
    'CUSTOM_SECRET'
  )),
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN (
    'ACTIVE',
    'INVALID',
    'EXPIRED',
    'REVOKED',
    'PENDING_VALIDATION',
    'VALIDATION_FAILED'
  )),
  scope TEXT NOT NULL DEFAULT 'READ_ONLY' CHECK (scope IN (
    'READ_ONLY',
    'READ_WRITE',
    'ADMIN',
    'EXECUTION_ONLY',
    'WEBHOOK_VERIFY'
  )),
  expires_at TIMESTAMPTZ,
  last_validated_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_by TEXT, -- Clerk user ID
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  version INTEGER DEFAULT 1 NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb NOT NULL
);

-- Optimization indexes for credential_records
CREATE INDEX IF NOT EXISTS idx_credential_records_org
  ON public.credential_records(organization_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_credential_records_project
  ON public.credential_records(project_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_credential_records_provider
  ON public.credential_records(provider);

CREATE INDEX IF NOT EXISTS idx_credential_records_status
  ON public.credential_records(status);

-- 2. Create public.credential_secrets table (Encrypted Material & Cryptographic Envelope Only)
CREATE TABLE IF NOT EXISTS public.credential_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id UUID NOT NULL REFERENCES public.credential_records(id) ON DELETE CASCADE UNIQUE,
  encrypted_data TEXT NOT NULL,
  iv TEXT NOT NULL,
  auth_tag TEXT NOT NULL,
  key_version TEXT NOT NULL DEFAULT 'v1',
  algorithm TEXT NOT NULL DEFAULT 'AES-256-GCM',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Optimization index for credential_secrets
CREATE INDEX IF NOT EXISTS idx_credential_secrets_cred
  ON public.credential_secrets(credential_id);

CREATE INDEX IF NOT EXISTS idx_credential_secrets_key_ver
  ON public.credential_secrets(key_version);

-- 3. Create public.credential_access_logs table (Immutable Audit Trail - Zero Secrets)
CREATE TABLE IF NOT EXISTS public.credential_access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id UUID NOT NULL REFERENCES public.credential_records(id) ON DELETE CASCADE,
  actor_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  service_identity TEXT NOT NULL,
  purpose TEXT NOT NULL,
  provider TEXT NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('SUCCESS', 'DENIED', 'FAILED')),
  correlation_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
  accessed_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_credential_access_logs_cred
  ON public.credential_access_logs(credential_id, accessed_at DESC);

CREATE INDEX IF NOT EXISTS idx_credential_access_logs_corr
  ON public.credential_access_logs(correlation_id);

-- 4. Create public.credential_rotations table (Cryptographic Key Version Rotation Tracking)
CREATE TABLE IF NOT EXISTS public.credential_rotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credential_id UUID NOT NULL REFERENCES public.credential_records(id) ON DELETE CASCADE,
  old_key_version TEXT NOT NULL,
  new_key_version TEXT NOT NULL,
  initiated_by TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED')),
  failure_code TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_credential_rotations_cred
  ON public.credential_rotations(credential_id, created_at DESC);

-- 5. Extend public.project_environments with credential reference
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'project_environments' AND column_name = 'credential_id'
  ) THEN
    ALTER TABLE public.project_environments
      ADD COLUMN credential_id UUID REFERENCES public.credential_records(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 6. Row Level Security Policies (Enterprise Multi-Tenant Isolation)
ALTER TABLE public.credential_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credential_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credential_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credential_rotations ENABLE ROW LEVEL SECURITY;

-- credential_records policies: Org members can view safe metadata; mutations restricted
CREATE POLICY "Users can view credential records for their organization"
  ON public.credential_records
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()::text
    )
    OR
    (project_id IS NOT NULL AND project_id IN (
      SELECT id FROM public.projects
      WHERE organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid()::text
      )
    ))
  );

CREATE POLICY "Owners and Admins can create credential records"
  ON public.credential_records
  FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()::text AND role IN ('OWNER', 'ADMIN')
    )
  );

CREATE POLICY "Owners and Admins can update credential records"
  ON public.credential_records
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()::text AND role IN ('OWNER', 'ADMIN')
    )
  );

CREATE POLICY "Owners and Admins can delete credential records"
  ON public.credential_records
  FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid()::text AND role IN ('OWNER', 'ADMIN')
    )
  );

-- credential_secrets policies:
-- STRICT ISOLATION: NEVER selectable by normal client sessions.
-- Only service_role can access encrypted secret envelopes.
CREATE POLICY "Service role only access for credential secrets"
  ON public.credential_secrets
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- credential_access_logs policies
CREATE POLICY "Admins and Owners can view credential access logs"
  ON public.credential_access_logs
  FOR SELECT
  USING (
    credential_id IN (
      SELECT id FROM public.credential_records
      WHERE organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid()::text AND role IN ('OWNER', 'ADMIN')
      )
    )
  );

CREATE POLICY "Service role can insert credential access logs"
  ON public.credential_access_logs
  FOR INSERT
  WITH CHECK (true);

-- credential_rotations policies
CREATE POLICY "Admins and Owners can view credential rotations"
  ON public.credential_rotations
  FOR SELECT
  USING (
    credential_id IN (
      SELECT id FROM public.credential_records
      WHERE organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid()::text AND role IN ('OWNER', 'ADMIN')
      )
    )
  );

CREATE POLICY "Service role can manage credential rotations"
  ON public.credential_rotations
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
