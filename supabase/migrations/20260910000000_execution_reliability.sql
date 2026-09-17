-- ==============================================================================
-- Sculra Production QA Execution Reliability & Distributed Job Queue Migration
-- Migration: 20260910000000_execution_reliability.sql
-- ==============================================================================
-- Adds distributed execution reliability metadata, lease & heartbeat tracking,
-- and atomic job acquisition / recovery stored procedures.

-- 1. Extend public.test_runs with worker ownership and lease tracking
ALTER TABLE public.test_runs
  ADD COLUMN IF NOT EXISTS worker_id TEXT,
  ADD COLUMN IF NOT EXISTS attempt INT DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS max_attempts INT DEFAULT 3 NOT NULL,
  ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS error_code TEXT,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS previous_worker_id TEXT,
  ADD COLUMN IF NOT EXISTS recovery_count INT DEFAULT 0 NOT NULL;

-- 2. Extend public.qa_campaigns with worker ownership and lease tracking
ALTER TABLE public.qa_campaigns
  ADD COLUMN IF NOT EXISTS worker_id TEXT,
  ADD COLUMN IF NOT EXISTS attempt INT DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS max_attempts INT DEFAULT 3 NOT NULL,
  ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS error_code TEXT,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS previous_worker_id TEXT,
  ADD COLUMN IF NOT EXISTS recovery_count INT DEFAULT 0 NOT NULL;

-- 3. Optimization indexes for distributed job queueing, lease expiration & worker queries
CREATE INDEX IF NOT EXISTS idx_test_runs_lease_recovery
  ON public.test_runs(status, lease_expires_at)
  WHERE status IN ('queued', 'running');

CREATE INDEX IF NOT EXISTS idx_qa_campaigns_lease_recovery
  ON public.qa_campaigns(status, lease_expires_at)
  WHERE status IN ('QUEUED', 'RUNNING');

CREATE INDEX IF NOT EXISTS idx_test_runs_worker
  ON public.test_runs(worker_id)
  WHERE worker_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_qa_campaigns_worker
  ON public.qa_campaigns(worker_id)
  WHERE worker_id IS NOT NULL;

