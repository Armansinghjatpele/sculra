// ==============================================================================
// Sculra Notification Domain Types
// (worker/src/notifications/types.ts)
// ==============================================================================

export type NotificationUrgency = 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type NotificationChannelType = 'IN_APP' | 'EMAIL' | 'WEBHOOK';

export type DeliveryStatus =
  | 'SENT'
  | 'DELIVERED'
  | 'FAILED'
  | 'RETRYING'
  | 'SUPPRESSED'
  | 'NOT_CONFIGURED';

export type IncidentStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'SUPPRESSED';

export type IncidentRelationship = 'CORRELATED' | 'POSSIBLY_RELATED' | 'OBSERVED_FACT';

export type SuppressionReason =
  | 'DEDUPLICATED'
  | 'THROTTLED'
  | 'PREFERENCE_DISABLED'
  | 'UNAUTHORIZED'
  | 'REVOKED'
  | 'INSUFFICIENT_SEVERITY';

export type SubscriptionTargetType =
  | 'PROJECT'
  | 'RELEASE'
  | 'ISSUE'
  | 'CAMPAIGN'
  | 'ENVIRONMENT';

export type NotificationFrequency =
  | 'IMMEDIATE'
  | 'HOURLY_DIGEST'
  | 'DAILY_DIGEST'
  | 'NEVER';

export type NotificationEventType =
  // Issues & Vulnerabilities
  | 'ISSUE_CREATED'
  | 'ISSUE_ESCALATED'
  | 'ISSUE_RESOLVED'
  | 'ISSUE_RECURRED'
  | 'SECURITY_FINDING_CREATED'
  | 'SECURITY_BLOCKER_CREATED'
  | 'SECURITY_VULNERABILITY_DETECTED'
  | 'PERFORMANCE_REGRESSION_DETECTED'
  | 'ACCESSIBILITY_BLOCKER_CREATED'
  | 'VISUAL_REGRESSION_DETECTED'
  | 'API_REGRESSION_DETECTED'
  | 'REGRESSION_DETECTED'
  | 'REGRESSION_RECOVERED'
  // Test Runs & Campaigns
  | 'TEST_RUN_FAILED'
  | 'TEST_RUN_COMPLETED'
  | 'TEST_RUN_PASSED'
  | 'CAMPAIGN_FAILED'
  | 'CAMPAIGN_COMPLETED'
  | 'CAMPAIGN_CANCELLED'
  // Release Lifecycle
  | 'RELEASE_BLOCKED'
  | 'RELEASE_READY'
  | 'RELEASE_RELEASED'
  | 'RELEASE_ABANDONED'
  | 'RELEASE_DECISION_RECORDED'
  // Deployments & Environments
  | 'DEPLOYMENT_STARTED'
  | 'DEPLOYMENT_COMPLETED'
  | 'DEPLOYMENT_FAILED'
  | 'DEPLOYMENT_HEALTH_DEGRADED'
  | 'ENVIRONMENT_DEGRADED'
  | 'ENVIRONMENT_UNREACHABLE'
  | 'ENVIRONMENT_RECOVERED'
  // CI/CD Gates
  | 'CI_GATE_FAILED'
  | 'CI_GATE_PASSED'
  | 'CI_GATE_INSUFFICIENT_EVIDENCE'
  // Fix Agent & Human Approvals
  | 'FIX_APPROVAL_REQUIRED'
  | 'FIX_VERIFICATION_FAILED'
  | 'FIX_PR_CREATED'
  | 'HUMAN_APPROVAL_REQUIRED'
  // Sources & Credentials
  | 'SOURCE_DEGRADED'
  | 'SOURCE_RECOVERED'
  | 'CREDENTIAL_VALIDATION_FAILED'
  | 'CREDENTIAL_EXPIRED'
  | 'CREDENTIAL_INVALID'
  // Autonomous & Worker
  | 'AUTONOMOUS_DECISION_RECORDED'
  | 'WORKER_FAILURE_THRESHOLD_REACHED'
  | 'WORKER_FAILED';

