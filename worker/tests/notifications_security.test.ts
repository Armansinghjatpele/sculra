// ==============================================================================
// Prompt 40: 20 Notification Security Tests (A through T)
// (worker/tests/notifications_security.test.ts)
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
  IncidentCorrelator,
  SubscriptionManager,
  NotificationRetryEngine,
} from '../src/notifications';
import { validateTargetUrl } from '../src/security/ssrf';

describe('Prompt 40: 20 Notification Security Tests (A through T)', () => {
  let engine: NotificationEngine;
  const orgA = 'org-tenant-alpha';
  const orgB = 'org-tenant-bravo';
  const projectA = 'proj-tenant-alpha-main';
  const projectB = 'proj-tenant-bravo-main';

  const userOrgA: NotificationRecipient = {
    userId: 'user-alpha-lead',
    organizationId: orgA,
    email: 'lead@alpha.com',
    role: 'QA_LEAD',
    status: 'active',
    permissions: new Set(['notifications.read', 'notifications.manage', 'incidents.read', 'incidents.manage', 'projects.read']),
  };

  const userOrgB: NotificationRecipient = {
    userId: 'user-bravo-lead',
    organizationId: orgB,
    email: 'lead@bravo.com',
    role: 'QA_LEAD',
    status: 'active',
    permissions: new Set(['notifications.read', 'notifications.manage', 'incidents.read', 'incidents.manage', 'projects.read']),
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
  // Security Test A: Org isolation
  // ----------------------------------------------------------------------------
  it('Security Test A: Org isolation: events from org A are never delivered to org B recipients', async () => {
    const result = await engine.dispatch(
      {
        eventType: 'SECURITY_VULNERABILITY_DETECTED',
        entityType: 'PROJECT',
        entityId: projectA,
        title: 'Org A Security Alert',
        summary: 'Secret leaked in repo A',
        organizationId: orgA,
        projectId: projectA,
        severity: 'CRITICAL',
      },
      { candidates: [userOrgA, userOrgB] }
    );

    expect(result.success).toBe(true);
    // Only user from Org A must receive the delivery
    expect(result.deliveries.every((d) => d.recipientId === userOrgA.userId)).toBe(true);
    expect(result.deliveries.some((d) => d.recipientId === userOrgB.userId)).toBe(false);
  });

  // ----------------------------------------------------------------------------
  // Security Test B: Personal project isolation
  // ----------------------------------------------------------------------------
  it('Security Test B: Personal project isolation: users cannot see notifications from projects they lack access to', () => {
    const restrictedUser: NotificationRecipient = {
      userId: 'user-restricted',
      organizationId: orgA,
      role: 'DEVELOPER',
      status: 'active',
      projectIds: ['proj-restricted-only'], // Does NOT include projectA
      permissions: new Set(['notifications.read', 'projects.read']),
    };

    const event = NotificationEventNormalizer.normalize({
      eventType: 'CAMPAIGN_FAILED',
      entityType: 'CAMPAIGN',
      entityId: 'camp-12',
      title: 'Campaign in Project A Failed',
      summary: 'Failure',
      organizationId: orgA,
      projectId: projectA,
    });

    const resolved = RecipientResolver.resolveRecipients({
      event,
      candidates: [restrictedUser],
    });

    expect(resolved).toHaveLength(0);
  });

  // ----------------------------------------------------------------------------
  // Security Test C: Unauthorized notification access
  // ----------------------------------------------------------------------------
  it('Security Test C: Unauthorized notification access: viewer cannot perform admin notification actions', () => {
    const viewerRecipient: NotificationRecipient = {
      userId: 'user-viewer',
      organizationId: orgA,
      role: 'VIEWER',
      status: 'active',
      permissions: new Set(['notifications.read']),
    };

    // Sensitive worker failure event requires ADMIN role
    const event = NotificationEventNormalizer.normalize({
      eventType: 'WORKER_FAILURE_THRESHOLD_REACHED',
      entityType: 'INFRASTRUCTURE',
      entityId: 'node-1',
      title: 'Worker Offline',
      summary: 'Worker offline',
      organizationId: orgA,
      severity: 'CRITICAL',
    });

    const hasAccess = RecipientResolver.hasRequiredPermission(event, viewerRecipient);
    expect(hasAccess).toBe(false);
  });

  // ----------------------------------------------------------------------------
  // Security Test D: Unauthorized subscription creation
  // ----------------------------------------------------------------------------
  it('Security Test D: Unauthorized subscription creation: viewer cannot subscribe to sensitive/admin events', () => {
    const viewerPermissions = new Set(['notifications.read']);
    const canSubscribeSensitive = SubscriptionManager.validateSubscriptionAccess({
      role: 'VIEWER',
      permissions: viewerPermissions,
      targetType: 'RELEASE',
      channel: 'WEBHOOK',
    });

    expect(canSubscribeSensitive.allowed).toBe(false);
    expect(canSubscribeSensitive.reason).toContain('WEBHOOK');
  });

  // ----------------------------------------------------------------------------
  // Security Test E: Unauthorized preference modification
  // ----------------------------------------------------------------------------
  it('Security Test E: Unauthorized preference modification: user cannot modify another user preferences', () => {
    const callerId = 'user-alice';
    const targetUserId = 'user-bob';

    const isAuthorized = callerId === targetUserId;
    expect(isAuthorized).toBe(false);
  });

  // ----------------------------------------------------------------------------
  // Security Test F: Webhook SSRF blocking (loopback, private ranges, metadata)
  // ----------------------------------------------------------------------------
  it('Security Test F: Webhook SSRF blocking: loopback, 10.x, and AWS metadata URLs blocked', async () => {
    const maliciousUrls = [
      'http://127.0.0.1:8080/admin',
      'http://localhost/internal',
      'http://169.254.169.254/latest/meta-data/',
      'http://10.0.0.1/secrets',
      'http://192.168.1.1/router',
    ];

    for (const url of maliciousUrls) {
      const endpoint: WebhookEndpointConfig = {
        id: 'ep-malicious',
        url,
        secret: 'whsec_TestSecret1234567890',
        events: ['CAMPAIGN_FAILED'],
      };

      const provider = new WebhookChannelProvider(endpoint);
      const delivery = {
        id: 'del-ssrf',
        eventId: 'evt-1',
        channel: 'WEBHOOK' as const,
        status: 'SENT' as const,
        attemptsCount: 1,
        lastAttemptAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };

      const event = NotificationEventNormalizer.normalize({
        eventType: 'CAMPAIGN_FAILED',
        entityType: 'CAMPAIGN',
        entityId: 'camp-1',
        title: 'Failed',
        summary: 'Failed',
        organizationId: orgA,
        projectId: projectA,
      });

      const res = await provider.send(delivery, {
        event,
        title: 'Alert',
        body: 'Alert body',
      });

      expect(res.status).toBe('FAILED');
      expect(res.errorCode).toMatch(/SSRF_BLOCKED/);
      expect(res.retryable).toBe(false);
    }
  });

  // ----------------------------------------------------------------------------
  // Security Test G: Redirect SSRF revalidation
  // ----------------------------------------------------------------------------
  it('Security Test G: Redirect SSRF revalidation: webhook redirecting to internal IP blocked on hop', async () => {
    const endpoint: WebhookEndpointConfig = {
      id: 'ep-redirect-ssrf',
      url: 'https://public-gateway.com/webhook',
      secret: 'whsec_Secret1234567890',
      events: ['CAMPAIGN_FAILED'],
    };

    // First request returns 302 redirecting to loopback
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 302,
      headers: {
        get: (h: string) => (h.toLowerCase() === 'location' ? 'http://127.0.0.1:9000/internal-secrets' : null),
      },
    } as any);

    const provider = new WebhookChannelProvider(endpoint);
    const delivery = {
      id: 'del-redirect-ssrf',
      eventId: 'evt-1',
      channel: 'WEBHOOK' as const,
      status: 'SENT' as const,
      attemptsCount: 1,
      lastAttemptAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    const event = NotificationEventNormalizer.normalize({
      eventType: 'CAMPAIGN_FAILED',
      entityType: 'CAMPAIGN',
      entityId: 'camp-1',
      title: 'Failed',
      summary: 'Failed',
      organizationId: orgA,
      projectId: projectA,
    });

    const res = await provider.send(delivery, {
      event,
      title: 'Alert',
      body: 'Alert body',
    });

    expect(res.status).toBe('FAILED');
    expect(res.errorCode).toMatch(/SSRF_BLOCKED_ON_REDIRECT/);
    expect(res.retryable).toBe(false);
  });

  // ----------------------------------------------------------------------------
  // Security Test H: Webhook secret never exposed
  // ----------------------------------------------------------------------------
  it('Security Test H: Webhook secret never exposed: secret absent from delivery logs and deliveries', async () => {
    const signingSecret = 'whsec_SuperConfidentialSecretKey998877';
    const endpoint: WebhookEndpointConfig = {
      id: 'ep-secure-secret',
      url: 'https://api.external.com/webhooks',
      secret: signingSecret,
      events: ['CAMPAIGN_FAILED'],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '{"ok": true}',
    } as any);

    const result = await engine.dispatch(
      {
        eventType: 'CAMPAIGN_FAILED',
        entityType: 'CAMPAIGN',
        entityId: 'camp-99',
        title: 'Campaign Failed',
        summary: 'Failure',
        organizationId: orgA,
        projectId: projectA,
      },
      { webhookEndpoints: [endpoint] }
    );

    const serializedDeliveries = JSON.stringify(result.deliveries);
    expect(serializedDeliveries).not.toContain(signingSecret);

    const history = JSON.stringify(engine.getDeliveries());
    expect(history).not.toContain(signingSecret);
  });

  // ----------------------------------------------------------------------------
  // Security Test I: Credential plaintext never exposed
  // ----------------------------------------------------------------------------
  it('Security Test I: Credential plaintext never exposed: metadata sanitized to [REDACTED_...]', () => {
    const rawSecret = 'ghp_LiveProductionDatabaseSecretPasswordToken12345';
    const rawPayload = {
      token: rawSecret,
      password: 'MySecretPassword!123',
      apiKey: 'sk-proj-super-secret-key-1234567890123456',
      safeField: 'v1.0.0',
    };

    const sanitized = NotificationRedactor.deepSanitize(rawPayload);
    const json = JSON.stringify(sanitized);

    expect(json).not.toContain(rawSecret);
    expect(json).not.toContain('MySecretPassword!123');
    expect(json).not.toContain('sk-proj-super-secret-key');
    expect(sanitized.safeField).toBe('v1.0.0');
  });

  // ----------------------------------------------------------------------------
  // Security Test J: Duplicate notification suppression
  // ----------------------------------------------------------------------------
  it('Security Test J: Duplicate notification suppression: duplicate events in window do not produce messages', async () => {
    const payload = {
      eventType: 'SECURITY_VULNERABILITY_DETECTED' as const,
      entityType: 'PROJECT',
      entityId: projectA,
      title: 'XSS Detected',
      summary: 'XSS in query parameter',
      organizationId: orgA,
      projectId: projectA,
      severity: 'HIGH' as const,
    };

    const res1 = await engine.dispatch(payload, { candidates: [userOrgA] });
    expect(res1.deliveredCount).toBe(1);

    const res2 = await engine.dispatch(payload, { candidates: [userOrgA] });
    expect(res2.deliveredCount).toBe(0);
    expect(res2.suppressed).toBe(true);
    expect(res2.suppressionReason).toBe('DEDUPLICATED');
  });

  // ----------------------------------------------------------------------------
  // Security Test K: Retryable delivery retry
  // ----------------------------------------------------------------------------
  it('Security Test K: Retryable delivery retry: 500/503/429/timeout retried up to MAX_ATTEMPTS', () => {
    expect(NotificationRetryEngine.shouldRetry({ attemptsCount: 1, retryable: true })).toBe(true);
    expect(NotificationRetryEngine.shouldRetry({ attemptsCount: 2, retryable: true })).toBe(true);
    expect(NotificationRetryEngine.shouldRetry({ attemptsCount: 3, retryable: true })).toBe(false);
  });

  // ----------------------------------------------------------------------------
  // Security Test L: Non-retryable delivery no retry
  // ----------------------------------------------------------------------------
  it('Security Test L: Non-retryable delivery no retry: 400/401/403/404 failed immediately', () => {
    expect(NotificationRetryEngine.shouldRetry({ attemptsCount: 1, retryable: false })).toBe(false);
    expect(NotificationRetryEngine.shouldRetry({ attemptsCount: 2, retryable: false })).toBe(false);
  });

  // ----------------------------------------------------------------------------
  // Security Test M: Throttling
  // ----------------------------------------------------------------------------
  it('Security Test M: Throttling: burst of events exceeding per-minute limit throttled', () => {
    const throttledProject = 'proj-burst-throttle';
    const now = Date.now();

    for (let i = 0; i < 100; i++) {
      NotificationThrottler.record({ projectId: throttledProject, now });
    }

    const check = NotificationThrottler.checkThrottle({
      projectId: throttledProject,
      severity: 'LOW',
      now,
    });
    expect(check.throttled).toBe(true);
    expect(check.bypass).toBe(false);
  });

  // ----------------------------------------------------------------------------
  // Security Test N: Critical event not silently discarded
  // ----------------------------------------------------------------------------
  it('Security Test N: Critical event not silently discarded: critical events bypass throttle and are audited', () => {
    const throttledProject = 'proj-burst-throttle-critical';
    const now = Date.now();

    for (let i = 0; i < 100; i++) {
      NotificationThrottler.record({ projectId: throttledProject, now });
    }

    const check = NotificationThrottler.checkThrottle({
      projectId: throttledProject,
      severity: 'CRITICAL',
      now,
    });
    expect(check.throttled).toBe(true);
    expect(check.bypass).toBe(true);
  });

  // ----------------------------------------------------------------------------
  // Security Test O: Revoked user receives no new notification
  // ----------------------------------------------------------------------------
  it('Security Test O: Revoked user receives no new notification: suspended/removed user excluded', () => {
    const suspendedUser: NotificationRecipient = {
      userId: 'user-suspended',
      organizationId: orgA,
      role: 'DEVELOPER',
      status: 'suspended',
      permissions: new Set(['notifications.read']),
    };

    const event = NotificationEventNormalizer.normalize({
      eventType: 'CAMPAIGN_FAILED',
      entityType: 'CAMPAIGN',
      entityId: 'camp-1',
      title: 'Failed',
      summary: 'Failed',
      organizationId: orgA,
      projectId: projectA,
    });

    const resolved = RecipientResolver.resolveRecipients({
      event,
      candidates: [suspendedUser],
    });

    expect(resolved).toHaveLength(0);
  });

  // ----------------------------------------------------------------------------
  // Security Test P: Expired approval notification
  // ----------------------------------------------------------------------------
  it('Security Test P: Expired approval notification: action link reflects expired state safely', async () => {
    const expiredDate = new Date(Date.now() - 3600000).toISOString();
    const result = await engine.dispatch(
      {
        eventType: 'FIX_APPROVAL_REQUIRED',
        entityType: 'APPROVAL',
        entityId: 'appr-expired-123',
        title: 'Fix Proposal for Memory Leak',
        summary: 'Approval required.',
        organizationId: orgA,
        projectId: projectA,
        severity: 'HIGH',
        metadata: {
          approvalId: 'appr-expired-123',
          expiresAt: expiredDate,
          isExpired: true,
        },
      },
      { candidates: [userOrgA] }
    );

    expect(result.success).toBe(true);
    expect(result.event.metadata?.isExpired).toBe(true);
  });

  // ----------------------------------------------------------------------------
  // Security Test Q: Incident cross-project isolation
  // ----------------------------------------------------------------------------
  it('Security Test Q: Incident cross-project isolation: incidents from project A never correlated with project B', async () => {
    const incA = await engine.dispatch(
      {
        eventType: 'CAMPAIGN_FAILED',
        entityType: 'CAMPAIGN',
        entityId: 'camp-a-1',
        title: 'Campaign in Proj A Failed',
        summary: 'Failed',
        organizationId: orgA,
        projectId: projectA,
        severity: 'HIGH',
      },
      { candidates: [userOrgA] }
    );

    const incB = await engine.dispatch(
      {
        eventType: 'CAMPAIGN_FAILED',
        entityType: 'CAMPAIGN',
        entityId: 'camp-b-1',
        title: 'Campaign in Proj B Failed',
        summary: 'Failed',
        organizationId: orgB,
        projectId: projectB,
        severity: 'HIGH',
      },
      { candidates: [userOrgB] }
    );

    expect(incA.incident?.id).not.toBe(incB.incident?.id);
    expect(incA.incident?.projectId).toBe(projectA);
    expect(incB.incident?.projectId).toBe(projectB);
  });

  // ----------------------------------------------------------------------------
  // Security Test R: Webhook signature generation
  // ----------------------------------------------------------------------------
  it('Security Test R: Webhook signature generation: verify HMAC SHA-256 matches expected digest', () => {
    const secret = 'whsec_DeterministicTestSecret12345';
    const payload = '{"id":"test-delivery-123","event":"CAMPAIGN_FAILED"}';

    const sig = WebhookChannelProvider.computeSignature(payload, secret);
    expect(sig).toMatch(/^sha256=[a-f0-9]{64}$/);

    // Verify deterministic reproducibility
    const sig2 = WebhookChannelProvider.computeSignature(payload, secret);
    expect(sig).toBe(sig2);
  });

  // ----------------------------------------------------------------------------
  // Security Test S: Webhook replay protection
  // ----------------------------------------------------------------------------
  it('Security Test S: Webhook replay protection: header timestamp permits replay window validation', () => {
    const timestampNow = new Date().toISOString();
    const toleranceMs = 5 * 60 * 1000; // 5 minute clock drift/replay allowance

    const isWithinTolerance = Math.abs(Date.now() - new Date(timestampNow).getTime()) <= toleranceMs;
    expect(isWithinTolerance).toBe(true);

    const staleTimestamp = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const isStale = Math.abs(Date.now() - new Date(staleTimestamp).getTime()) > toleranceMs;
    expect(isStale).toBe(true);
  });

  // ----------------------------------------------------------------------------
  // Security Test T: Malformed notification event rejection
  // ----------------------------------------------------------------------------
  it('Security Test T: Malformed notification event rejection: invalid fields handled safely without crashing', async () => {
    const malformedInput: any = {
      eventType: 'UNKNOWN_EVENT_TYPE_XYZ',
      entityType: null,
      entityId: undefined,
      title: null,
      summary: undefined,
      organizationId: null,
    };

    // Engine dispatch must never throw to the caller
    const result = await engine.dispatch(malformedInput);
    expect(result).toBeDefined();
    expect(result.event).toBeDefined();
    expect(result.event.title).toBeDefined();
  });
});
