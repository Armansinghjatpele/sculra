-- ==============================================================================
-- Sculra Database Triggers (triggers.sql)
-- ==============================================================================

-- 1. Sync auth.users with public.users
-- ------------------------------------------------------------------------------
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Bind updated_at trigger to tables
-- ------------------------------------------------------------------------------
CREATE TRIGGER set_updated_timestamp_users
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

CREATE TRIGGER set_updated_timestamp_organizations
    BEFORE UPDATE ON public.organizations
    FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

CREATE TRIGGER set_updated_timestamp_members
    BEFORE UPDATE ON public.members
    FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

CREATE TRIGGER set_updated_timestamp_projects
    BEFORE UPDATE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

CREATE TRIGGER set_updated_timestamp_bugs
    BEFORE UPDATE ON public.bugs
    FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

CREATE TRIGGER set_updated_timestamp_integrations
    BEFORE UPDATE ON public.integrations
    FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

CREATE TRIGGER set_updated_timestamp_settings
    BEFORE UPDATE ON public.settings
    FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

CREATE TRIGGER set_updated_timestamp_billing
    BEFORE UPDATE ON public.billing
    FOR EACH ROW EXECUTE FUNCTION public.update_modified_column();

