-- ==============================================================================
-- Sculra Continuous Deployment QA Automation & Release Gate Hardening Migration
-- Migration: 20260929000000_cd_automation_hardening.sql
-- ==============================================================================

-- 1. Extend public.qa_campaigns with idempotency_key for atomic duplicate prevention
ALTER TABLE public.qa_campaigns
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_qa_campaigns_idempotency_key
  ON public.qa_campaigns(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- 2. Extend public.deployment_events with processing_status, campaign_id, gate_decision_id
ALTER TABLE public.deployment_events
  ADD COLUMN IF NOT EXISTS processing_status TEXT NOT NULL DEFAULT 'RECEIVED'
  CHECK (processing_status IN ('RECEIVED', 'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'RETRYABLE'));

ALTER TABLE public.deployment_events
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES public.qa_campaigns(id) ON DELETE SET NULL;

ALTER TABLE public.deployment_events
  ADD COLUMN IF NOT EXISTS gate_decision_id UUID REFERENCES public.release_gate_decisions(id) ON DELETE SET NULL;

-- 3. Atomic uniqueness constraint on provider + provider_event_id to prevent duplicate deliveries
CREATE UNIQUE INDEX IF NOT EXISTS idx_deployment_events_provider_unique
  ON public.deployment_events(provider, provider_event_id)
  WHERE provider_event_id IS NOT NULL;

-- 4. Unique index on release_gate_decisions to prevent duplicate evaluation records
CREATE UNIQUE INDEX IF NOT EXISTS idx_release_gate_decisions_dep_policy_unique
  ON public.release_gate_decisions(deployment_id, policy_id, policy_version)
  WHERE deployment_id IS NOT NULL;

-- 5. Additional index on deployment_events processing status
CREATE INDEX IF NOT EXISTS idx_deployment_events_processing_status
  ON public.deployment_events(processing_status);
