-- ==============================================================================
-- Sculra Database Utility Scripts (utils.sql)
-- ==============================================================================
-- Contains SQL scripts for checking system metrics, purging logs,
-- and running schema migrations validations.

-- Example: Purge activity logs older than 90 days
-- DELETE FROM public.activity_logs WHERE created_at < NOW() - INTERVAL '90 days';

