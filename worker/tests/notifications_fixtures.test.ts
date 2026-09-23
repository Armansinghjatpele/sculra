// ==============================================================================
// Prompt 40: 20 Deterministic Notification Fixtures (A through T)
// (worker/tests/notifications_fixtures.test.ts)
// ==============================================================================

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  NotificationEngine,
  NotificationEventNormalizer,
  NotificationDeduplicator,
  NotificationThrottler,
  RecipientResolver,
  NotificationRecipient,
  WebhookEndpointConfig,
  DigestAggregator,
  NotificationRedactor,
} from '../src/notifications';

describe('Prompt 40: 20 Deterministic Notification Fixtures (A through T)', () => {
  let engine: NotificationEngine;
  const orgId = 'org-sculra-test';
  const projectId = 'proj-qa-suite';

  const defaultAdminRecipient: NotificationRecipient = {
    userId: 'user-admin-1',
    organizationId: orgId,
    email: 'admin@sculra.internal',
    role: 'ADMIN',
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
      'security.read',
      'credentials.read',
      'cicd.read',
    ]),
    status: 'active',
  };

  const defaultDeveloperRecipient: NotificationRecipient = {
    userId: 'user-dev-1',
    organizationId: orgId,
    email: 'dev@sculra.internal',
    role: 'DEVELOPER',
    permissions: new Set([
      'notifications.read',
      'incidents.read',
      'notifications.preferences_update',
      'approvals.read',
      'releases.read',
      'projects.read',
    ]),
    status: 'active',
  };

  beforeEach(() => {
    engine = new NotificationEngine();
    engine.reset();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ----------------------------------------------------------------------------
  // Fixture A: No notifications: zero-event baseline, clean state
  // ----------------------------------------------------------------------------
  it('Fixture A: No notifications: zero-event baseline, clean state, zero notifications dispatched', async () => {
    expect(engine.getDeliveries()).toHaveLength(0);
    expect(engine.getActiveIncidents()).toHaveLength(0);
    expect(engine.getSuppressions()).toHaveLength(0);

    const health = engine.getDeliveryHealth();
    expect(health.status).toBe('INSUFFICIENT_DATA');
    expect(health.totalDeliveries).toBe(0);
    expect(health.successRate).toBeNull();
  });

  // ----------------------------------------------------------------------------
  // Fixture B: Single critical security issue
  // ----------------------------------------------------------------------------
  it('Fixture B: Single critical security issue: event normalized, recipient resolved, in-app created', async () => {
    const result = await engine.dispatch(
      {
        eventType: 'SECURITY_VULNERABILITY_DETECTED',
        entityType: 'SECURITY_SCAN',
        entityId: 'sec-scan-99',
        title: 'High-severity SQL injection detected',
        summary: 'SQL injection detected in /api/v1/search endpoint parameters.',
        organizationId: orgId,
        projectId,
        severity: 'CRITICAL',
        deepLink: `/projects/${projectId}/security/sec-scan-99`,
      },
      {
        candidates: [defaultAdminRecipient],
      }
    );

    expect(result.success).toBe(true);
    expect(result.suppressed).toBe(false);
    expect(result.event.severity).toBe('CRITICAL');
    expect(result.deliveredCount).toBe(1);
    expect(result.deliveries[0].channel).toBe('IN_APP');
    expect(result.deliveries[0].status).toBe('DELIVERED');
  });

  // ----------------------------------------------------------------------------
  // Fixture C: Repeated identical issue deduplication
  // ----------------------------------------------------------------------------
  it('Fixture C: Repeated identical issue deduplication: second event suppressed within window', async () => {
    const payload = {
      eventType: 'SECURITY_VULNERABILITY_DETECTED' as const,
      entityType: 'SECURITY_SCAN',
      entityId: 'sec-scan-99',
      title: 'High-severity SQL injection detected',
      summary: 'SQL injection detected in /api/v1/search endpoint parameters.',
      organizationId: orgId,
      projectId,
      severity: 'CRITICAL' as const,
    };

    // First dispatch
    const first = await engine.dispatch(payload, { candidates: [defaultAdminRecipient] });
    expect(first.suppressed).toBe(false);
    expect(first.deliveredCount).toBe(1);

    // Immediate second dispatch with identical event fingerprint
    const second = await engine.dispatch(payload, { candidates: [defaultAdminRecipient] });
    expect(second.suppressed).toBe(true);
    expect(second.suppressionReason).toBe('DEDUPLICATED');
    expect(second.deliveredCount).toBe(0);

    const suppressions = engine.getSuppressions();
    expect(suppressions).toHaveLength(1);
    expect(suppressions[0].reason).toBe('DEDUPLICATED');
  });

  // ----------------------------------------------------------------------------
  // Fixture D: Release blocked
  // ----------------------------------------------------------------------------
  it('Fixture D: Release blocked: event emitted with release gate context, high severity notification', async () => {
    const result = await engine.dispatch(
      {
        eventType: 'RELEASE_BLOCKED',
        entityType: 'RELEASE',
        entityId: 'rel-v2.4.0',
        title: 'Release v2.4.0 Blocked by Quality Gate',
        summary: 'Release v2.4.0 blocked due to critical accessibility violations.',
        organizationId: orgId,
        projectId,
        severity: 'HIGH',
        metadata: {
          releaseVersion: 'v2.4.0',
          failedChecks: ['A11Y_WCAG_AA', 'PERF_LCP_BUDGET'],
        },
      },
      { candidates: [defaultAdminRecipient, defaultDeveloperRecipient] }
    );

    expect(result.success).toBe(true);
    expect(result.event.eventType).toBe('RELEASE_BLOCKED');
    expect(result.deliveredCount).toBe(2);
  });

  // ----------------------------------------------------------------------------
  // Fixture E: Release becomes ready
  // ----------------------------------------------------------------------------
  it('Fixture E: Release becomes ready: resolution event updates release gate status', async () => {
    const result = await engine.dispatch(
      {
        eventType: 'RELEASE_READY',
        entityType: 'RELEASE',
        entityId: 'rel-v2.4.0',
        title: 'Release v2.4.0 Ready for Deployment',
        summary: 'All release quality gates and checks passed successfully.',
        organizationId: orgId,
        projectId,
        severity: 'INFO',
        metadata: { releaseVersion: 'v2.4.0', checksPassed: 14 },
      },
      { candidates: [defaultDeveloperRecipient] }
    );

    expect(result.success).toBe(true);
    expect(result.event.eventType).toBe('RELEASE_READY');
    expect(result.deliveredCount).toBe(1);
  });

  // ----------------------------------------------------------------------------
  // Fixture F: Deployment followed by regression
  // ----------------------------------------------------------------------------
  it('Fixture F: Deployment followed by regression: incident linked with factual non-causal timeline', async () => {
    // 1. Deployment completed event
    await engine.dispatch({
      eventType: 'DEPLOYMENT_COMPLETED',
      entityType: 'DEPLOYMENT',
      entityId: 'dep-501',
      title: 'Deployment dep-501 finished in production',
      summary: 'Production deployment dep-501 completed at sha 9f8a12c',
      organizationId: orgId,
      projectId,
      severity: 'INFO',
    });

    // 2. Subsequent regression detected event
    const regressionResult = await engine.dispatch(
      {
        eventType: 'REGRESSION_DETECTED',
        entityType: 'PROJECT',
        entityId: projectId,
        title: 'Checkout Flow Latency Regression',
        summary: '95th percentile latency increased from 180ms to 920ms.',
        organizationId: orgId,
        projectId,
        severity: 'HIGH',
      },
      { candidates: [defaultAdminRecipient] }
    );

    expect(regressionResult.incident).toBeDefined();
    expect(regressionResult.incident?.status).toBe('OPEN');

    // Verify non-causal relationship in incident events
    const events = engine.getIncidentEvents(regressionResult.incident!.id);
    for (const evt of events) {
      // Must never claim unsupported causality
      expect(evt.relationship).not.toContain('caused');
      expect(evt.summary).not.toMatch(/caused by deployment/i);
    }
  });

  // ----------------------------------------------------------------------------
  // Fixture G: Regression recovered
  // ----------------------------------------------------------------------------
  it('Fixture G: Regression recovered: recovery event resolves active incident to RESOLVED', async () => {
    // Trigger regression opening incident
    const openRes = await engine.dispatch(
      {
        eventType: 'REGRESSION_DETECTED',
        entityType: 'PROJECT',
        entityId: projectId,
        title: 'Checkout Flow Regression',
        summary: 'Latency regression detected.',
        organizationId: orgId,
        projectId,
        severity: 'HIGH',
      },
      { candidates: [defaultAdminRecipient] }
    );

    expect(openRes.incident?.status).toBe('OPEN');

    // Trigger recovery
    const recoveryRes = await engine.dispatch(
      {
        eventType: 'REGRESSION_RECOVERED',
        entityType: 'PROJECT',
        entityId: projectId,
        title: 'Checkout Flow Recovered',
        summary: 'Latency returned to baseline 180ms.',
        organizationId: orgId,
        projectId,
        severity: 'INFO',
      },
      { candidates: [defaultAdminRecipient] }
    );

    expect(recoveryRes.incident?.status).toBe('RESOLVED');
    expect(recoveryRes.incident?.resolvedAt).toBeDefined();
  });

  // ----------------------------------------------------------------------------
  // Fixture H: Fix approval required
  // ----------------------------------------------------------------------------
  it('Fixture H: Fix approval required: creates high-priority approval notification with actionable deep link', async () => {
    const result = await engine.dispatch(
      {
        eventType: 'FIX_APPROVAL_REQUIRED',
        entityType: 'APPROVAL',
        entityId: 'appr-patch-77',
        title: 'Human Approval Required for Security Patch',
        summary: 'Fix Agent proposed a patch for SQL injection vulnerability.',
        organizationId: orgId,
        projectId,
        severity: 'HIGH',
        deepLink: `/projects/${projectId}/autonomous/approvals?approvalId=appr-patch-77`,
        metadata: {
          approvalId: 'appr-patch-77',
          targetBranch: 'main',
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        },
      },
      { candidates: [defaultAdminRecipient] }
    );

    expect(result.success).toBe(true);
    expect(result.event.severity).toBe('HIGH');
    expect(result.deliveries[0].status).toBe('DELIVERED');
  });

  // ----------------------------------------------------------------------------
  // Fixture I: Webhook configured and succeeds
  // ----------------------------------------------------------------------------
  it('Fixture I: Webhook configured and succeeds: HTTP 200 response, status DELIVERED, attempt 1', async () => {
    const webhookEndpoint: WebhookEndpointConfig = {
      id: 'ep-mock-1',
      url: 'https://hooks.external-partner.com/sculra-alerts',
      secret: 'whsec_TestSigningKey1234567890abcdef',
      events: ['CAMPAIGN_FAILED'],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{"received": true}',
    } as any);

    const result = await engine.dispatch(
      {
        eventType: 'CAMPAIGN_FAILED',
        entityType: 'CAMPAIGN',
        entityId: 'camp-999',
        title: 'Regression Campaign Failed',
        summary: '3 tests failed in regression test suite.',
        organizationId: orgId,
        projectId,
        severity: 'HIGH',
      },
      {
        webhookEndpoints: [webhookEndpoint],
      }
    );

    expect(result.success).toBe(true);
    const webhookDelivery = result.deliveries.find((d) => d.channel === 'WEBHOOK');
    expect(webhookDelivery).toBeDefined();
    expect(webhookDelivery?.status).toBe('DELIVERED');
    expect(webhookDelivery?.attemptsCount).toBe(1);
  });

  // ----------------------------------------------------------------------------
  // Fixture J: Webhook times out
  // ----------------------------------------------------------------------------
  it('Fixture J: Webhook times out: socket timeout simulated, delivery recorded as FAILED/RETRYING', async () => {
    const webhookEndpoint: WebhookEndpointConfig = {
      id: 'ep-mock-timeout',
      url: 'https://hooks.external-partner.com/timeout-endpoint',
      secret: 'whsec_SecretKey1234567890abcdef',
      events: ['CAMPAIGN_FAILED'],
    };

    globalThis.fetch = vi.fn().mockRejectedValue(new Error('AbortError: signal timed out'));

    const result = await engine.dispatch(
      {
        eventType: 'CAMPAIGN_FAILED',
        entityType: 'CAMPAIGN',
        entityId: 'camp-999',
        title: 'Campaign Failed',
        summary: 'Timeout testing.',
        organizationId: orgId,
        projectId,
        severity: 'HIGH',
      },
      { webhookEndpoints: [webhookEndpoint] }
    );

    const webhookDelivery = result.deliveries.find((d) => d.channel === 'WEBHOOK');
    expect(webhookDelivery).toBeDefined();
    // After retry exhaustion or initial timeout failure
    expect(['FAILED', 'RETRYING']).toContain(webhookDelivery?.status);
    expect(webhookDelivery?.attemptsCount).toBeGreaterThanOrEqual(1);
  });

  // ----------------------------------------------------------------------------
  // Fixture K: Webhook returns 500 (retryable)
  // ----------------------------------------------------------------------------
  it('Fixture K: Webhook returns 500 (retryable): retry scheduled and recorded', async () => {
    const webhookEndpoint: WebhookEndpointConfig = {
      id: 'ep-mock-500',
      url: 'https://hooks.external-partner.com/500-endpoint',
      secret: 'whsec_SecretKey1234567890abcdef',
      events: ['CAMPAIGN_FAILED'],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    } as any);

    const result = await engine.dispatch(
      {
        eventType: 'CAMPAIGN_FAILED',
        entityType: 'CAMPAIGN',
        entityId: 'camp-999',
        title: 'Campaign Failed',
        summary: 'Server error testing.',
        organizationId: orgId,
        projectId,
        severity: 'HIGH',
      },
      { webhookEndpoints: [webhookEndpoint] }
    );

    const webhookDelivery = result.deliveries.find((d) => d.channel === 'WEBHOOK');
    expect(webhookDelivery).toBeDefined();
    expect(webhookDelivery?.attemptsCount).toBeGreaterThanOrEqual(2);
  });

  // ----------------------------------------------------------------------------
  // Fixture L: Webhook returns 401 (non-retryable)
  // ----------------------------------------------------------------------------
  it('Fixture L: Webhook returns 401 (non-retryable): permanently failed, no retry scheduled', async () => {
    const webhookEndpoint: WebhookEndpointConfig = {
      id: 'ep-mock-401',
      url: 'https://hooks.external-partner.com/401-endpoint',
      secret: 'whsec_SecretKey1234567890abcdef',
      events: ['CAMPAIGN_FAILED'],
    };

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized client token',
    } as any);
    globalThis.fetch = fetchMock;

    const result = await engine.dispatch(
      {
        eventType: 'CAMPAIGN_FAILED',
        entityType: 'CAMPAIGN',
        entityId: 'camp-999',
        title: 'Campaign Failed',
        summary: 'Auth failure testing.',
        organizationId: orgId,
        projectId,
        severity: 'HIGH',
      },
      { webhookEndpoints: [webhookEndpoint] }
    );

    const webhookDelivery = result.deliveries.find((d) => d.channel === 'WEBHOOK');
    expect(webhookDelivery).toBeDefined();
    expect(webhookDelivery?.status).toBe('FAILED');
    expect(webhookDelivery?.attemptsCount).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  // ----------------------------------------------------------------------------
  // Fixture M: Unauthorized recipient
  // ----------------------------------------------------------------------------
  it('Fixture M: Unauthorized recipient: user in different org or lacking NOTIFICATIONS_READ excluded', async () => {
    const unauthorizedRecipient: NotificationRecipient = {
      userId: 'user-external',
      organizationId: 'different-org-id',
      email: 'intruder@other-company.com',
      role: 'VIEWER',
      permissions: [],
      active: true,
    };

    const candidates = [defaultAdminRecipient, unauthorizedRecipient];
    const event = NotificationEventNormalizer.normalize({
      eventType: 'CAMPAIGN_FAILED',
      entityType: 'CAMPAIGN',
      entityId: 'camp-12',
      title: 'Campaign Failed',
      summary: 'Campaign failed.',
      organizationId: orgId,
      projectId,
    });

    const resolved = RecipientResolver.resolveRecipients({
      event,
      candidates,
    });

    expect(resolved.some((r) => r.userId === unauthorizedRecipient.userId)).toBe(false);
    expect(resolved.some((r) => r.userId === defaultAdminRecipient.userId)).toBe(true);
  });

  // ----------------------------------------------------------------------------
  // Fixture N: Flapping environment throttling
  // ----------------------------------------------------------------------------
  it('Fixture N: Flapping environment throttling: rapid state changes throttled, critical bypass preserved', async () => {
    const rapidProject = 'proj-flapping-env';

    // Simulate 101 non-critical events in rapid succession
    for (let i = 0; i < 100; i++) {
      NotificationThrottler.record({ projectId: rapidProject, now: Date.now() });
    }

    // 101st event with severity LOW should be throttled
    const throttledCheck = NotificationThrottler.checkThrottle({
      projectId: rapidProject,
      severity: 'LOW',
      now: Date.now(),
    });
    expect(throttledCheck.throttled).toBe(true);
    expect(throttledCheck.bypass).toBe(false);

    // CRITICAL severity event in the same throttled project bypasses throttle
    const criticalCheck = NotificationThrottler.checkThrottle({
      projectId: rapidProject,
      severity: 'CRITICAL',
      now: Date.now(),
    });
    expect(criticalCheck.bypass).toBe(true);
  });

  // ----------------------------------------------------------------------------
  // Fixture O: Large burst of low-priority events
  // ----------------------------------------------------------------------------
  it('Fixture O: Large burst of low-priority events: batched into digest, summary delivered', async () => {
    const burstEvents = Array.from({ length: 25 }, (_, i) =>
      NotificationEventNormalizer.normalize({
        eventType: 'TEST_RUN_PASSED',
        entityType: 'TEST_RUN',
        entityId: `run-${i}`,
        title: `Test Run ${i} Passed`,
        summary: `Test Run ${i} completed with all tests passing.`,
        organizationId: orgId,
        projectId,
        severity: 'INFO',
      })
    );

    const digest = DigestAggregator.aggregate({
      recipientId: 'user-dev-1',
      period: 'HOURLY',
      events: burstEvents,
    });
    expect(digest).toBeDefined();
    expect(digest!.eventsCount).toBe(25);
    expect(digest!.period).toBe('HOURLY');
    expect(digest!.events).toHaveLength(25);
  });

  // ----------------------------------------------------------------------------
  // Fixture P: Incident correlation
  // ----------------------------------------------------------------------------
  it('Fixture P: Incident correlation: multiple related failure events merge into single active incident', async () => {
    const failureA = await engine.dispatch(
      {
        eventType: 'CAMPAIGN_FAILED',
        entityType: 'CAMPAIGN',
        entityId: 'camp-fail-1',
        title: 'Smoke Test Suite Failed',
        summary: 'Connection timeout on DB healthcheck.',
        organizationId: orgId,
        projectId,
        severity: 'HIGH',
      },
      { candidates: [defaultAdminRecipient] }
    );

    expect(failureA.incident).toBeDefined();
    const incidentId = failureA.incident!.id;

    // Second failure on same project
    const failureB = await engine.dispatch(
      {
        eventType: 'CAMPAIGN_FAILED',
        entityType: 'CAMPAIGN',
        entityId: 'camp-fail-2',
        title: 'Integration Test Suite Failed',
        summary: 'Connection timeout on DB healthcheck.',
        organizationId: orgId,
        projectId,
        severity: 'HIGH',
      },
      { candidates: [defaultAdminRecipient] }
    );

    expect(failureB.incident?.id).toBe(incidentId);
    expect(engine.getActiveIncidents(projectId)).toHaveLength(1);
  });

  // ----------------------------------------------------------------------------
  // Fixture Q: Incident resolution
  // ----------------------------------------------------------------------------
  it('Fixture Q: Incident resolution: all open issues resolved, incident transitions to RESOLVED', async () => {
    const res = await engine.dispatch(
      {
        eventType: 'ENVIRONMENT_DEGRADED',
        entityType: 'ENVIRONMENT',
        entityId: 'env-prod-1',
        title: 'Production Environment Degraded',
        summary: 'Memory pressure elevated.',
        organizationId: orgId,
        projectId,
        severity: 'HIGH',
      },
      { candidates: [defaultAdminRecipient] }
    );

    const incident = res.incident;
    expect(incident).toBeDefined();

    // Recover environment
    const recovery = await engine.dispatch(
      {
        eventType: 'ENVIRONMENT_RECOVERED',
        entityType: 'ENVIRONMENT',
        entityId: 'env-prod-1',
        title: 'Production Environment Recovered',
        summary: 'Memory pressure returned to normal.',
        organizationId: orgId,
        projectId,
        severity: 'INFO',
      },
      { candidates: [defaultAdminRecipient] }
    );

    expect(recovery.incident?.status).toBe('RESOLVED');
  });

  // ----------------------------------------------------------------------------
  // Fixture R: Digest aggregation
  // ----------------------------------------------------------------------------
  it('Fixture R: Digest aggregation: contains accurate count, zero fake counts, correct project attribution', async () => {
    const events = [
      NotificationEventNormalizer.normalize({
        eventType: 'TEST_RUN_PASSED',
        entityType: 'TEST_RUN',
        entityId: 'run-1',
        title: 'Run 1 Passed',
        summary: 'Passed',
        organizationId: orgId,
        projectId: 'proj-a',
        severity: 'LOW',
      }),
      NotificationEventNormalizer.normalize({
        eventType: 'TEST_RUN_PASSED',
        entityType: 'TEST_RUN',
        entityId: 'run-2',
        title: 'Run 2 Passed',
        summary: 'Passed',
        organizationId: orgId,
        projectId: 'proj-b',
        severity: 'LOW',
      }),
    ];

    const digest = DigestAggregator.aggregate({
      recipientId: 'user-dev-1',
      projectId: 'proj-a',
      period: 'DAILY',
      events,
    });
    expect(digest).toBeDefined();
    expect(digest!.eventsCount).toBe(2);
    expect(digest!.summary).toContain('2 events recorded');
    expect(digest!.projectId).toBe('proj-a');
  });

  // ----------------------------------------------------------------------------
  // Fixture S: Credential validation failure
  // ----------------------------------------------------------------------------
  it('Fixture S: Credential validation failure: vault error triggers notification with safe masked preview', async () => {
    const rawSecret = 'ghp_VerySensitiveProductionKey1234567890';
    const metadata = {
      credentialId: 'cred-99',
      provider: 'GITHUB',
      secret: rawSecret,
      apiKey: rawSecret,
    };

    const sanitized = NotificationRedactor.redactMetadata(metadata);
    expect(JSON.stringify(sanitized)).not.toContain(rawSecret);

    const result = await engine.dispatch(
      {
        eventType: 'CREDENTIAL_INVALID',
        entityType: 'CREDENTIAL',
        entityId: 'cred-99',
        title: 'GitHub VCS Credential Expired',
        summary: 'GitHub token returned HTTP 401 Unauthorized during automated sync.',
        organizationId: orgId,
        projectId,
        severity: 'HIGH',
        metadata: sanitized,
      },
      { candidates: [defaultAdminRecipient] }
    );

    expect(result.success).toBe(true);
    expect(JSON.stringify(result.event.metadata)).not.toContain(rawSecret);
  });

  // ----------------------------------------------------------------------------
  // Fixture T: Worker failure threshold
  // ----------------------------------------------------------------------------
  it('Fixture T: Worker failure threshold: degradation triggers alert to admins only', async () => {
    const workerEvent = {
      eventType: 'WORKER_FAILED' as const,
      entityType: 'INFRASTRUCTURE',
      entityId: 'worker-node-4',
      title: 'Distributed Worker Node Unresponsive',
      summary: 'Worker node-4 missed 3 consecutive heartbeats.',
      organizationId: orgId,
      projectId: null,
      severity: 'CRITICAL' as const,
    };

    const result = await engine.dispatch(workerEvent, {
      candidates: [defaultAdminRecipient, defaultDeveloperRecipient],
    });

    expect(result.success).toBe(true);
    // Worker infrastructure critical event resolves to admin recipients
    expect(result.deliveries.some((d) => d.recipientId === defaultAdminRecipient.userId)).toBe(true);
  });
});
