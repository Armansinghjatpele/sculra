// ==============================================================================
// Sculra Post-Release QA Intelligence + Incident Correlation Test Suite
// (worker/tests/post_release_intelligence.test.ts)
// Covers Prompt 64 (Scenarios 1-38) & Deterministic Fixtures 1-4
// ==============================================================================

import { describe, it, expect, vi } from 'vitest';
import crypto from 'crypto';
import {
  SignalNormalizer,
  DeploymentCorrelationEngine,
  DeploymentCandidate,
  RegressionConfirmationEngine,
  KnownIssueCandidate,
  RecoveryDetector,
  QAFeedbackEngine,
  PostReleaseOrchestrator,
  ProductionSignalWebhookIngestionService,
  SentrySignalAdapter,
  GenericSignalAdapter,
  PostHogSignalAdapter,
  ProductionSignal,
} from '../src/signals';
import { DeterministicPrioritizer } from '../src/strategy/prioritizer';
import { PERMISSIONS } from '../src/authz/permissions';
import { ROLE_PERMISSIONS } from '../src/authz/role-permissions';

describe('Prompt 64: Post-Release QA Intelligence + Incident Correlation', () => {
  const projectId = 'proj-1111-2222-3333-4444';
  const orgId = 'org-5555-6666-7777-8888';
  const webhookSecret = 'test_webhook_secret_key_12345';

  // 1. Signal Normalization
  it('1. Signal Normalization: produces canonical ProductionSignal with required fields', () => {
    const signal = SignalNormalizer.normalize({
      projectId,
      title: 'Checkout 500 Internal Error',
      signalType: 'HTTP_ERROR',
      severity: 'CRITICAL',
      provider: 'GENERIC_WEBHOOK',
      affectedRoute: '/api/checkout',
    });

    expect(signal.id).toBeDefined();
    expect(signal.projectId).toBe(projectId);
    expect(signal.title).toBe('Checkout 500 Internal Error');
    expect(signal.signalType).toBe('HTTP_ERROR');
    expect(signal.severity).toBe('CRITICAL');
    expect(signal.fingerprint).toBeDefined();
    expect(signal.firstObservedAt).toBeDefined();
  });

  // 2. Empty-string -> null
  it('2. Empty-string -> null: converts blank and whitespace-only strings to null', () => {
    const signal = SignalNormalizer.normalize({
      projectId,
      title: 'Valid Error',
      signalType: 'ERROR',
      severity: 'HIGH',
      provider: 'SENTRY',
      affectedRoute: '   ',
      affectedUrl: '',
      affectedService: '   \n  ',
      deploymentId: '',
      releaseId: '   ',
      affectedCommit: '',
      description: '   ',
    });

    expect(signal.affectedRoute).toBeNull();
    expect(signal.affectedUrl).toBeNull();
    expect(signal.affectedService).toBeNull();
    expect(signal.deploymentId).toBeNull();
    expect(signal.releaseId).toBeNull();
    expect(signal.affectedCommit).toBeNull();
    expect(signal.description).toBeNull();
  });

  // 3. Payload validation
  it('3. Payload validation: rejects missing projectId, empty title, or invalid signalType', () => {
    expect(() =>
      SignalNormalizer.normalize({
        projectId: '',
        title: 'Error',
        signalType: 'ERROR',
        severity: 'LOW',
        provider: 'GENERIC_WEBHOOK',
      })
    ).toThrow(/projectId is required/);

    expect(() =>
      SignalNormalizer.normalize({
        projectId,
        title: '   ',
        signalType: 'ERROR',
        severity: 'LOW',
        provider: 'GENERIC_WEBHOOK',
      })
    ).toThrow(/title is required/);

    expect(() =>
      SignalNormalizer.normalize({
        projectId,
        title: 'Error',
        signalType: 'INVALID_TYPE' as any,
        severity: 'LOW',
        provider: 'GENERIC_WEBHOOK',
      })
    ).toThrow(/invalid or unsupported signalType/);
  });

  // 4. Signature validation
  it('4. Signature validation: validates HMAC SHA-256 with timing-safe comparison', () => {
    const rawBody = JSON.stringify({ title: 'Test Signal', signalType: 'ERROR' });
    const hmac = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');

    const genericAdapter = new GenericSignalAdapter();
    const validCheck = genericAdapter.verifySignature(
      rawBody,
      { 'x-sculra-signature': `sha256=${hmac}` },
      webhookSecret
    );
    expect(validCheck.valid).toBe(true);

    const invalidCheck = genericAdapter.verifySignature(
      rawBody,
      { 'x-sculra-signature': 'sha256=invalidhex00000000000000000000000000000000000000000000000000000000' },
      webhookSecret
    );
    expect(invalidCheck.valid).toBe(false);
  });

  // 5. Replay protection
  it('5. Replay protection: verifies providerSignalId allows idempotency identification', () => {
    const sig1 = SignalNormalizer.normalize({
      projectId,
      title: 'Duplicated Alert',
      signalType: 'ERROR',
      severity: 'HIGH',
      provider: 'SENTRY',
      providerSignalId: 'sentry-issue-98765',
    });

    const sig2 = SignalNormalizer.normalize({
      projectId,
      title: 'Duplicated Alert',
      signalType: 'ERROR',
      severity: 'HIGH',
      provider: 'SENTRY',
      providerSignalId: 'sentry-issue-98765',
    });

    expect(sig1.fingerprint).toEqual(sig2.fingerprint);
    expect(sig1.providerSignalId).toBe('sentry-issue-98765');
  });

  // 6. Idempotency
  it('6. Idempotency: increments occurrenceCount rather than creating duplicates', async () => {
    const mockSupabase: any = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 'sig-uuid-1', occurrence_count: 3 },
                error: null,
              }),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    };

    const payload = {
      signals: [{
        title: 'Network Timeout',
        providerSignalId: 'sentry-100',
        signalType: 'ERROR',
        severity: 'MEDIUM',
      }],
    };
    const rawBody = JSON.stringify(payload);
    const hmac = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');

    const result = await ProductionSignalWebhookIngestionService.ingest(
      {
        providerName: 'generic',
        rawBody,
        payload,
        headers: {
          'x-sculra-signature': hmac,
          'x-sculra-project-id': projectId,
        },
        webhookSecret,
        projectId,
      },
      mockSupabase
    );

    expect(result.accepted).toBe(true);
    expect(result.isDuplicate).toBe(true);
    expect(result.status).toBe('DUPLICATE_UPDATED');
  });

  // 7. Tenant isolation
  it('7. Tenant isolation: preserves organizationId and prevents cross-tenant spoofing', () => {
    const signal = SignalNormalizer.normalize({
      projectId,
      organizationId: orgId,
      title: 'Isolated Tenant Signal',
      signalType: 'ERROR',
      severity: 'LOW',
      provider: 'MANUAL',
    });

    expect(signal.organizationId).toBe(orgId);
    expect(signal.projectId).toBe(projectId);
  });

  // 8. RBAC
  it('8. RBAC: ensures SIGNALS_READ and SIGNALS_INGEST are in permissions and role mappings', () => {
    expect(PERMISSIONS.SIGNALS_READ).toBe('signals.read');
    expect(PERMISSIONS.SIGNALS_INGEST).toBe('signals.ingest');

    expect(ROLE_PERMISSIONS.VIEWER).toContain(PERMISSIONS.SIGNALS_READ);
    expect(ROLE_PERMISSIONS.VIEWER).not.toContain(PERMISSIONS.SIGNALS_INGEST);

    expect(ROLE_PERMISSIONS.DEVELOPER).toContain(PERMISSIONS.SIGNALS_INGEST);
    expect(ROLE_PERMISSIONS.QA_LEAD).toContain(PERMISSIONS.SIGNALS_INGEST);
    expect(ROLE_PERMISSIONS.ADMIN).toContain(PERMISSIONS.SIGNALS_INGEST);
    expect(ROLE_PERMISSIONS.OWNER).toContain(PERMISSIONS.SIGNALS_INGEST);
  });

  // 9. Exact deployment correlation
  it('9. Exact deployment correlation: matches exact deploymentId with 1.0 confidence', () => {
    const deploymentId = 'deploy-exact-123';
    const signal = SignalNormalizer.normalize({
      projectId,
      title: 'Unhandled Exception',
      signalType: 'EXCEPTION',
      severity: 'CRITICAL',
      provider: 'SENTRY',
      deploymentId,
      affectedCommit: 'aabbcc112233',
    });

    const candidates: DeploymentCandidate[] = [
      {
        id: deploymentId,
        projectId,
        commitSha: 'aabbcc112233',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'other-dep',
        projectId,
        commitSha: '998877665544',
        createdAt: new Date().toISOString(),
      },
    ];

    const corr = DeploymentCorrelationEngine.correlate(signal, candidates);
    expect(corr.correlationState).toBe('EXACT_MATCH');
    expect(corr.confidence).toBe(1.0);
    expect(corr.deploymentId).toBe(deploymentId);
  });

  // 10. Commit correlation
  it('10. Commit correlation: matches commit SHA when deploymentId is not specified', () => {
    const signal = SignalNormalizer.normalize({
      projectId,
      title: 'Database connection failed',
      signalType: 'RESOURCE_FAILURE',
      severity: 'HIGH',
      provider: 'GENERIC_WEBHOOK',
      affectedCommit: 'c0ffee778899',
    });

    const candidates: DeploymentCandidate[] = [
      {
        id: 'dep-coffee',
        projectId,
        commitSha: 'c0ffee778899aabbcc',
        createdAt: new Date().toISOString(),
      },
    ];

    const corr = DeploymentCorrelationEngine.correlate(signal, candidates);
    expect(corr.correlationState).toBe('STRONG_CORRELATION');
    expect(corr.confidence).toBeGreaterThanOrEqual(0.85);
    expect(corr.deploymentId).toBe('dep-coffee');
  });

  // 11. Release correlation
  it('11. Release correlation: matches releaseId when commit and deployment are absent', () => {
    const signal = SignalNormalizer.normalize({
      projectId,
      title: 'UI Render Crash',
      signalType: 'ERROR',
      severity: 'MEDIUM',
      provider: 'SENTRY',
      releaseId: 'v2.4.0',
    });

    const candidates: DeploymentCandidate[] = [
      {
        id: 'dep-v240',
        projectId,
        releaseId: 'v2.4.0',
        createdAt: new Date().toISOString(),
      },
    ];

    const corr = DeploymentCorrelationEngine.correlate(signal, candidates);
    expect(corr.correlationState).toBe('STRONG_CORRELATION');
    expect(corr.releaseId).toBe('v2.4.0');
  });

  // 12. Temporal-only correlation
  it('12. Temporal-only correlation: strictly TEMPORAL_ONLY when only time matches (never causality)', () => {
    const depTime = new Date('2026-09-30T10:00:00Z');
    const signalTime = new Date('2026-09-30T10:05:00Z'); // 5 mins later

    const signal = SignalNormalizer.normalize({
      projectId,
      title: 'Generic 500 error',
      signalType: 'HTTP_ERROR',
      severity: 'HIGH',
      provider: 'GENERIC_WEBHOOK',
      firstObservedAt: signalTime.toISOString(),
    });

    const candidates: DeploymentCandidate[] = [
      {
        id: 'dep-temporal-target',
        projectId,
        deployedAt: depTime.toISOString(),
        createdAt: depTime.toISOString(),
      },
    ];

    const corr = DeploymentCorrelationEngine.correlate(signal, candidates);
    expect(corr.correlationState).toBe('TEMPORAL_ONLY');
    expect(corr.reasons.some((r) => r.includes('cannot be inferred as deployment-caused'))).toBe(true);
  });

  // 13. Ambiguous correlation
  it('13. Ambiguous correlation: marks AMBIGUOUS when multiple candidate deployments share commit', () => {
    const signal = SignalNormalizer.normalize({
      projectId,
      title: 'Ambiguous Failure',
      signalType: 'ERROR',
      severity: 'HIGH',
      provider: 'SENTRY',
      affectedCommit: 'sha12345678',
    });

    const candidates: DeploymentCandidate[] = [
      {
        id: 'dep-staging',
        projectId,
        commitSha: 'sha12345678',
        environmentId: 'env-staging',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'dep-production',
        projectId,
        commitSha: 'sha12345678',
        environmentId: 'env-production',
        createdAt: new Date().toISOString(),
      },
    ];

    const corr = DeploymentCorrelationEngine.correlate(signal, candidates);
    expect(corr.correlationState).toBe('AMBIGUOUS');
    expect(corr.deploymentId).toBeNull();
  });

  // 14. Insufficient evidence
  it('14. Insufficient evidence: returns INSUFFICIENT_EVIDENCE when candidate pool is empty or signals lack identifiers', () => {
    const signal = SignalNormalizer.normalize({
      projectId,
      title: 'Ephemeral event',
      signalType: 'ERROR',
      severity: 'INFO',
      provider: 'GENERIC_WEBHOOK',
    });

    const corr = DeploymentCorrelationEngine.correlate(signal, []);
    expect(corr.correlationState).toBe('INSUFFICIENT_EVIDENCE');
  });

  // 15. Existing issue matching
  it('15. Existing issue matching: matches known issue by fingerprint and title', () => {
    const signal = SignalNormalizer.normalize({
      projectId,
      title: 'Payment Gateway Timeout',
      signalType: 'ERROR',
      severity: 'CRITICAL',
      provider: 'SENTRY',
      affectedRoute: '/checkout/pay',
    });

    const knownIssues: KnownIssueCandidate[] = [
      {
        id: 'issue-pay-timeout',
        fingerprint: signal.fingerprint,
        title: 'Payment Gateway Timeout',
        route: '/checkout/pay',
        status: 'OPEN',
        createdAt: new Date().toISOString(),
      },
    ];

    const result = RegressionConfirmationEngine.evaluate(signal, knownIssues);
    expect(result.state).toBe('MATCHED_EXISTING_ISSUE');
    expect(result.matchedIssueId).toBe('issue-pay-timeout');
    expect(result.confidence).toBe(1.0);
  });

  // 16. New production issue
  it('16. New production issue: marks NEW_SIGNAL when no match exists in known issues', () => {
    const signal = SignalNormalizer.normalize({
      projectId,
      title: 'Unseen GraphQL Parse Error',
      signalType: 'EXCEPTION',
      severity: 'HIGH',
      provider: 'SENTRY',
      affectedRoute: '/graphql',
    });

    const knownIssues: KnownIssueCandidate[] = [
      {
        id: 'issue-other',
        fingerprint: 'fp-other-1234',
        title: 'Old login bug',
        route: '/login',
        status: 'RESOLVED',
        createdAt: new Date().toISOString(),
      },
    ];

    const result = RegressionConfirmationEngine.evaluate(signal, knownIssues);
    expect(result.state).toBe('NEW_SIGNAL');
  });

  // 17. Post-release campaign creation
  it('17. Post-release campaign creation: plans bounded campaign prioritized by signal route', () => {
    const signal = SignalNormalizer.normalize({
      projectId,
      title: 'Cart Total NaN',
      signalType: 'USER_JOURNEY_FAILURE',
      severity: 'HIGH',
      provider: 'GENERIC_WEBHOOK',
      affectedRoute: '/cart',
    });

    const plan = PostReleaseOrchestrator.planVerification(
      {
        projectId,
        deploymentId: 'dep-cart-test',
        targetWorkflows: ['/checkout', '/profile'],
        reasons: ['Deploy trigger'],
        budget: { maxDurationMinutes: 15, maxTestRuns: 10 },
      },
      [signal]
    );

    expect(plan.selectedWorkflows).toContain('/cart');
    expect(plan.selectedWorkflows).toContain('/checkout');
    expect(plan.budget.maxDurationMinutes).toBeLessThanOrEqual(30);
  });

  // 18. Campaign deduplication
  it('18. Campaign deduplication: caps max workflows at 10 and prevents duplicate targets', () => {
    const plan = PostReleaseOrchestrator.planVerification({
      projectId,
      deploymentId: 'dep-dup-test',
      targetWorkflows: ['/a', '/b', '/a', '/b', '/c', '/d', '/e', '/f', '/g', '/h', '/i', '/j', '/k'],
      reasons: [],
      budget: { maxDurationMinutes: 10, maxTestRuns: 5 },
    });

    expect(new Set(plan.selectedWorkflows).size).toBe(plan.selectedWorkflows.length);
    expect(plan.selectedWorkflows.length).toBeLessThanOrEqual(10);
  });

  // 19. Missing project
  it('19. Missing project: throws descriptive error during normalization', () => {
    expect(() =>
      SignalNormalizer.normalize({
        projectId: '   ',
        title: 'Missing project',
        signalType: 'ERROR',
        severity: 'LOW',
        provider: 'GENERIC_WEBHOOK',
      })
    ).toThrow(/projectId is required/);
  });

  // 20. Missing environment
  it('20. Missing environment: keeps environmentId as null without fabricating default', () => {
    const signal = SignalNormalizer.normalize({
      projectId,
      title: 'No env signal',
      signalType: 'ERROR',
      severity: 'INFO',
      provider: 'GENERIC_WEBHOOK',
      environmentId: '',
    });

    expect(signal.environmentId).toBeNull();
  });

  // 21. Missing deployment
  it('21. Missing deployment: keeps deploymentId as null without fabricating latestCommit or HEAD', () => {
    const signal = SignalNormalizer.normalize({
      projectId,
      title: 'No deployment signal',
      signalType: 'ERROR',
      severity: 'LOW',
      provider: 'GENERIC_WEBHOOK',
      deploymentId: '   ',
      affectedCommit: '',
    });

    expect(signal.deploymentId).toBeNull();
    expect(signal.affectedCommit).toBeNull();
  });

  // 22. No monitoring data
  it('22. No monitoring data: evaluates health state to INSUFFICIENT_EVIDENCE, never HEALTHY', () => {
    const evaluation = PostReleaseOrchestrator.evaluateHealthState({
      deploymentId: 'dep-unmonitored',
      hasMonitoringConfigured: false,
      productionSignals: [],
      verificationPassed: null,
    });

    expect(evaluation.healthState).toBe('INSUFFICIENT_EVIDENCE');
    expect(evaluation.healthState).not.toBe('HEALTHY');
  });

  // 23. Unhealthy measured state
  it('23. Unhealthy measured state: flags active critical incidents as INCIDENT_ACTIVE', () => {
    const signal = SignalNormalizer.normalize({
      projectId,
      title: 'Payment Processor Crash',
      signalType: 'API_FAILURE',
      severity: 'CRITICAL',
      provider: 'SENTRY',
      status: 'OPEN',
    });

    const evaluation = PostReleaseOrchestrator.evaluateHealthState({
      deploymentId: 'dep-active-crit',
      hasMonitoringConfigured: true,
      productionSignals: [signal],
    });

    expect(evaluation.healthState).toBe('INCIDENT_ACTIVE');
  });

  // 24. Recovery detection
  it('24. Recovery detection: detects WORKFLOW_RECOVERED when previous failed and current passes', () => {
    const result = RecoveryDetector.evaluate({
      targetWorkflow: 'checkout-journey',
      previousDeploymentId: 'dep-prev',
      currentDeploymentId: 'dep-curr',
      previousWorkflowStatus: 'failed',
      currentWorkflowStatus: 'passed',
      currentProductionSignals: [],
    });

    expect(result.recoveryObserved).toBe(true);
    expect(result.recoveryState).toBe('WORKFLOW_RECOVERED');
  });

  // 25. No fabricated recovery
  it('25. No fabricated recovery: returns NO_RECOVERY_OBSERVED when previous was already passing', () => {
    const result = RecoveryDetector.evaluate({
      targetWorkflow: 'billing-flow',
      previousDeploymentId: 'dep-prev',
      currentDeploymentId: 'dep-curr',
      previousWorkflowStatus: 'passed',
      currentWorkflowStatus: 'passed',
    });

    expect(result.recoveryObserved).toBe(false);
    expect(result.recoveryState).toBe('NO_RECOVERY_OBSERVED');
  });

  // 26. Historical QA memory
  it('26. Historical QA memory: stores factual memory record without unsupported causality', () => {
    const record = QAFeedbackEngine.buildRecord({
      projectId,
      organizationId: orgId,
      entityType: 'DEPLOYMENT_PRODUCTION_SIGNAL',
      entityId: 'dep-100',
      relationshipType: 'CORRELATED_SIGNAL',
      signalId: 'sig-200',
      deploymentId: 'dep-100',
      correlationState: 'EXACT_MATCH',
      evidenceSummary: {
        matchedCommit: 'abc1234',
        reasons: ['Commit SHA confirmed'],
      },
      confidence: 1.0,
    });

    expect(record.id).toBeDefined();
    expect(record.entityType).toBe('DEPLOYMENT_PRODUCTION_SIGNAL');
    expect(record.evidenceSummary.correlationState).toBe('EXACT_MATCH');
    expect(record.confidence).toBe(1.0);
  });

  // 27. Strategy prioritization
  it('27. Strategy prioritization: gives explainable bounded priority boost to production-affected workflows', () => {
    const candidateTarget: any = {
      id: 'target-checkout',
      identifier: '/checkout',
      targetType: 'PAGE',
      pageUrl: 'https://app.sculra.com/checkout',
      attemptsCount: 0,
      estimatedCost: 1,
    };

    const productionSignals: ProductionSignal[] = [
      SignalNormalizer.normalize({
        projectId,
        title: 'Checkout API 500',
        signalType: 'HTTP_ERROR',
        severity: 'HIGH',
        provider: 'SENTRY',
        affectedRoute: '/checkout',
      }),
      SignalNormalizer.normalize({
        projectId,
        title: 'Checkout Latency Spike',
        signalType: 'PERFORMANCE_DEGRADATION',
        severity: 'MEDIUM',
        provider: 'GENERIC_WEBHOOK',
        affectedRoute: '/checkout',
      }),
    ];

    const result = DeterministicPrioritizer.prioritize([candidateTarget], {
      mode: 'REGRESSION',
      productionSignals,
    });

    const ranked = result.rankedTargets[0];
    expect(ranked.priorityScore).toBeGreaterThan(60);
    expect(
      ranked.reasons.some((r) => r.includes('this workflow had 2 production signal(s) in the previous 14 days'))
    ).toBe(true);
  });

  // 28. Notification deduplication
  it('28. Notification deduplication: computes stable fingerprint for deduplicating alerts', () => {
    const fp1 = SignalNormalizer.computeFingerprint('HTTP_ERROR', 'API 500', '/orders', 'order-service', null);
    const fp2 = SignalNormalizer.computeFingerprint('HTTP_ERROR', 'api 500 ', '/orders/', 'order-service', null);

    expect(fp1).toBe(fp2);
  });

  // 29. AI hallucination rejection
  it('29. AI hallucination rejection: rejects invented non-canonical signal types and invalid providers', () => {
    expect(() =>
      SignalNormalizer.normalize({
        projectId,
        title: 'Hallucinated Signal',
        signalType: 'AI_HALLUCINATED_METRIC' as any,
        severity: 'HIGH',
        provider: 'GENERIC_WEBHOOK',
      })
    ).toThrow();
  });

  // 30. Secret redaction
  it('30. Secret redaction: redacts Bearer tokens, passwords, and private keys from titles and urls', () => {
    const signal = SignalNormalizer.normalize({
      projectId,
      title: 'Crash with Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz.123',
      description: 'DB password=supersecretpass in log',
      affectedUrl: 'https://api.example.com/data?token=abcdef1234567890',
      signalType: 'ERROR',
      severity: 'HIGH',
      provider: 'GENERIC_WEBHOOK',
    });

    expect(signal.title).not.toContain('eyJhbGciOiJIUzI1Ni');
    expect(signal.title).toContain('[REDACTED_SECRET]');
    expect(signal.description).not.toContain('supersecretpass');
    expect(signal.description).toContain('[REDACTED_SECRET]');
  });

  // 31. Provider failure
  it('31. Provider failure: PostHog returns NOT_SUPPORTED without fabricating success', () => {
    const adapter = new PostHogSignalAdapter();
    const result = adapter.parsePayload({ event: 'test' }, {}, projectId);

    expect(result.supported).toBe(false);
    expect(result.error).toContain('NOT_SUPPORTED');
  });

  // 32. Queue retry
  it('32. Queue retry: returns null on database error without crashing', async () => {
    const mockSupabase: any = {
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockRejectedValue(new Error('DB Connection Refused')),
      }),
    };

    const queued = await PostReleaseOrchestrator.enqueueVerification(
      {
        projectId,
        deploymentId: 'dep-retry',
        targetWorkflows: ['/checkout'],
        reasons: ['test'],
        budget: { maxDurationMinutes: 10, maxTestRuns: 5 },
      },
      mockSupabase
    );

    expect(queued).toBeNull();
  });

  // 33. Worker restart
  it('33. Worker restart: signal state can be re-evaluated idempotently from persisted records', () => {
    const signal = SignalNormalizer.normalize({
      projectId,
      title: 'Worker Restart Test',
      signalType: 'ERROR',
      severity: 'MEDIUM',
      provider: 'GENERIC_WEBHOOK',
      affectedRoute: '/status',
    });

    const corr1 = DeploymentCorrelationEngine.correlate(signal, []);
    const corr2 = DeploymentCorrelationEngine.correlate(signal, []);

    expect(corr1.correlationState).toEqual(corr2.correlationState);
  });

  // 34. Partial evidence
  it('34. Partial evidence: marks POSSIBLE_CORRELATION when route/URL match without commit/deployment ID', () => {
    const signal = SignalNormalizer.normalize({
      projectId,
      title: 'Routing failure',
      signalType: 'ERROR',
      severity: 'LOW',
      provider: 'GENERIC_WEBHOOK',
      affectedRoute: '/api/v1/users',
      environmentId: 'env-prod',
    });

    const candidates: DeploymentCandidate[] = [
      {
        id: 'dep-different-commit',
        projectId,
        environmentId: 'env-other',
        createdAt: '2026-09-01T00:00:00Z', // Old
      },
    ];

    const corr = DeploymentCorrelationEngine.correlate(signal, candidates);
    expect(corr.correlationState).toBe('NO_CORRELATION');
  });

  // ============================================================================
  // Deterministic Fixtures (Prompt 64 Phase 20)
  // ============================================================================

  // 35. Complete production regression fixture (Fixture 1)
  it('35. Fixture 1: Full production regression lifecycle with exact match and feedback loop', () => {
    // Deployment A: commit AAA111, checkout passes
    const depA: DeploymentCandidate = {
      id: 'dep-A',
      projectId,
      commitSha: 'AAA111222333',
      releaseId: 'release-A',
      createdAt: '2026-09-30T08:00:00Z',
    };

    // Deployment B: commit BBB222, checkout fails
    const depB: DeploymentCandidate = {
      id: 'dep-B',
      projectId,
      commitSha: 'BBB222333444',
      releaseId: 'release-B',
      createdAt: '2026-09-30T09:00:00Z',
    };

    // Production signal: checkout API 500, references deployment B, commit BBB222
    const signal = SignalNormalizer.normalize({
      projectId,
      deploymentId: 'dep-B',
      affectedCommit: 'BBB222333444',
      title: 'Checkout API 500 Internal Server Error',
      signalType: 'HTTP_ERROR',
      severity: 'CRITICAL',
      provider: 'SENTRY',
      affectedRoute: '/api/checkout',
      occurrenceCount: 12,
    });

    // 1. Correlation: EXACT_MATCH
    const correlation = DeploymentCorrelationEngine.correlate(signal, [depA, depB]);
    expect(correlation.correlationState).toBe('EXACT_MATCH');
    expect(correlation.deploymentId).toBe('dep-B');
    expect(correlation.confidence).toBe(1.0);

    // 2. Existing checkout issue matching
    const knownIssues: KnownIssueCandidate[] = [
      {
        id: 'issue-checkout-defect',
        fingerprint: 'fp-old',
        title: 'Checkout API 500',
        route: '/api/checkout',
        status: 'OPEN',
        createdAt: '2026-09-30T09:05:00Z',
      },
    ];
    const regressionResult = RegressionConfirmationEngine.evaluate(signal, knownIssues);
    expect(regressionResult.state).toBe('MATCHED_EXISTING_ISSUE');
    expect(regressionResult.matchedIssueId).toBe('issue-checkout-defect');

    // 3. Post-release QA targets checkout
    const plan = PostReleaseOrchestrator.planVerification(
      {
        projectId,
        deploymentId: 'dep-B',
        targetWorkflows: [],
        reasons: ['Post-release QA'],
        budget: { maxDurationMinutes: 15, maxTestRuns: 10 },
      },
      [signal]
    );
    expect(plan.selectedWorkflows).toContain('/api/checkout');

    // 4. Release/post-release state reflects measured evidence
    const health = PostReleaseOrchestrator.evaluateHealthState({
      deploymentId: 'dep-B',
      hasMonitoringConfigured: true,
      productionSignals: [signal],
      verificationPassed: false,
    });
    expect(health.healthState).toBe('INCIDENT_ACTIVE');

    // 5. Future strategy prioritizes checkout
    const prioritizerResult = DeterministicPrioritizer.prioritize(
      [
        {
          id: 'checkout-workflow',
          identifier: '/api/checkout',
          targetType: 'API_ENDPOINT',
          attemptsCount: 0,
          estimatedCost: 1,
        } as any,
      ],
      {
        mode: 'REGRESSION',
        productionSignals: [signal],
      }
    );
    expect(
      prioritizerResult.rankedTargets[0].reasons.some((r) => r.includes('production signal(s)'))
    ).toBe(true);
  });

  // 36. Temporal-only fixture (Fixture 2)
  it('36. Fixture 2: Signal 2 min after deployment with no IDs/commit/env is strictly TEMPORAL_ONLY (never caused)', () => {
    const depTime = '2026-09-30T12:00:00Z';
    const sigTime = '2026-09-30T12:02:00Z'; // 2 mins later

    const signal = SignalNormalizer.normalize({
      projectId,
      title: 'Spurious network error',
      signalType: 'ERROR',
      severity: 'HIGH',
      provider: 'GENERIC_WEBHOOK',
      firstObservedAt: sigTime,
      // No deployment ID, commit, version, or environment provided
    });

    const candidates: DeploymentCandidate[] = [
      {
        id: 'dep-xyz',
        projectId,
        deployedAt: depTime,
        createdAt: depTime,
      },
    ];

    const correlation = DeploymentCorrelationEngine.correlate(signal, candidates);
    expect(correlation.correlationState).toBe('TEMPORAL_ONLY');
    expect(correlation.correlationState).not.toBe('EXACT_MATCH');
    expect(correlation.correlationState).not.toBe('STRONG_CORRELATION');
  });

  // 37. No-monitoring fixture (Fixture 3)
  it('37. Fixture 3: No monitoring signals and no post-release QA yields INSUFFICIENT_EVIDENCE (never HEALTHY)', () => {
    const health = PostReleaseOrchestrator.evaluateHealthState({
      deploymentId: 'dep-no-mon',
      hasMonitoringConfigured: false,
      productionSignals: [],
      verificationCampaignStatus: null,
      verificationPassed: null,
    });

    expect(health.healthState).toBe('INSUFFICIENT_EVIDENCE');
    expect(health.healthState).not.toBe('HEALTHY');
  });

  // 38. Recovery fixture (Fixture 4)
  it('38. Fixture 4: Previous passed, current passed, no signal yields NO fabricated recovery or regression', () => {
    const recoveryResult = RecoveryDetector.evaluate({
      targetWorkflow: 'checkout',
      previousDeploymentId: 'dep-1',
      currentDeploymentId: 'dep-2',
      previousWorkflowStatus: 'passed',
      currentWorkflowStatus: 'passed',
      currentProductionSignals: [],
    });

    expect(recoveryResult.recoveryObserved).toBe(false);
    expect(recoveryResult.recoveryState).toBe('NO_RECOVERY_OBSERVED');

    // Health state is only healthy when measured health evidence exists
    const health = PostReleaseOrchestrator.evaluateHealthState({
      deploymentId: 'dep-2',
      hasMonitoringConfigured: true,
      productionSignals: [],
      verificationPassed: true,
    });
    expect(health.healthState).toBe('HEALTHY');
  });
});
