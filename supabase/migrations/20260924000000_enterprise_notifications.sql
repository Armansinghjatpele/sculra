-- ==============================================================================
-- Sculra Enterprise Notifications, Alerts & Incident Communication Engine
-- Migration: 20260924000000_enterprise_notifications.sql
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Extend public.notifications (Non-destructive)
-- ------------------------------------------------------------------------------

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS severity TEXT NOT NULL DEFAULT 'INFO' CHECK (severity IN ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS entity_type TEXT,
  ADD COLUMN IF NOT EXISTS entity_id TEXT,
  ADD COLUMN IF NOT EXISTS dedupe_key TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications(clerk_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_org_created
  ON public.notifications(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_project_created
  ON public.notifications(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_read_at
  ON public.notifications(read_at);

CREATE INDEX IF NOT EXISTS idx_notifications_dedupe_created
  ON public.notifications(dedupe_key, created_at DESC);

-- Update RLS for public.notifications
CREATE POLICY "Users can update their own notifications"
  ON public.notifications
  FOR UPDATE
  USING (clerk_user_id = auth.jwt() ->> 'sub');

CREATE POLICY "Service role can insert notifications"
  ON public.notifications
  FOR INSERT
  WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- 2. Create public.notification_preferences
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  clerk_user_id TEXT NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  event_type TEXT, -- NULL denotes global fallback preference
  min_severity TEXT NOT NULL DEFAULT 'INFO' CHECK (min_severity IN ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  channel TEXT NOT NULL DEFAULT 'IN_APP' CHECK (channel IN ('IN_APP', 'EMAIL', 'WEBHOOK')),
  frequency TEXT NOT NULL DEFAULT 'IMMEDIATE' CHECK (frequency IN ('IMMEDIATE', 'HOURLY_DIGEST', 'DAILY_DIGEST', 'NEVER')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT uq_notification_preferences UNIQUE (organization_id, clerk_user_id, project_id, event_type, channel)
);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_user
  ON public.notification_preferences(clerk_user_id, organization_id);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_project
  ON public.notification_preferences(project_id);

-- ------------------------------------------------------------------------------
-- 3. Create public.notification_subscriptions
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  clerk_user_id TEXT NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('PROJECT', 'RELEASE', 'ISSUE', 'CAMPAIGN', 'ENVIRONMENT')),
  target_id TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'IN_APP' CHECK (channel IN ('IN_APP', 'EMAIL', 'WEBHOOK')),
  event_types TEXT[] DEFAULT '{}'::TEXT[] NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  CONSTRAINT uq_notification_subscriptions UNIQUE (organization_id, clerk_user_id, target_type, target_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_notification_subscriptions_user
  ON public.notification_subscriptions(clerk_user_id, organization_id);

CREATE INDEX IF NOT EXISTS idx_notification_subscriptions_target
  ON public.notification_subscriptions(target_type, target_id);

-- ------------------------------------------------------------------------------
-- 4. Create public.notification_incidents
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'SUPPRESSED')),
  severity TEXT NOT NULL CHECK (severity IN ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  primary_entity_type TEXT NOT NULL,
  primary_entity_id TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  last_updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  resolution_notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notification_incidents_project
  ON public.notification_incidents(project_id, last_updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_incidents_org
  ON public.notification_incidents(organization_id, last_updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_incidents_fingerprint
  ON public.notification_incidents(fingerprint, status);

-- ------------------------------------------------------------------------------
-- 5. Create public.notification_incident_events
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_incident_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES public.notification_incidents(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  relationship TEXT NOT NULL DEFAULT 'CORRELATED' CHECK (relationship IN ('CORRELATED', 'POSSIBLY_RELATED', 'OBSERVED_FACT')),
  entity_type TEXT,
  entity_id TEXT,
  occurred_at TIMESTAMPTZ NOT NULL,
  summary TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_incident_events_incident
  ON public.notification_incident_events(incident_id, occurred_at ASC);

-- ------------------------------------------------------------------------------
-- 6. Create public.notification_deliveries
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  notification_id UUID REFERENCES public.notifications(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  recipient_id TEXT,
  channel TEXT NOT NULL CHECK (channel IN ('IN_APP', 'EMAIL', 'WEBHOOK')),
  status TEXT NOT NULL DEFAULT 'SENT' CHECK (status IN ('SENT', 'DELIVERED', 'FAILED', 'RETRYING', 'SUPPRESSED', 'NOT_CONFIGURED')),
  attempts_count INT NOT NULL DEFAULT 1,
  provider_message_id TEXT,
  error_code TEXT,
  suppression_reason TEXT,
  last_attempt_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_deliveries_org_created
  ON public.notification_deliveries(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_deliveries_project_created
  ON public.notification_deliveries(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_deliveries_event
  ON public.notification_deliveries(event_id);

CREATE INDEX IF NOT EXISTS idx_deliveries_status
  ON public.notification_deliveries(status);

-- ------------------------------------------------------------------------------
-- 7. Create public.notification_delivery_attempts
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_delivery_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES public.notification_deliveries(id) ON DELETE CASCADE,
  attempt_number INT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'FAILED', 'RETRYING', 'SUPPRESSED')),
  response_code INT,
  response_summary TEXT,
  duration_ms INT NOT NULL,
  error TEXT,
  attempted_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_delivery_attempts_delivery
  ON public.notification_delivery_attempts(delivery_id, attempt_number ASC);

-- ------------------------------------------------------------------------------
-- 8. Create public.notification_suppressions
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_suppressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  clerk_user_id TEXT,
  reason TEXT NOT NULL CHECK (reason IN ('DEDUPLICATED', 'THROTTLED', 'PREFERENCE_DISABLED', 'UNAUTHORIZED', 'REVOKED', 'INSUFFICIENT_SEVERITY')),
  event_type TEXT NOT NULL,
  event_fingerprint TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb NOT NULL,
  suppressed_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_suppressions_org_time
  ON public.notification_suppressions(organization_id, suppressed_at DESC);

CREATE INDEX IF NOT EXISTS idx_suppressions_project_time
  ON public.notification_suppressions(project_id, suppressed_at DESC);

-- ------------------------------------------------------------------------------
-- 9. Row Level Security Policies
-- ------------------------------------------------------------------------------
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_incident_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_delivery_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_suppressions ENABLE ROW LEVEL SECURITY;

-- Preferences RLS
CREATE POLICY "Users can manage their own notification preferences"
  ON public.notification_preferences
  FOR ALL
  USING (clerk_user_id = auth.jwt() ->> 'sub')
  WITH CHECK (clerk_user_id = auth.jwt() ->> 'sub');

-- Subscriptions RLS
CREATE POLICY "Users can manage their own notification subscriptions"
  ON public.notification_subscriptions
  FOR ALL
  USING (clerk_user_id = auth.jwt() ->> 'sub')
  WITH CHECK (clerk_user_id = auth.jwt() ->> 'sub');

-- Incidents RLS
CREATE POLICY "Org members can view incidents"
  ON public.notification_incidents
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_memberships
      WHERE clerk_user_id = auth.jwt() ->> 'sub'
      AND status = 'active'
    )
    OR
    (project_id IS NOT NULL AND project_id IN (
      SELECT id FROM public.projects
      WHERE created_by = auth.jwt() ->> 'sub'
    ))
  );

CREATE POLICY "Org members with permissions can mutate incidents"
  ON public.notification_incidents
  FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_memberships
      WHERE clerk_user_id = auth.jwt() ->> 'sub'
      AND status = 'active'
      AND role IN ('owner', 'admin', 'qa_lead', 'developer')
    )
    OR
    (project_id IS NOT NULL AND project_id IN (
      SELECT id FROM public.projects
      WHERE created_by = auth.jwt() ->> 'sub'
    ))
  );

-- Incident Events RLS
CREATE POLICY "Org members can view incident events"
  ON public.notification_incident_events
  FOR SELECT
  USING (
    incident_id IN (
      SELECT id FROM public.notification_incidents
      WHERE organization_id IN (
        SELECT organization_id FROM public.organization_memberships
        WHERE clerk_user_id = auth.jwt() ->> 'sub'
        AND status = 'active'
      )
      OR project_id IN (
        SELECT id FROM public.projects
        WHERE created_by = auth.jwt() ->> 'sub'
      )
    )
  );

-- Deliveries and Attempts RLS: Admins and Owners can view delivery audit
CREATE POLICY "Admins and Owners can view notification deliveries"
  ON public.notification_deliveries
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_memberships
      WHERE clerk_user_id = auth.jwt() ->> 'sub'
      AND status = 'active'
      AND role IN ('owner', 'admin')
    )
    OR recipient_id = auth.jwt() ->> 'sub'
  );

CREATE POLICY "Admins and Owners can view delivery attempts"
  ON public.notification_delivery_attempts
  FOR SELECT
  USING (
    delivery_id IN (
      SELECT id FROM public.notification_deliveries
      WHERE organization_id IN (
        SELECT organization_id FROM public.organization_memberships
        WHERE clerk_user_id = auth.jwt() ->> 'sub'
        AND status = 'active'
        AND role IN ('owner', 'admin')
      )
      OR recipient_id = auth.jwt() ->> 'sub'
    )
  );

-- Suppressions RLS
CREATE POLICY "Admins and Owners can view notification suppressions"
  ON public.notification_suppressions
  FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_memberships
      WHERE clerk_user_id = auth.jwt() ->> 'sub'
      AND status = 'active'
      AND role IN ('owner', 'admin')
    )
  );

-- Service Role full access across all notification tables
CREATE POLICY "Service role full access on notification_preferences"
  ON public.notification_preferences FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access on notification_subscriptions"
  ON public.notification_subscriptions FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access on notification_incidents"
  ON public.notification_incidents FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access on notification_incident_events"
  ON public.notification_incident_events FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access on notification_deliveries"
  ON public.notification_deliveries FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access on notification_delivery_attempts"
  ON public.notification_delivery_attempts FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access on notification_suppressions"
  ON public.notification_suppressions FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