export interface NotificationEvent {
  id: string;
  organizationId?: string | null;
  projectId?: string | null;
  sourceType: string;
  eventType: NotificationEventType;
  severity: NotificationUrgency;
  entityType: string;
  entityId: string;
  occurredAt: string; // ISO 8601
  fingerprint: string;
  title: string;
  summary: string;
  deepLink?: string;
  metadata?: Record<string, any>;
}

export interface NotificationRecipient {
  userId: string;
  organizationId?: string | null;
  email?: string;
  role: 'OWNER' | 'ADMIN' | 'QA_LEAD' | 'DEVELOPER' | 'VIEWER';
  status: 'active' | 'invited' | 'suspended' | 'removed';
  projectIds?: string[];
  permissions?: ReadonlySet<string>;
}

export interface NotificationPreference {
  id: string;
  organizationId?: string | null;
  clerkUserId: string;
  projectId?: string | null;
  eventType?: NotificationEventType | null;
  minSeverity: NotificationUrgency;
  channel: NotificationChannelType;
  frequency: NotificationFrequency;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationSubscription {
  id: string;
  organizationId?: string | null;
  clerkUserId: string;
  projectId?: string | null;
  targetType: SubscriptionTargetType;
  targetId: string;
  channel: NotificationChannelType;
  eventTypes: NotificationEventType[];
  createdAt: string;
}

export interface NotificationDelivery {
  id: string;
  organizationId?: string | null;
  projectId?: string | null;
  notificationId?: string | null;
  eventId: string;
  recipientId?: string | null;
  channel: NotificationChannelType;
  status: DeliveryStatus;
  attemptsCount: number;
  providerMessageId?: string;
  errorCode?: string;
  suppressionReason?: SuppressionReason;
  lastAttemptAt: string;
  createdAt: string;
}

export interface NotificationDeliveryAttempt {
  id: string;
  deliveryId: string;
  attemptNumber: number;
  status: 'SUCCESS' | 'FAILED' | 'RETRYING' | 'SUPPRESSED';
  responseCode?: number;
  responseSummary?: string;
  durationMs: number;
  error?: string;
  attemptedAt: string;
}

export interface NotificationIncident {
  id: string;
  organizationId?: string | null;
  projectId: string;
  status: IncidentStatus;
  severity: NotificationUrgency;
  title: string;
  summary: string;
  fingerprint: string;
  primaryEntityType: string;
  primaryEntityId: string;
  startedAt: string;
  lastUpdatedAt: string;
  acknowledgedAt?: string | null;
  acknowledgedBy?: string | null;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
  resolutionNotes?: string | null;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface NotificationIncidentEvent {
  id: string;
  incidentId: string;
  eventId: string;
  eventType: NotificationEventType;
  relationship: IncidentRelationship;
  entityType?: string;
  entityId?: string;
  occurredAt: string;
  summary: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface NotificationSuppression {
  id: string;
  organizationId?: string | null;
  projectId?: string | null;
  clerkUserId?: string | null;
  reason: SuppressionReason;
  eventType: NotificationEventType;
  eventFingerprint: string;
  details: Record<string, any>;
  suppressedAt: string;
}

export interface NotificationDigest {
  id: string;
  period: 'HOURLY' | 'DAILY';
  recipientId: string;
  projectId?: string | null;
  eventsCount: number;
  events: Array<{
    eventType: NotificationEventType;
    title: string;
    occurredAt: string;
  }>;
  summary: string;
  generatedAt: string;
}

export interface DeliveryResult {
  status: DeliveryStatus;
  providerMessageId?: string;
  errorCode?: string;
  retryable?: boolean;
  latencyMs?: number;
  suppressedReason?: SuppressionReason;
}

export interface WebhookEndpointConfig {
  id: string;
  url: string;
  secret: string;
  organizationId?: string | null;
  projectId?: string | null;
  enabled: boolean;
  eventTypes?: NotificationEventType[];
  minSeverity?: NotificationUrgency;
}

export interface EmailDeliveryConfig {
  provider: 'MOCK' | 'RESEND' | 'SENDGRID' | 'POSTMARK' | 'NOT_CONFIGURED';
  apiKeyCredentialId?: string;
  fromAddress?: string;
}