-- 4. Atomic Job Acquisition Stored Procedure
-- Atomically selects and claims one queued or expired/recoverable job using SKIP LOCKED.
-- Invariant: ONE active lease = ONE worker owner.
CREATE OR REPLACE FUNCTION public.acquire_execution_job(
  p_worker_id TEXT,
  p_lease_seconds INT DEFAULT 60,
  p_supported_types TEXT[] DEFAULT ARRAY['CAMPAIGN', 'TEST_RUN']
)
RETURNS TABLE (
  job_id UUID,
  job_type TEXT,
  project_id UUID,
  organization_id UUID,
  status TEXT,
  attempt INT,
  max_attempts INT,
  worker_id TEXT,
  lease_expires_at TIMESTAMPTZ,
  target_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_job_id UUID;
  v_lease_interval INTERVAL := (p_lease_seconds || ' seconds')::INTERVAL;
BEGIN
  -- 1. Try to acquire CAMPAIGN if supported (higher priority)
  IF 'CAMPAIGN' = ANY(p_supported_types) THEN
    -- A. Check for stale recoverable campaigns (status = RUNNING and lease expired and attempt < max_attempts)
    SELECT c.id INTO v_job_id
    FROM public.qa_campaigns c
    WHERE c.status = 'RUNNING'
      AND c.lease_expires_at IS NOT NULL
      AND c.lease_expires_at < now()
      AND c.attempt < c.max_attempts
    ORDER BY c.created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_job_id IS NOT NULL THEN
      RETURN QUERY
      UPDATE public.qa_campaigns c
      SET
        previous_worker_id = c.worker_id,
        worker_id = p_worker_id,
        attempt = c.attempt + 1,
        recovery_count = c.recovery_count + 1,
        status = 'RUNNING',
        started_at = COALESCE(c.started_at, now()),
        last_heartbeat_at = now(),
        lease_expires_at = now() + v_lease_interval,
        updated_at = now()
      WHERE c.id = v_job_id
      RETURNING
        c.id AS job_id,
        'CAMPAIGN'::TEXT AS job_type,
        c.project_id,
        c.organization_id,
        c.status,
        c.attempt,
        c.max_attempts,
        c.worker_id,
        c.lease_expires_at,
        (c.configuration ->> 'targetUrl')::TEXT AS target_url;
      RETURN;
    END IF;

    -- B. Check for queued campaigns
    SELECT c.id INTO v_job_id
    FROM public.qa_campaigns c
    WHERE c.status = 'QUEUED'
    ORDER BY c.created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_job_id IS NOT NULL THEN
      RETURN QUERY
      UPDATE public.qa_campaigns c
      SET
        worker_id = p_worker_id,
        attempt = c.attempt + 1,
        status = 'RUNNING',
        started_at = now(),
        last_heartbeat_at = now(),
        lease_expires_at = now() + v_lease_interval,
        updated_at = now()
      WHERE c.id = v_job_id
      RETURNING
        c.id AS job_id,
        'CAMPAIGN'::TEXT AS job_type,
        c.project_id,
        c.organization_id,
        c.status,
        c.attempt,
        c.max_attempts,
        c.worker_id,
        c.lease_expires_at,
        (c.configuration ->> 'targetUrl')::TEXT AS target_url;
      RETURN;
    END IF;
  END IF;

  -- 2. Try to acquire TEST_RUN if supported
  IF 'TEST_RUN' = ANY(p_supported_types) THEN
    -- A. Check for stale recoverable test runs
    SELECT tr.id INTO v_job_id
    FROM public.test_runs tr
    WHERE tr.status = 'running'
      AND tr.lease_expires_at IS NOT NULL
      AND tr.lease_expires_at < now()
      AND tr.attempt < tr.max_attempts
    ORDER BY tr.created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_job_id IS NOT NULL THEN
      RETURN QUERY
      UPDATE public.test_runs tr
      SET
        previous_worker_id = tr.worker_id,
        worker_id = p_worker_id,
        attempt = tr.attempt + 1,
        recovery_count = tr.recovery_count + 1,
        status = 'running',
        started_at = COALESCE(tr.started_at, now()),
        last_heartbeat_at = now(),
        lease_expires_at = now() + v_lease_interval,
        updated_at = now()
      FROM public.projects p
      WHERE tr.id = v_job_id AND tr.project_id = p.id
      RETURNING
        tr.id AS job_id,
        'TEST_RUN'::TEXT AS job_type,
        tr.project_id,
        tr.organization_id,
        tr.status,
        tr.attempt,
        tr.max_attempts,
        tr.worker_id,
        tr.lease_expires_at,
        p.source_url AS target_url;
      RETURN;
    END IF;

    -- B. Check for queued test runs
    SELECT tr.id INTO v_job_id
    FROM public.test_runs tr
    WHERE tr.status = 'queued'
    ORDER BY tr.created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_job_id IS NOT NULL THEN
      RETURN QUERY
      UPDATE public.test_runs tr
      SET
        worker_id = p_worker_id,
        attempt = tr.attempt + 1,
        status = 'running',
        started_at = now(),
        last_heartbeat_at = now(),
        lease_expires_at = now() + v_lease_interval,
        updated_at = now()
      FROM public.projects p
      WHERE tr.id = v_job_id AND tr.project_id = p.id
      RETURNING
        tr.id AS job_id,
        'TEST_RUN'::TEXT AS job_type,
        tr.project_id,
        tr.organization_id,
        tr.status,
        tr.attempt,
        tr.max_attempts,
        tr.worker_id,
        tr.lease_expires_at,
        p.source_url AS target_url;
      RETURN;
    END IF;
  END IF;

  -- No jobs available
  RETURN;
END;
$$;

-- 5. Heartbeat Stored Procedure
-- Extends lease only if worker is still active owner of running job.
CREATE OR REPLACE FUNCTION public.heartbeat_execution_job(
  p_job_id UUID,
  p_job_type TEXT,
  p_worker_id TEXT,
  p_lease_seconds INT DEFAULT 60
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_updated INT := 0;
  v_lease_interval INTERVAL := (p_lease_seconds || ' seconds')::INTERVAL;
BEGIN
  IF p_job_type = 'CAMPAIGN' THEN
    UPDATE public.qa_campaigns
    SET
      last_heartbeat_at = now(),
      lease_expires_at = now() + v_lease_interval,
      updated_at = now()
    WHERE id = p_job_id
      AND worker_id = p_worker_id
      AND status = 'RUNNING';
    GET DIAGNOSTICS v_updated = ROW_COUNT;
  ELSE
    UPDATE public.test_runs
    SET
      last_heartbeat_at = now(),
      lease_expires_at = now() + v_lease_interval,
      updated_at = now()
    WHERE id = p_job_id
      AND worker_id = p_worker_id
      AND status = 'running';
    GET DIAGNOSTICS v_updated = ROW_COUNT;
  END IF;

  RETURN v_updated > 0;
END;
$$;

-- 6. Stale Job Failure Finalizer Stored Procedure
-- Fails stale jobs that have exceeded max attempts.
CREATE OR REPLACE FUNCTION public.fail_exhausted_stale_jobs()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_failed_campaigns INT := 0;
  v_failed_runs INT := 0;
BEGIN
  UPDATE public.qa_campaigns
  SET
    status = 'FAILED',
    error_code = 'MAX_ATTEMPTS_EXCEEDED',
    error_message = 'Job execution lease expired repeatedly and exceeded maximum retry attempts.',
    lease_expires_at = NULL,
    completed_at = now(),
    updated_at = now()
  WHERE status = 'RUNNING'
    AND lease_expires_at IS NOT NULL
    AND lease_expires_at < now()
    AND attempt >= max_attempts;
  GET DIAGNOSTICS v_failed_campaigns = ROW_COUNT;

  UPDATE public.test_runs
  SET
    status = 'failed',
    error_code = 'MAX_ATTEMPTS_EXCEEDED',
    error_message = 'Job execution lease expired repeatedly and exceeded maximum retry attempts.',
    lease_expires_at = NULL,
    completed_at = now(),
    updated_at = now()
  WHERE status = 'running'
    AND lease_expires_at IS NOT NULL
    AND lease_expires_at < now()
    AND attempt >= max_attempts;
  GET DIAGNOSTICS v_failed_runs = ROW_COUNT;

  RETURN v_failed_campaigns + v_failed_runs;
END;
$$;
