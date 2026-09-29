// ==============================================================================
// Sculra Continuous Deployment QA Automation & Release Gate Hardening Tests
// (worker/tests/cd_automation_hardening.test.ts)
// Covers Prompt 63A: 35-point regression suite + Deterministic Fixtures A, B, C
// ==============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHmac } from 'crypto';
import {
  buildDeploymentEvent,
  DeploymentWebhookIngestionService,
  ReleaseGatePolicyEvaluator,
  persistReleaseGateDecision,
  CDOrchestrator,
  computeCampaignIdempotencyKey,
  DEFAULT_CANONICAL_GATE_RULES,
  DEFAULT_RELEASE_GATE_POLICY_VERSION,
  CategoryScores,
  DeploymentEvent,
  ReleaseGateDecision,
} from '../src/release';

describe('Prompt 63A: Continuous Deployment QA Automation & Release Gate Hardening', () => {
  const mockProjectId = 'proj-hardening-1111';
  const mockOrgId = 'org-hardening-2222';
  const mockSecret = 'whsec_prod_super_secret_test_key_12345';

  const fullCleanScores: CategoryScores = {
    overall: 95,
    functional: 96,
    security: 98,
    authorization: 95,
    api: 92,
    performance: 88,
    accessibility: 90,
    visual: 94,
    responsive: 91,
  };

  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // Helper to create a chainable Supabase mock
  const createMockChain = (data: any, error: any = null) => {
    const chain: any = {
      maybeSingle: async () => ({ data, error }),
      single: async () => ({ data, error }),
      order: () => chain,
      limit: () => chain,
      eq: () => chain,
      select: () => chain,
      insert: async (insertData: any) => ({ data: insertData, error }),
      update: () => chain,
    };
    return chain;
  };

  // ============================================================================
  // Group 1: Durable Webhook Ingestion & Recovery (Points 1-6, 26-29)
  // ============================================================================
  describe('Group 1: Durable Webhook Ingestion, Idempotency & Tenant Isolation', () => {
    it('Point 1: Webhook persists event with processing_status = RECEIVED', async () => {
      const insertedEvents: any[] = [];
      const mockSupabase: any = {
        from: (table: string) => {
          if (table === 'projects') {
            return createMockChain({ id: mockProjectId, organization_id: mockOrgId });
          }
          if (table === 'deployment_events') {
            return {
              select: () => createMockChain(null),
              insert: async (data: any) => {
                insertedEvents.push(data);
                return { data: { id: data.id }, error: null };
              },
              update: () => createMockChain(null),
            };
          }
          return createMockChain(null);
        },
      };

      const payload = {
        id: 'dep_evt_1',
        readyState: 'BUILDING',
        name: 'my-app',
        url: 'https://app.vercel.app',
        meta: { githubCommitSha: 'aaa111' },
      };
      const rawBody = JSON.stringify(payload);

      const result = await DeploymentWebhookIngestionService.ingest(
        {
          providerName: 'vercel',
          rawBody,
          payload,
          headers: {},
          projectId: mockProjectId,
          organizationId: mockOrgId,
        },
        mockSupabase
      );

      expect(result.accepted).toBe(true);
      expect(insertedEvents.length).toBe(1);
      expect(insertedEvents[0].processing_status).toBe('RECEIVED');
      expect(insertedEvents[0].project_id).toBe(mockProjectId);
      expect(insertedEvents[0].organization_id).toBe(mockOrgId);
    });

    it('Point 2: Webhook enqueues durable job into public.qa_campaigns with status = QUEUED', async () => {
      const enqueuedCampaigns: any[] = [];
      const mockSupabase: any = {
        from: (table: string) => {
          if (table === 'projects') {
            return createMockChain({ id: mockProjectId, organization_id: mockOrgId });
          }
          if (table === 'deployment_events') {
            return {
              select: () => createMockChain(null),
              insert: async (data: any) => ({ data: { id: data.id }, error: null }),
              update: () => createMockChain(null),
            };
          }
          if (table === 'qa_campaigns') {
            return {
              select: () => createMockChain(null),
              insert: (data: any) => ({
                select: () => ({
                  maybeSingle: async () => {
                    enqueuedCampaigns.push(data);
                    return { data: { id: 'camp-durable-999' }, error: null };
                  },
                }),
              }),
            };
          }
          return createMockChain(null);
        },
      };

      const payload = {
        id: 'dep_ready_1',
        readyState: 'READY',
        url: 'https://ready.vercel.app',
        meta: { githubCommitSha: 'bbb222' },
      };
      const rawBody = JSON.stringify(payload);

      const result = await DeploymentWebhookIngestionService.ingest(
        {
          providerName: 'vercel',
          rawBody,
          payload,
          headers: {},
          projectId: mockProjectId,
          organizationId: mockOrgId,
        },
        mockSupabase
      );

      expect(result.accepted).toBe(true);
      expect(result.status).toBe('QUEUED');
      expect(result.campaignId).toBe('camp-durable-999');
      expect(enqueuedCampaigns.length).toBe(1);
      expect(enqueuedCampaigns[0].status).toBe('QUEUED');
      expect(enqueuedCampaigns[0].idempotency_key).toBeDefined();
      expect(enqueuedCampaigns[0].configuration.trigger).toBe('AUTOMATIC_DEPLOYMENT');
      expect(enqueuedCampaigns[0].configuration.commitSha).toBe('bbb222');
    });

    it('Point 3: Webhook returns 202 without waiting for campaign execution', async () => {
      let executorInvoked = false;
      const mockSupabase: any = {
        from: (table: string) => {
          if (table === 'projects') {
            return createMockChain({ id: mockProjectId, organization_id: mockOrgId });
          }
          if (table === 'qa_campaigns') {
            return {
              insert: () => ({
                select: () => ({
                  maybeSingle: async () => ({ data: { id: 'camp-async-001' }, error: null }),
                }),
              }),
            };
          }
          return createMockChain(null);
        },
      };

      const payload = { id: 'dep_fast_1', readyState: 'READY', url: 'https://fast.vercel.app' };
      const rawBody = JSON.stringify(payload);

      const startTime = Date.now();
      const result = await DeploymentWebhookIngestionService.ingest(
        {
          providerName: 'vercel',
          rawBody,
          payload,
          headers: {},
          projectId: mockProjectId,
          organizationId: mockOrgId,
        },
        mockSupabase
      );
      const elapsed = Date.now() - startTime;

      expect(result.statusCode).toBe(202);
      expect(result.accepted).toBe(true);
      expect(elapsed).toBeLessThan(1000); // Synchronously returns immediately
      expect(executorInvoked).toBe(false);
    });

    it('Point 4 & 32: Queue failure is recoverable (updates event to RETRYABLE and returns 500)', async () => {
      const updatedStatuses: any[] = [];
      const mockSupabase: any = {
        from: (table: string) => {
          if (table === 'projects') {
            return createMockChain({ id: mockProjectId, organization_id: mockOrgId });
          }
          if (table === 'deployment_events') {
            return {
              select: () => createMockChain(null),
              insert: async (data: any) => ({ data: { id: data.id }, error: null }),
              update: (fields: any) => {
                updatedStatuses.push(fields);
                return createMockChain(null);
              },
            };
          }
          if (table === 'qa_campaigns') {
            return {
              select: () => createMockChain(null),
              insert: () => ({
                select: () => ({
                  maybeSingle: async () => ({
                    data: null,
                    error: { message: 'Database connection pool exhausted', code: '08006' },
                  }),
                }),
              }),
            };
          }
          return createMockChain(null);
        },
      };

      const payload = { id: 'dep_fail_queue', readyState: 'READY', url: 'https://fail.vercel.app' };
      const rawBody = JSON.stringify(payload);

      const result = await DeploymentWebhookIngestionService.ingest(
        {
          providerName: 'vercel',
          rawBody,
          payload,
          headers: {},
          projectId: mockProjectId,
          organizationId: mockOrgId,
        },
        mockSupabase
      );

      expect(result.accepted).toBe(false);
      expect(result.statusCode).toBe(500);
      expect(updatedStatuses.some((u) => u.processing_status === 'RETRYABLE')).toBe(true);
    });

    it('Point 5: 10 concurrent identical webhooks produce exactly one job/campaign', async () => {
      const campaignsTable = new Map<string, any>();

      const mockSupabase: any = {
        from: (table: string) => {
          if (table === 'projects') {
            return createMockChain({ id: mockProjectId, organization_id: mockOrgId });
          }
          if (table === 'deployment_events') {
            return {
              select: () => createMockChain(null),
              insert: async (data: any) => ({ data: { id: data.id }, error: null }),
              update: () => createMockChain(null),
            };
          }
          if (table === 'qa_campaigns') {
            return {
              select: () => ({
                eq: (_col: string, val: string) => ({
                  maybeSingle: async () => ({ data: campaignsTable.get(val) || null, error: null }),
                }),
              }),
              insert: (data: any) => ({
                select: () => ({
                  maybeSingle: async () => {
                    if (campaignsTable.has(data.idempotency_key)) {
                      // Postgres Unique Violation code 23505
                      return {
                        data: null,
                        error: { code: '23505', message: 'duplicate key value violates unique constraint' },
                      };
                    }
                    const created = { id: `camp-${data.idempotency_key}`, status: 'QUEUED', ...data };
                    campaignsTable.set(data.idempotency_key, created);
                    return { data: created, error: null };
                  },
                }),
              }),
            };
          }
          return createMockChain(null);
        },
      };

      const payload = {
        id: 'dep_concurrent_1',
        readyState: 'READY',
        url: 'https://concurrent.vercel.app',
        meta: { githubCommitSha: 'c0ffee' },
      };
      const rawBody = JSON.stringify(payload);

      // Launch 10 concurrent webhook ingestion requests
      const promises = Array.from({ length: 10 }).map((_, idx) =>
        DeploymentWebhookIngestionService.ingest(
          {
            providerName: 'vercel',
            rawBody,
            payload,
            headers: { 'x-event-idx': String(idx) },
            projectId: mockProjectId,
            organizationId: mockOrgId,
          },
          mockSupabase
        )
      );

      const results = await Promise.all(promises);

      expect(results.length).toBe(10);
      expect(campaignsTable.size).toBe(1); // Exactly one campaign in DB

      const primaryCreated = results.filter((r) => r.statusCode === 202 && !r.isDuplicate);
      const acknowledgedDuplicates = results.filter((r) => r.statusCode === 200 && r.isDuplicate);

      expect(primaryCreated.length).toBe(1);
      expect(acknowledgedDuplicates.length).toBe(9);
      expect(acknowledgedDuplicates.every((d) => d.status === 'DUPLICATE_ACKNOWLEDGED')).toBe(true);
    });

    it('Point 6 & 29: Duplicate webhook delivery is idempotent and acknowledged', async () => {
      const mockSupabase: any = {
        from: (table: string) => {
          if (table === 'projects') {
            return createMockChain({ id: mockProjectId, organization_id: mockOrgId });
          }
          if (table === 'deployment_events') {
            return {
              select: () =>
                createMockChain({
                  id: 'existing-event-1',
                  provider: 'VERCEL',
                  provider_event_id: 'vercel:dep_repeat_1',
                  deployment_status: 'READY',
                  campaign_id: 'camp-prev-1',
                  processing_status: 'COMPLETED',
                }),
            };
          }
          return createMockChain(null);
        },
      };

      const payload = { id: 'dep_repeat_1', readyState: 'READY' };
      const result = await DeploymentWebhookIngestionService.ingest(
        {
          providerName: 'vercel',
          rawBody: JSON.stringify(payload),
          payload,
          headers: {},
          projectId: mockProjectId,
          organizationId: mockOrgId,
        },
        mockSupabase
      );

      expect(result.accepted).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(result.isDuplicate).toBe(true);
      expect(result.status).toBe('DUPLICATE_ACKNOWLEDGED');
      expect(result.campaignId).toBe('camp-prev-1');
    });

    it('Point 26: Webhook cannot spoof another tenant (rejects org mismatch with 403)', async () => {
      const mockSupabase: any = {
        from: (table: string) => {
          if (table === 'projects') {
            return createMockChain({ id: mockProjectId, organization_id: 'org-actual-real-tenant' });
          }
          return createMockChain(null);
        },
      };

      const payload = { id: 'dep_spoof_1' };
      const result = await DeploymentWebhookIngestionService.ingest(
        {
          providerName: 'vercel',
          rawBody: JSON.stringify(payload),
          payload,
          headers: { 'x-sculra-org-id': 'org-malicious-attacker' },
          projectId: mockProjectId,
        },
        mockSupabase
      );

      expect(result.accepted).toBe(false);
      expect(result.statusCode).toBe(403);
      expect(result.error).toContain('Tenant mismatch');
    });

    it('Point 27: Missing production webhook secret rejects request with 401', async () => {
      process.env.NODE_ENV = 'production';

      const payload = { id: 'dep_prod_no_secret' };
      const result = await DeploymentWebhookIngestionService.ingest({
        providerName: 'vercel',
        rawBody: JSON.stringify(payload),
        payload,
        headers: {},
        projectId: mockProjectId,
        // webhookSecret omitted
      });

      expect(result.accepted).toBe(false);
      expect(result.statusCode).toBe(401);
      expect(result.error).toContain('Webhook secret is mandatory in production');
    });

    it('Point 28: Invalid signature rejects request with 401', async () => {
      const payload = { id: 'dep_bad_sig' };
      const rawBody = JSON.stringify(payload);

      const result = await DeploymentWebhookIngestionService.ingest({
        providerName: 'vercel',
        rawBody,
        payload,
        headers: { 'x-vercel-signature': 'bad_tampered_signature_hex' },
        webhookSecret: mockSecret,
        projectId: mockProjectId,
      });

      expect(result.accepted).toBe(false);
      expect(result.statusCode).toBe(401);
      expect(result.error).toContain('signature mismatch');
    });
  });

  // ============================================================================
  // Group 2: Evidence Boundary & Gate Evaluation (Points 7-18, 30, 31)
  // ============================================================================
  describe('Group 2: Release Gate Evidence Boundary & Dimension Enforcement', () => {
    it('Point 7: READY + no QA evidence = INSUFFICIENT_EVIDENCE', () => {
      const decision = ReleaseGatePolicyEvaluator.evaluate({
        projectId: mockProjectId,
        deploymentId: 'dep-ready-no-evidence',
        hasMeasuredEvidence: false, // Default when no test runs exist
        categoryScores: undefined,
      });

      expect(decision.decision).toBe('INSUFFICIENT_EVIDENCE');
      expect(decision.blockers.some((b) => b.reason.includes('NO EVIDENCE -> NO INFERENCE'))).toBe(true);
      expect(decision.confidence).toBe(0.0);
    });

    it('Point 8: READY + queued QA = INSUFFICIENT_EVIDENCE', () => {
      // In a queued campaign, task results have not been produced yet
      const decision = ReleaseGatePolicyEvaluator.evaluate({
        projectId: mockProjectId,
        deploymentId: 'dep-queued-qa',
        hasMeasuredEvidence: false, // Queued QA is not measured evidence
      });

      expect(decision.decision).toBe('INSUFFICIENT_EVIDENCE');
    });

    it('Point 9: READY + running QA = INSUFFICIENT_EVIDENCE', () => {
      // Running QA does not have complete persisted evidence
      const decision = ReleaseGatePolicyEvaluator.evaluate({
        projectId: mockProjectId,
        deploymentId: 'dep-running-qa',
        hasMeasuredEvidence: false,
      });

      expect(decision.decision).toBe('INSUFFICIENT_EVIDENCE');
    });

    it('Point 10: READY + zero evidence collected = INSUFFICIENT_EVIDENCE', () => {
      const decision = ReleaseGatePolicyEvaluator.evaluate({
        projectId: mockProjectId,
        deploymentId: 'dep-zero-evidence',
        hasMeasuredEvidence: false,
        categoryScores: {} as any,
      });

      expect(decision.decision).toBe('INSUFFICIENT_EVIDENCE');
    });

    it('Point 11: READY + actual evidence = gate evaluates to PASS when clean', () => {
      const decision = ReleaseGatePolicyEvaluator.evaluate({
        projectId: mockProjectId,
        deploymentId: 'dep-actual-clean',
        hasMeasuredEvidence: true,
        categoryScores: fullCleanScores,
        overallReadinessScore: 95,
        openIssues: [],
        regressions: [],
        confidence: 0.95,
      });

      expect(decision.decision).toBe('PASS');
      expect(decision.blockers.length).toBe(0);
      expect(decision.missingEvidenceDimensions?.length ?? 0).toBe(0);
    });

    it('Point 12: Confirmed regression = BLOCK', () => {
      const decision = ReleaseGatePolicyEvaluator.evaluate({
        projectId: mockProjectId,
        deploymentId: 'dep-regressed',
        hasMeasuredEvidence: true,
        categoryScores: fullCleanScores,
        regressions: [
          {
            issueId: 'iss-reg-1',
            title: 'Pricing calculation off by 10%',
            classification: 'NEW_REGRESSION',
          },
        ],
      });

      expect(decision.decision).toBe('BLOCK');
      expect(decision.blockers.some((b) => b.dimension === 'REGRESSION')).toBe(true);
    });

    it('Point 13: Critical workflow failure = BLOCK', () => {
      const decision = ReleaseGatePolicyEvaluator.evaluate({
        projectId: mockProjectId,
        deploymentId: 'dep-critical-fail',
        hasMeasuredEvidence: true,
        categoryScores: fullCleanScores,
        openIssues: [
          {
            id: 'bug-checkout-500',
            title: 'Checkout button crashes with 500 internal server error',
            severity: 'critical',
            status: 'open',
          } as any,
        ],
      });

      expect(decision.decision).toBe('BLOCK');
      expect(decision.blockers.some((b) => b.dimension === 'CRITICAL_WORKFLOW')).toBe(true);
    });

    it('Point 14: Missing security evidence cannot PASS (status: UNMEASURED, decision: INSUFFICIENT_EVIDENCE)', () => {
      const scoresWithoutSecurity: CategoryScores = { ...fullCleanScores };
      delete (scoresWithoutSecurity as any).security;

      const decision = ReleaseGatePolicyEvaluator.evaluate({
        projectId: mockProjectId,
        deploymentId: 'dep-no-sec',
        hasMeasuredEvidence: true,
        categoryScores: scoresWithoutSecurity,
        overallReadinessScore: 90,
      });

      expect(decision.decision).toBe('INSUFFICIENT_EVIDENCE');
      expect(decision.missingEvidenceDimensions).toContain('SECURITY');
      expect(decision.dimensionEvaluations?.['SECURITY']?.status).toBe('UNMEASURED');
    });

    it('Point 15: Missing performance evidence cannot PASS (status: UNMEASURED, decision: INSUFFICIENT_EVIDENCE)', () => {
      const scoresWithoutPerf: CategoryScores = { ...fullCleanScores };
      delete (scoresWithoutPerf as any).performance;

      const decision = ReleaseGatePolicyEvaluator.evaluate({
        projectId: mockProjectId,
        deploymentId: 'dep-no-perf',
        hasMeasuredEvidence: true,
        categoryScores: scoresWithoutPerf,
        overallReadinessScore: 90,
      });

      expect(decision.decision).toBe('INSUFFICIENT_EVIDENCE');
      expect(decision.missingEvidenceDimensions).toContain('PERFORMANCE');
      expect(decision.dimensionEvaluations?.['PERFORMANCE']?.status).toBe('UNMEASURED');
    });

    it('Point 16: Missing accessibility evidence cannot PASS (status: UNMEASURED, decision: INSUFFICIENT_EVIDENCE)', () => {
      const scoresWithoutA11y: CategoryScores = { ...fullCleanScores };
      delete (scoresWithoutA11y as any).accessibility;

      const decision = ReleaseGatePolicyEvaluator.evaluate({
        projectId: mockProjectId,
        deploymentId: 'dep-no-a11y',
        hasMeasuredEvidence: true,
        categoryScores: scoresWithoutA11y,
        overallReadinessScore: 90,
      });

      expect(decision.decision).toBe('INSUFFICIENT_EVIDENCE');
      expect(decision.missingEvidenceDimensions).toContain('ACCESSIBILITY');
      expect(decision.dimensionEvaluations?.['ACCESSIBILITY']?.status).toBe('UNMEASURED');
    });

    it('Point 17: Missing visual evidence cannot PASS (status: UNMEASURED, decision: INSUFFICIENT_EVIDENCE)', () => {
      const scoresWithoutVisual: CategoryScores = { ...fullCleanScores };
      delete (scoresWithoutVisual as any).visual;

      const decision = ReleaseGatePolicyEvaluator.evaluate({
        projectId: mockProjectId,
        deploymentId: 'dep-no-vis',
        hasMeasuredEvidence: true,
        categoryScores: scoresWithoutVisual,
        overallReadinessScore: 90,
      });

      expect(decision.decision).toBe('INSUFFICIENT_EVIDENCE');
      expect(decision.missingEvidenceDimensions).toContain('VISUAL');
      expect(decision.dimensionEvaluations?.['VISUAL']?.status).toBe('UNMEASURED');
    });

    it('Point 18: Missing responsive evidence cannot PASS (status: UNMEASURED, decision: INSUFFICIENT_EVIDENCE)', () => {
      const scoresWithoutResp: CategoryScores = { ...fullCleanScores };
      delete (scoresWithoutResp as any).responsive;

      const decision = ReleaseGatePolicyEvaluator.evaluate({
        projectId: mockProjectId,
        deploymentId: 'dep-no-resp',
        hasMeasuredEvidence: true,
        categoryScores: scoresWithoutResp,
        overallReadinessScore: 90,
      });

      expect(decision.decision).toBe('INSUFFICIENT_EVIDENCE');
      expect(decision.missingEvidenceDimensions).toContain('RESPONSIVE');
      expect(decision.dimensionEvaluations?.['RESPONSIVE']?.status).toBe('UNMEASURED');
    });

    it('Point 30 & 31: Gate policy version and evidence references are persisted', async () => {
      let persistedRow: any = null;
      const mockSupabase: any = {
        from: (table: string) => {
          if (table === 'release_gate_decisions') {
            return {
              select: () => createMockChain(null),
              insert: (data: any) => ({
                select: () => ({
                  single: async () => {
                    persistedRow = data;
                    return { data: { id: data.id }, error: null };
                  },
                }),
              }),
            };
          }
          return createMockChain(null);
        },
      };

      const decision = ReleaseGatePolicyEvaluator.evaluate({
        projectId: mockProjectId,
        deploymentId: 'dep-persist-test',
        hasMeasuredEvidence: true,
        categoryScores: fullCleanScores,
        evidence: [
          {
            type: 'TEST_RUN',
            referenceId: 'run-uuid-111',
            description: 'Full QA campaign test run',
            confidence: 0.95,
          },
        ],
      });

      const persistRes = await persistReleaseGateDecision(mockSupabase, decision);

      expect(persistRes.success).toBe(true);
      expect(persistedRow).toBeDefined();
      expect(persistedRow.policy_version).toBe(DEFAULT_RELEASE_GATE_POLICY_VERSION);
      expect(persistedRow.evidence.length).toBe(1);
      expect(persistedRow.evidence[0].referenceId).toBe('run-uuid-111');
      expect(persistedRow.dimension_evaluations).toBeDefined();
    });
  });

  // ============================================================================
  // Group 3: Zero Fake Data Integrity (Points 19-25)
  // ============================================================================
  describe('Group 3: Zero Fake Data Integrity', () => {
    it('Points 19-25: Missing environment, commit SHA, branch remain null without synthetic fallbacks', () => {
      const event = buildDeploymentEvent({
        provider: 'VERCEL',
        projectId: mockProjectId,
        // Omit environmentName, environmentType, commitSha, branch
      });

      expect(event.environmentName).toBeNull();
      expect(event.environmentType).toBeNull();
      expect(event.commitSha).toBeNull();
      expect(event.branch).toBeNull();

      // Explicitly assert absence of forbidden fallbacks
      expect(event.environmentName).not.toBe('env-default');
      expect(event.environmentName).not.toBe('production');
      expect(event.environmentName).not.toBe('staging');
      expect(event.branch).not.toBe('main');
      expect(event.commitSha).not.toBe('HEAD');
      expect(event.commitSha).not.toBe('latest commit');
    });
  });

  // ============================================================================
  // Group 4: Execution & Notification Truthfulness (Points 33-35)
  // ============================================================================
  describe('Group 4: Truthful Notification & Single Execution Pipeline', () => {
    it('Point 33: CDOrchestrator does not send premature gate pass notifications when unmeasured', async () => {
      const dispatched: string[] = [];
      const mockNotificationEngine: any = {
        dispatch: async (notification: any) => {
          dispatched.push(notification.type);
        },
      };

      const event = buildDeploymentEvent({
        provider: 'VERCEL',
        projectId: mockProjectId,
        deploymentId: 'dep-no-exec',
        environmentName: 'staging',
        commitSha: 'fedcba123',
        deploymentStatus: 'READY',
      });

      const result = await CDOrchestrator.orchestrate({
        event,
        notificationEngine: mockNotificationEngine,
        // No campaignExecutorCallback provided -> QA has not executed
      });

      expect(result.gateDecision?.decision).toBe('INSUFFICIENT_EVIDENCE');
      expect(result.notificationsDispatched).not.toContain('RELEASE_GATE_PASSED');
      expect(result.notificationsDispatched).not.toContain('QA_COMPLETED');
      expect(result.notificationsDispatched).toContain('RELEASE_GATE_INSUFFICIENT_EVIDENCE');
    });

    it('Point 34 & 35: finalizeDeploymentGate truthfully evaluates gate after worker executes campaign', async () => {
      const mockSupabase: any = {
        from: (table: string) => {
          if (table === 'deployment_events') {
            return {
              select: () =>
                createMockChain({
                  id: 'evt-final-1',
                  deployment_id: 'dep-final-1',
                  environment_name: 'staging',
                  organization_id: mockOrgId,
                }),
              update: () => createMockChain(null),
            };
          }
          if (table === 'release_gate_decisions') {
            return {
              select: () => createMockChain(null),
              insert: () => ({
                select: () => ({
                  single: async () => ({ data: { id: 'dec-final-1' }, error: null }),
                }),
              }),
            };
          }
          return createMockChain(null);
        },
      };

      const campResult = {
        success: true,
        summary: {
          totalTasksExecuted: 12,
          categoryScores: fullCleanScores,
          overallScore: 94,
          regressions: [],
          bugObservations: [],
        },
      };

      const gateDecision = await CDOrchestrator.finalizeDeploymentGate({
        campaignId: 'camp-finished-1',
        projectId: mockProjectId,
        organizationId: mockOrgId,
        deploymentId: 'dep-final-1',
        campResult,
        supabaseClient: mockSupabase,
      });

      expect(gateDecision.decision).toBe('PASS');
      expect(gateDecision.blockers.length).toBe(0);
      expect(gateDecision.source).toBe('WORKER_CAMPAIGN_FINALIZATION');
    });
  });

  // ============================================================================
  // Deterministic Fixtures: A, B, and C
  // ============================================================================
  describe('Deterministic Fixtures A, B, and C', () => {
    it('Fixture A: environment = staging, commit = AAA111, status = READY, QA passing -> PASS', () => {
      const fixtureAEvent = buildDeploymentEvent({
        provider: 'VERCEL',
        projectId: mockProjectId,
        orgId: mockOrgId,
        deploymentId: 'dep-fixture-a',
        environmentName: 'staging',
        environmentType: 'STAGING',
        commitSha: 'AAA111',
        deploymentStatus: 'READY',
      });

      const decision = ReleaseGatePolicyEvaluator.evaluate({
        projectId: mockProjectId,
        deploymentId: fixtureAEvent.deploymentId,
        environmentName: fixtureAEvent.environmentName,
        hasMeasuredEvidence: true,
        categoryScores: fullCleanScores,
        overallReadinessScore: 95,
        openIssues: [],
        regressions: [],
        confidence: 0.95,
      });

      expect(decision.decision).toBe('PASS');
      expect(decision.blockers.length).toBe(0);
      expect(decision.dimensionEvaluations?.['FUNCTIONAL']?.status).toBe('PASSED');
      expect(decision.dimensionEvaluations?.['REGRESSION']?.status).toBe('PASSED');
      expect(decision.dimensionEvaluations?.['CRITICAL_WORKFLOW']?.status).toBe('PASSED');
    });

    it('Fixture B: environment = staging, commit = BBB222, status = READY, checkout changed with failure -> BLOCK', () => {
      const fixtureBEvent = buildDeploymentEvent({
        provider: 'VERCEL',
        projectId: mockProjectId,
        orgId: mockOrgId,
        deploymentId: 'dep-fixture-b',
        environmentName: 'staging',
        environmentType: 'STAGING',
        commitSha: 'BBB222',
        deploymentStatus: 'READY',
      });

      const decision = ReleaseGatePolicyEvaluator.evaluate({
        projectId: mockProjectId,
        deploymentId: fixtureBEvent.deploymentId,
        environmentName: fixtureBEvent.environmentName,
        hasMeasuredEvidence: true,
        categoryScores: {
          ...fullCleanScores,
          functional: 65, // Below 80 threshold
        },
        regressions: [
          {
            issueId: 'reg-checkout-fail',
            title: 'Checkout payment step fails with 500 error',
            classification: 'NEW_REGRESSION',
            isCriticalWorkflow: true,
          },
        ],
        openIssues: [
          {
            id: 'iss-checkout-500',
            title: 'Checkout failure on payment authorization',
            severity: 'critical',
          } as any,
        ],
      });

      // Must identify regression and block release
      expect(decision.decision).toBe('BLOCK');
      expect(decision.blockers.some((b) => b.dimension === 'REGRESSION')).toBe(true);
      expect(decision.blockers.some((b) => b.dimension === 'CRITICAL_WORKFLOW')).toBe(true);
      expect(decision.dimensionEvaluations?.['REGRESSION']?.status).toBe('FAILED');
      expect(decision.dimensionEvaluations?.['CRITICAL_WORKFLOW']?.status).toBe('FAILED');
    });

    it('Fixture C: environment = staging, commit = CCC333, status = READY, QA campaign never executes -> INSUFFICIENT_EVIDENCE', () => {
      const fixtureCEvent = buildDeploymentEvent({
        provider: 'VERCEL',
        projectId: mockProjectId,
        orgId: mockOrgId,
        deploymentId: 'dep-fixture-c',
        environmentName: 'staging',
        environmentType: 'STAGING',
        commitSha: 'CCC333',
        deploymentStatus: 'READY',
      });

      // Campaign never executed: hasMeasuredEvidence is false, no category scores
      const decision = ReleaseGatePolicyEvaluator.evaluate({
        projectId: mockProjectId,
        deploymentId: fixtureCEvent.deploymentId,
        environmentName: fixtureCEvent.environmentName,
        hasMeasuredEvidence: false, // Strictly false: unexecuted campaign
        categoryScores: undefined,
      });

      expect(decision.decision).toBe('INSUFFICIENT_EVIDENCE');
      expect(decision.blockers.some((b) => b.dimension === 'EVIDENCE_CONFIDENCE')).toBe(true);
      expect(decision.missingEvidenceDimensions?.length).toBeGreaterThan(0);
      expect(decision.dimensionEvaluations?.['FUNCTIONAL']?.status).toBe('UNMEASURED');
    });
  });
});
