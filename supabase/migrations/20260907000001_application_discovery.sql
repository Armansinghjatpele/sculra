-- ==============================================================================
-- Sculra APPLICATION DISCOVERY MIGRATION
-- (supabase/migrations/20260907000001_application_discovery.sql)
-- Extends test_evidence types to support application_map and responsive captures.
-- ==============================================================================

-- 1. Drop existing type check constraint on test_evidence and re-add with expanded types
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
    'responsive_capture'
  ));
