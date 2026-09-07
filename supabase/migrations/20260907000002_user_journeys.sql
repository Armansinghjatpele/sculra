-- ==============================================================================
-- Sculra USER JOURNEY ENGINE MIGRATION
-- (supabase/migrations/20260907000002_user_journeys.sql)
-- Extends test_evidence types to support journey_result, journey_step, action_trace, and observation.
-- ==============================================================================

-- 1. Drop existing type check constraint on test_evidence and re-add with journey types
ALTER TABLE public.test_evidence DROP CONSTRAINT IF EXISTS test_evidence_type_check;

ALTER TABLE public.test_evidence ADD CONSTRAINT test_evidence_type_check 
  CHECK (type IN (
    'screenshot',
    'console_error',
    'network_error',
    'dom_snapshot',
    'navigation',
    'application_map',
    'discovered_page',
    'responsive_capture',
    'journey_result',
    'journey_step',
    'action_trace',
    'observation'
  ));
