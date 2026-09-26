-- ==============================================================================
-- Sculra Production Security & Data Integrity Remediation Migration
-- Migration: 20260926000000_security_and_data_integrity_fixes.sql
-- ==============================================================================
-- Remediates critical RLS policy flaws in credential_access_logs and notifications,
-- explicitly restricting INSERT access to service_role with verified JWT role claims.
-- Also hardens SECURITY DEFINER queue stored procedures with search_path protection.

-- 1. Secure public.credential_access_logs INSERT policy
-- Drop existing overly permissive policy that used WITH CHECK (true) without role restriction
DROP POLICY IF EXISTS "Service role can insert credential access logs" ON public.credential_access_logs;

-- Recreate policy strictly restricted to service_role
CREATE POLICY "Service role can insert credential access logs"
  ON public.credential_access_logs
  FOR INSERT
  TO service_role
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- 2. Secure public.notifications INSERT policy
-- Drop existing overly permissive policy that used WITH CHECK (true) without role restriction
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;

-- Recreate policy strictly restricted to service_role
CREATE POLICY "Service role can insert notifications"
  ON public.notifications
  FOR INSERT
  TO service_role
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- 3. Harden SECURITY DEFINER queue management stored procedures against search_path hijacking
ALTER FUNCTION public.acquire_execution_job(TEXT, INT, TEXT[])
  SET search_path = public, pg_temp;

ALTER FUNCTION public.heartbeat_execution_job(UUID, TEXT, TEXT, INT)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.fail_exhausted_stale_jobs()
  SET search_path = public, pg_temp;
