// ==============================================================================
// Prompt 40: Notifications, Alerts & Incident Communication Engine E2E Test
// (worker/tests/notifications_e2e.test.ts)
// ==============================================================================

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  NotificationEngine,
  NotificationEventNormalizer,
  NotificationDeduplicator,
  NotificationThrottler,
  RecipientResolver,
  NotificationRecipient,
  WebhookChannelProvider,
  WebhookEndpointConfig,
  NotificationRedactor,
  DigestAggregator,
  IncidentManager,
  IncidentCorrelator,
  NotificationTelemetry,
} from '../src/notifications';
import { AutonomousEventStore } from '../src/observability';

describe('Prompt 40: End-to-End Enterprise Notification & Incident Flow', () => {
  let engine: NotificationEngine;
  const orgId = 'org-e2e-enterprise';
  const projectId = 'proj-e2e-qa';

  const adminRecipient: NotificationRecipient = {
    userId: 'user-admin',
    organizationId: orgId,
    email: 'admin@enterprise.internal',
    role: 'ADMIN',
    status: 'active',
    permissions: new Set([
      'notifications.read',
      'notifications.manage',
      'incidents.read',
      'incidents.manage',
      'approvals.approve',
      'approvals.read',
      'releases.read',
      'releases.decide',
      'projects.read',
    ]),
  };

  const devRecipient: NotificationRecipient = {
    userId: 'user-dev',
    organizationId: orgId,
    email: 'dev@enterprise.internal',
    role: 'DEVELOPER',
    status: 'active',
    permissions: new Set([
      'notifications.read',
      'incidents.read',
      'notifications.preferences_update',
      'approvals.read',
      'projects.read',
    ]),
  };

  beforeEach(() => {
    engine = new NotificationEngine();
    engine.reset();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('executes a complete 15-step notification, incident, and alerting lifecycle', async () => {
    // --------------------------------------------------------------------------
    // Step 1: Initialize Project & Org with Team Members
    // --------------------------------------------------------------------------
    expect(adminRecipient.organizationId).toBe(orgId);
    expect(devRecipient.organizationId).toBe(orgId);
    expect(adminRecipient.status).toBe('active');

    // --------------------------------------------------------------------------
    // Step 2: Configure Notification Webhook Endpoint
    // --------------------------------------------------------------------------
    const webhookEndpoint: WebhookEndpointConfig = {
      id: 'ep-e2e-webhook',
      url: 'https://pager.enterprise.internal/webhook',
      secret: 'whsec_E2ESecretKey1234567890abcdef',
      events: ['CAMPAIGN_FAILED', 'REGRESSION_DETECTED'],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{"status":"ok"}',
    } as any);

    // --------------------------------------------------------------------------
    // Step 3: Event Normalization
    // --------------------------------------------------------------------------
    const normalizedEvent = NotificationEventNormalizer.normalize({
      eventType: 'CAMPAIGN_FAILED',
      entityType: 'CAMPAIGN',
      entityId: 'camp-e2e-01',
      title: 'Nightly Regression Campaign Failed',
      summary: 'Critical auth service regression encountered in nightly run.',
      organizationId: orgId,
      projectId,
      severity: 'HIGH',
      metadata: {
        failedCount: 4,
        passedCount: 96,
        sourceSha: 'd3b07384d113edec',
      },
    });

    expect(normalizedEvent.id).toBeDefined();
    expect(normalizedEvent.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(normalizedEvent.severity).toBe('HIGH');

    // --------------------------------------------------------------------------
    // Step 4: Policy Evaluation & Recipient Resolution
    // --------------------------------------------------------------------------
    const resolvedRecipients = RecipientResolver.resolveRecipients({
      event: normalizedEvent,
      candidates: [adminRecipient, devRecipient],
    });
    expect(resolvedRecipients).toHaveLength(2);

    // --------------------------------------------------------------------------
    // Step 5: In-App Notification Delivery
    // --------------------------------------------------------------------------
    const dispatch1 = await engine.dispatch(normalizedEvent, {
      candidates: [adminRecipient, devRecipient],
      webhookEndpoints: [webhookEndpoint],
    });

    expect(dispatch1.success).toBe(true);
    expect(dispatch1.deliveredCount).toBeGreaterThanOrEqual(2);
    const inAppDeliveries = dispatch1.deliveries.filter((d) => d.channel === 'IN_APP');
    expect(inAppDeliveries).toHaveLength(2);
    expect(inAppDeliveries.every((d) => d.status === 'DELIVERED')).toBe(true);

    // --------------------------------------------------------------------------
    // Step 6: Incident Creation & Correlation
    // --------------------------------------------------------------------------
    expect(dispatch1.incident).toBeDefined();
    expect(dispatch1.incident?.status).toBe('OPEN');
    expect(dispatch1.incident?.projectId).toBe(projectId);
    const incidentId = dispatch1.incident!.id;

    // --------------------------------------------------------------------------
    // Step 7: Outbound Webhook Delivery with HMAC SHA-256
    // --------------------------------------------------------------------------
    const webhookDelivery = dispatch1.deliveries.find((d) => d.channel === 'WEBHOOK');
    expect(webhookDelivery).toBeDefined();
    expect(webhookDelivery?.status).toBe('DELIVERED');
    expect(webhookDelivery?.attemptsCount).toBe(1);

    // --------------------------------------------------------------------------
    // Step 8: Deduplication Engine Suppression
    // --------------------------------------------------------------------------
    const duplicateDispatch = await engine.dispatch(normalizedEvent, {
      candidates: [adminRecipient],
      webhookEndpoints: [webhookEndpoint],
    });

    expect(duplicateDispatch.suppressed).toBe(true);
    expect(duplicateDispatch.suppressionReason).toBe('DEDUPLICATED');
    expect(duplicateDispatch.deliveredCount).toBe(0);
    expect(engine.getSuppressions()).toHaveLength(1);

    // --------------------------------------------------------------------------
    // Step 9: Rate Throttler Check
    // --------------------------------------------------------------------------
    const throttleCheck = NotificationThrottler.checkThrottle({
      projectId,
      severity: 'LOW',
      now: Date.now(),
    });
    expect(throttleCheck.throttled).toBe(false);

    // --------------------------------------------------------------------------
    // Step 10: Secret Redaction
    // --------------------------------------------------------------------------
    const rawSecret = 'ghp_UltraConfidentialProductionToken1234567890';
    const dirtyMetadata = {
      token: rawSecret,
      apiKey: 'sk-proj-super-secret-ai-key-1234567890',
      safeInfo: 'Run succeeded on branch main',
    };

    const cleanMetadata = NotificationRedactor.boundMetadata(dirtyMetadata);
    const json = JSON.stringify(cleanMetadata);
    expect(json).not.toContain(rawSecret);
    expect(json).not.toContain('super-secret-ai-key');
    expect(cleanMetadata.safeInfo).toBe('Run succeeded on branch main');

    // --------------------------------------------------------------------------
    // Step 11: Digest Generation
    // --------------------------------------------------------------------------
    const lowPriorityEvents = Array.from({ length: 5 }, (_, i) =>
      NotificationEventNormalizer.normalize({
        eventType: 'TEST_RUN_PASSED',
        entityType: 'TEST_RUN',
        entityId: `run-passed-${i}`,
        title: `Test Run ${i} Passed`,
        summary: 'Passed with 0 errors.',
        organizationId: orgId,
        projectId,
        severity: 'INFO',
      })
    );

    const digest = DigestAggregator.aggregate({
      recipientId: devRecipient.userId,
      projectId,
      period: 'HOURLY',
      events: lowPriorityEvents,
    });

    expect(digest).toBeDefined();
    expect(digest!.eventsCount).toBe(5);
    expect(digest!.summary).toContain('5 events recorded');

    // --------------------------------------------------------------------------
    // Step 12: Human Acknowledgment of Incident
    // --------------------------------------------------------------------------
    const activeIncident = engine.getActiveIncidents(projectId)[0];
    expect(activeIncident).toBeDefined();

    const ackedIncident = IncidentManager.acknowledge(activeIncident, adminRecipient.userId);
    expect(ackedIncident.status).toBe('ACKNOWLEDGED');
    expect(ackedIncident.acknowledgedBy).toBe(adminRecipient.userId);
    expect(ackedIncident.acknowledgedAt).toBeDefined();

    // --------------------------------------------------------------------------
    // Step 13: Fix Proposal & Approval Alert
    // --------------------------------------------------------------------------
    const approvalDispatch = await engine.dispatch(
      {
        eventType: 'FIX_APPROVAL_REQUIRED',
        entityType: 'APPROVAL',
        entityId: 'appr-patch-e2e',
        title: 'Safe Fix Proposal Pending Approval',
        summary: 'Patch proposed to remedy latency spike in checkout flow.',
        organizationId: orgId,
        projectId,
        severity: 'HIGH',
        deepLink: `/projects/${projectId}/autonomous/approvals?id=appr-patch-e2e`,
      },
      { candidates: [adminRecipient] }
    );

    expect(approvalDispatch.success).toBe(true);
    expect(approvalDispatch.deliveries[0].status).toBe('DELIVERED');

    // --------------------------------------------------------------------------
    // Step 14: System Recovery Event Resolves Incident
    // --------------------------------------------------------------------------
    const recoveryDispatch = await engine.dispatch(
      {
        eventType: 'REGRESSION_RECOVERED',
        entityType: 'CAMPAIGN',
        entityId: 'camp-e2e-01',
        title: 'Campaign Tests Passing',
        summary: 'All regression tests returned to passing status.',
        organizationId: orgId,
        projectId,
        severity: 'INFO',
      },
      { candidates: [adminRecipient] }
    );

    expect(recoveryDispatch.incident?.status).toBe('RESOLVED');
    expect(recoveryDispatch.incident?.resolvedAt).toBeDefined();

    // --------------------------------------------------------------------------
    // Step 15: Telemetry & Truthful Delivery Health
    // --------------------------------------------------------------------------
    const health = engine.getDeliveryHealth();
    expect(health.status).toBe('HEALTHY');
    expect(health.totalDeliveries).toBeGreaterThan(0);
    expect(health.successRate).toBeGreaterThan(0.9);
  });
});
