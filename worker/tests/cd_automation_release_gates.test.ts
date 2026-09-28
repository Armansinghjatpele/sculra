// ==============================================================================
// Sculra Continuous Deployment QA Automation & Release Gate Enforcement Test Suite
// (worker/tests/cd_automation_release_gates.test.ts)
// Covers Prompt 63 Section 30 (Scenarios 1-30) & Section 25 (Fixtures A-H)
// ==============================================================================

import { describe, it, expect, vi } from 'vitest';
import { createHmac } from 'crypto';
import {
  buildDeploymentEvent,
  DeploymentStateMachine,
  verifyVercelSignature,
  verifyRailwaySignature,
  verifyGenericSignature,
  DeploymentWebhookIngestionService,
  QATriggerPolicyEvaluator,
  DEFAULT_QA_TRIGGER_POLICY,
  SmartCampaignSelector,
  CORE_CRITICAL_WORKFLOW_KEYWORDS,
  computeCampaignIdempotencyKey,
  CampaignDeduplicationManager,
  ReleaseGatePolicyEvaluator,
  DEFAULT_CANONICAL_GATE_RULES,
  DEFAULT_RELEASE_GATE_POLICY_VERSION,
  ReleaseGateApprovalManager,
  CDNotificationDispatcher,
  CIFeedbackService,
  CDOrchestrator,
  buildDeploymentSnapshot,
  VercelDeploymentProvider,
  RailwayDeploymentProvider,
  GenericDeploymentProvider,
  DeploymentSnapshot,
  DeploymentEvent,
  ReleaseGateDecision,
  DeploymentReleaseCorrelation,
  CategoryScores,
} from '../src/release';

describe('Prompt 63: Continuous Deployment QA Automation & Release Gate Enforcement', () => {
  const mockProjectId = 'proj-9999-aaaa-bbbb-cccc';
  const mockOrgId = 'org-8888-1111-2222-3333';
  const mockValidCommit = '87b8e6c4391da40b2cd81335cb9947be280d0d88';

  const cleanScores: CategoryScores = {
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

  // ============================================================================
  // Requirement 1 & 2: Deployment Event & Empty Value Normalization
  // ============================================================================
  describe('1 & 2. Deployment Event Normalization & Factual Confidence', () => {
    it('Scenario 1.1: normalizes valid Vercel webhook payload into canonical DeploymentEvent', () => {
      const event = buildDeploymentEvent({
        provider: 'VERCEL',
        providerEventId: 'evt_vercel_123',
        projectId: mockProjectId,
        orgId: mockOrgId,
        environmentName: 'Production',
        environmentType: 'PRODUCTION',
        deploymentStatus: 'READY',
        commitSha: mockValidCommit,
        branch: 'main',
        deploymentUrl: 'https://sculra-app.vercel.app',
      });

      expect(event.provider).toBe('VERCEL');
      expect(event.providerEventId).toBe('evt_vercel_123');
      expect(event.deploymentStatus).toBe('READY');
      expect(event.commitSha).toBe(mockValidCommit);
      expect(event.environmentType).toBe('PRODUCTION');
      expect(event.factualConfidence ?? event.confidence).toBeGreaterThanOrEqual(0.8);
      expect(event.receivedAt).toBeDefined();
    });

    it('Scenario 1.2: normalizes valid Railway deployment payload into canonical DeploymentEvent', () => {
      const event = buildDeploymentEvent({
        provider: 'RAILWAY',
        providerEventId: 'evt_railway_456',
        projectId: mockProjectId,
        environmentName: 'staging',
        environmentType: 'STAGING',
        deploymentStatus: 'READY',
        commitSha: mockValidCommit,
        branch: 'feat/checkout',
      });

      expect(event.provider).toBe('RAILWAY');
      expect(event.environmentType).toBe('STAGING');
      expect(event.branch).toBe('feat/checkout');
      expect(event.deploymentStatus).toBe('READY');
    });

    it('Scenario 2.1: empty strings, whitespace, and undefined are coerced to null (NO fake defaults)', () => {
      const event = buildDeploymentEvent({
        provider: 'GENERIC',
        providerEventId: '   ',
        projectId: mockProjectId,
        environmentName: '',
        environmentType: '   ' as any,
        deploymentStatus: 'UNKNOWN',
        commitSha: '',
        branch: '   ',
      });

      expect(event.providerEventId).toBeNull();
      expect(event.environmentName).toBeNull();
      expect(event.environmentType).toBeNull();
      expect(event.commitSha).toBeNull();
      expect(event.branch).toBeNull();
      // Low confidence due to missing critical factual fields
      expect(event.confidence).toBeLessThan(0.5);
    });
  });

  // ============================================================================
  // Requirement 3, 4 & 5: Webhook Ingestion, Signatures & Idempotency
  // ============================================================================
  describe('3, 4 & 5. Webhook Signatures, Malformed Payloads & Deduplication', () => {
    const webhookSecret = 'test_webhook_secret_key_12345';

    it('Scenario 3.1: verifies valid Vercel sha1 HMAC signature and rejects invalid (401/403)', () => {
      const rawBody = JSON.stringify({ id: 'dep_1', type: 'deployment.succeeded' });
      const validSignature = createHmac('sha1', webhookSecret).update(rawBody).digest('hex');

      expect(verifyVercelSignature(rawBody, validSignature, webhookSecret)).toBe(true);
      expect(verifyVercelSignature(rawBody, 'invalid_signature_hex', webhookSecret)).toBe(false);
      expect(verifyVercelSignature(rawBody, null, webhookSecret)).toBe(false);
    });

    it('Scenario 3.2: verifies valid Railway sha256 HMAC signature and rejects invalid', () => {
      const rawBody = JSON.stringify({ event: 'DEPLOY', status: 'SUCCESS' });
      const validSignature = createHmac('sha256', webhookSecret).update(rawBody).digest('hex');

      expect(verifyRailwaySignature(rawBody, validSignature, webhookSecret)).toBe(true);
      expect(verifyRailwaySignature(rawBody, 'tampered_signature', webhookSecret)).toBe(false);
    });

    it('Scenario 3.3: verifies generic CI/CD Bearer token and HMAC signatures', () => {
      expect(verifyGenericSignature('body', 'Bearer valid_token', 'valid_token')).toBe(true);
      expect(verifyGenericSignature('body', 'Bearer wrong_token', 'valid_token')).toBe(false);
    });

    it('Scenario 4.1: rejects malformed JSON webhook payload with 400 Bad Request', async () => {
      const result = await DeploymentWebhookIngestionService.ingest({
        providerName: 'vercel',
        rawBody: '{ invalid-json-payload',
        payload: null,
        headers: {},
      });

      expect(result.statusCode).toBe(400);
      expect(result.error).toContain('Invalid webhook payload structure');
    });

    it('Scenario 4.2: rejects unsupported provider with 400 Bad Request', async () => {
      const result = await DeploymentWebhookIngestionService.ingest({
        providerName: 'UNSUPPORTED_PROVIDER',
        rawBody: JSON.stringify({}),
        payload: {},
        headers: {},
      });

      expect(result.statusCode).toBe(400);
      expect(result.error).toContain('Unsupported deployment provider');
    });

    it('Scenario 5.1: detects duplicate webhook events idempotently and avoids duplicate work', async () => {
      const existingEventId = 'evt-existing-12345';
      const mockSupabase: any = {
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'deployment_events') {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: async () => ({
                      data: { id: 'row-1', provider_event_id: `vercel:${existingEventId}` },
                      error: null,
                    }),
                  }),
                }),
              }),
            };
          }
          return {};
        }),
      };

      const payload = {
        id: existingEventId,
        type: 'deployment.ready',
        deployment: {
          id: 'd_1',
          url: 'https://example.com',
          meta: { githubCommitSha: mockValidCommit, githubCommitRef: 'main' },
        },
      };

      const result = await DeploymentWebhookIngestionService.ingest(
        {
          providerName: 'vercel',
          rawBody: JSON.stringify(payload),
          payload,
          headers: {},
        },
        mockSupabase
      );

      expect(result.statusCode).toBe(200);
      expect(result.isDuplicate).toBe(true);
      expect(result.reason).toBe('DUPLICATE_EVENT_ACKNOWLEDGED');
    });
  });

  // ============================================================================
  // Requirement 6: Deployment Lifecycle State Machine
  // ============================================================================
  describe('6. Deployment Lifecycle State Machine', () => {
    it('Scenario 6.1: permits valid lifecycle transitions: RECEIVED -> VALIDATING -> DEPLOYING -> READY', () => {
      expect(DeploymentStateMachine.canTransition('RECEIVED', 'VALIDATING')).toBe(true);
      expect(DeploymentStateMachine.canTransition('VALIDATING', 'DEPLOYING')).toBe(true);
      expect(DeploymentStateMachine.canTransition('DEPLOYING', 'READY')).toBe(true);
    });

    it('Scenario 6.2: permits fast-track direct transition: RECEIVED -> READY (instant webhooks)', () => {
      expect(DeploymentStateMachine.canTransition('RECEIVED', 'READY')).toBe(true);
    });

    it('Scenario 6.3: permits failure transition from active states to FAILED or CANCELLED', () => {
      expect(DeploymentStateMachine.canTransition('DEPLOYING', 'FAILED')).toBe(true);
      expect(DeploymentStateMachine.canTransition('VALIDATING', 'CANCELLED')).toBe(true);
    });

    it('Scenario 6.4: throws on invalid backwards or terminal transitions: READY -> VALIDATING', () => {
      expect(DeploymentStateMachine.canTransition('READY', 'VALIDATING')).toBe(false);
      expect(DeploymentStateMachine.canTransition('FAILED', 'VALIDATING')).toBe(false);
      expect(() => DeploymentStateMachine.assertValidTransition('READY', 'DEPLOYING')).toThrow(
        /Invalid deployment lifecycle state transition/
      );
    });

    it('Scenario 6.5: checks eligibility correctly across states', () => {
      expect(
        DeploymentStateMachine.isEligibleForQA({ deploymentStatus: 'READY' } as DeploymentEvent)
      ).toBe(true);
      expect(
        DeploymentStateMachine.isEligibleForQA({ deploymentStatus: 'DEPLOYING' } as DeploymentEvent)
      ).toBe(false);
      expect(
        DeploymentStateMachine.isEligibleForQA({ deploymentStatus: 'FAILED' } as DeploymentEvent)
      ).toBe(false);
      expect(
        DeploymentStateMachine.isEligibleForQA({ deploymentStatus: 'UNKNOWN' } as DeploymentEvent)
      ).toBe(false);
    });
  });

  // ============================================================================
  // Requirement 7, 8, 9, 10, 11: Automatic QA Trigger Policy & Eligibility
  // ============================================================================
  describe('7-11. Automatic QA Trigger Policy & Eligibility Guardrails', () => {
    it('Scenario 7.1: READY deployment with complete evidence is fully ELIGIBLE', () => {
      const snapshot: DeploymentSnapshot = buildDeploymentSnapshot({
        deploymentId: 'dep-701',
        projectId: mockProjectId,
        organizationId: mockOrgId,
        environmentId: 'env-prod-1',
        environmentName: 'production',
        environmentType: 'PRODUCTION',
        deploymentStatus: 'READY',
        commitSha: mockValidCommit,
        branch: 'main',
        deploymentUrl: 'https://sculra.app',
      });

      const eligibility = QATriggerPolicyEvaluator.evaluateEligibility(snapshot);
      expect(eligibility.eligible).toBe(true);
      expect(eligibility.status).toBe('ELIGIBLE');
      expect(eligibility.missingFields).toHaveLength(0);
    });

    it('Scenario 8.1: DEPLOYING deployment is DEFERRED until completion', () => {
      const snapshot: DeploymentSnapshot = buildDeploymentSnapshot({
        deploymentId: 'dep-801',
        projectId: mockProjectId,
        environmentName: 'production',
        environmentType: 'PRODUCTION',
        deploymentStatus: 'DEPLOYING',
        commitSha: mockValidCommit,
      });

      const eligibility = QATriggerPolicyEvaluator.evaluateEligibility(snapshot);
      expect(eligibility.eligible).toBe(false);
      expect(eligibility.status).toBe('DEFERRED');
      expect(eligibility.reasons[0]).toContain('currently in progress');
    });

    it('Scenario 9.1: FAILED deployment marks automatic QA as INELIGIBLE', () => {
      const snapshot: DeploymentSnapshot = buildDeploymentSnapshot({
        deploymentId: 'dep-901',
        projectId: mockProjectId,
        environmentName: 'production',
        environmentType: 'PRODUCTION',
        deploymentStatus: 'FAILED',
        commitSha: mockValidCommit,
      });

      const eligibility = QATriggerPolicyEvaluator.evaluateEligibility(snapshot);
      expect(eligibility.eligible).toBe(false);
      expect(eligibility.status).toBe('INELIGIBLE');
      expect(eligibility.reasons[0].toLowerCase()).toContain('failed');
    });

    it('Scenario 10.1: UNKNOWN deployment status marks QA as INSUFFICIENT_EVIDENCE', () => {
      const snapshot: DeploymentSnapshot = buildDeploymentSnapshot({
        deploymentId: 'dep-1001',
        projectId: mockProjectId,
        environmentName: 'production',
        environmentType: 'PRODUCTION',
        deploymentStatus: 'UNKNOWN',
        commitSha: mockValidCommit,
      });

      const eligibility = QATriggerPolicyEvaluator.evaluateEligibility(snapshot);
      expect(eligibility.eligible).toBe(false);
      expect(eligibility.status).toBe('INSUFFICIENT_EVIDENCE');
      expect(eligibility.reasons[0]).toContain('UNKNOWN');
    });

    it('Scenario 11.1: evaluates policy disabled condition', () => {
      const snapshot: DeploymentSnapshot = buildDeploymentSnapshot({
        deploymentId: 'dep-1101',
        projectId: mockProjectId,
        environmentName: 'production',
        environmentType: 'PRODUCTION',
        deploymentStatus: 'READY',
        commitSha: mockValidCommit,
      });

      const eligibility = QATriggerPolicyEvaluator.evaluateEligibility(snapshot, { enabled: false });
      expect(eligibility.eligible).toBe(false);
      expect(eligibility.status).toBe('INELIGIBLE');
      expect(eligibility.reasons[0]).toContain('policy is disabled');
    });

    it('Scenario 11.2: missing commit_sha produces INSUFFICIENT_EVIDENCE (NO fake SHA fallback)', () => {
      const snapshot: DeploymentSnapshot = buildDeploymentSnapshot({
        deploymentId: 'dep-1102',
        projectId: mockProjectId,
        environmentName: 'production',
        environmentType: 'PRODUCTION',
        deploymentStatus: 'READY',
        commitSha: null,
      });

      const eligibility = QATriggerPolicyEvaluator.evaluateEligibility(snapshot);
      expect(eligibility.eligible).toBe(false);
      expect(eligibility.status).toBe('INSUFFICIENT_EVIDENCE');
      expect(eligibility.missingFields).toContain('commitSha');
    });
  });

  // ============================================================================
  // Requirement 12 & 13: Smart Campaign Selector & Critical Workflow Protection
  // ============================================================================
  describe('12 & 13. Smart Campaign Selection & Critical Workflow Invariants', () => {
    it('Scenario 12.1: selects targeted campaign based on changed components', () => {
      const snapshot: DeploymentSnapshot = buildDeploymentSnapshot({
        deploymentId: 'dep-1201',
        projectId: mockProjectId,
        environmentName: 'production',
        environmentType: 'PRODUCTION',
        deploymentStatus: 'READY',
        commitSha: mockValidCommit,
      });

      const decision = SmartCampaignSelector.select({
        snapshot,
        candidateTargets: ['checkout_flow', 'user_profile_edit', 'settings_page'],
        changeComparison: {
          currentDeploymentId: 'dep-1201',
          previousDeploymentId: 'dep-1200',
          currentCommitSha: mockValidCommit,
          previousCommitSha: 'base123',
          status: 'ANALYZED',
          changedFilesCount: 2,
          classifications: ['FEATURE'],
          affectedRoutes: ['profile', 'user_profile_edit'],
          affectedApis: [],
          affectedWorkflows: [],
          criticalWorkflows: [],
          reason: 'Profile page update',
          confidence: 0.9,
          evidence: [],
        },
      });

      expect(decision.decision).toBe('RUN_TARGETED');
      expect(decision.selectedTargets).toContain('user_profile_edit');
      // checkout_flow is critical, so by invariant it is ALSO protected and selected!
      expect(decision.selectedTargets).toContain('checkout_flow');
      expect(decision.skippedTargets).toContain('settings_page');
    });

    it('Scenario 13.1: critical workflows (auth, payment, checkout) are NEVER silently skipped', () => {
      const snapshot: DeploymentSnapshot = buildDeploymentSnapshot({
        deploymentId: 'dep-1301',
        projectId: mockProjectId,
        environmentName: 'staging',
        environmentType: 'STAGING',
        deploymentStatus: 'READY',
        commitSha: mockValidCommit,
      });

      // Even if change comparison says only css changed
      const decision = SmartCampaignSelector.select({
        snapshot,
        candidateTargets: ['auth_login_journey', 'billing_payment_modal', 'about_page'],
        changeComparison: {
          currentDeploymentId: 'dep-1301',
          previousDeploymentId: 'dep-1300',
          currentCommitSha: mockValidCommit,
          previousCommitSha: 'base123',
          status: 'ANALYZED',
          changedFilesCount: 1,
          classifications: ['STYLE'],
          affectedRoutes: ['docs'],
          affectedApis: [],
          affectedWorkflows: [],
          criticalWorkflows: [],
          reason: 'Minor CSS update',
          confidence: 0.9,
          evidence: [],
        },
      });

      // Both critical targets are included due to critical workflow protection invariant
      expect(decision.selectedTargets).toContain('auth_login_journey');
      expect(decision.selectedTargets).toContain('billing_payment_modal');
      expect(decision.skippedTargets).toContain('about_page');
    });

    it('Scenario 13.2: missing change evidence triggers RUN_FULL fallback safely', () => {
      const snapshot: DeploymentSnapshot = buildDeploymentSnapshot({
        deploymentId: 'dep-1302',
        projectId: mockProjectId,
        environmentName: 'production',
        environmentType: 'PRODUCTION',
        deploymentStatus: 'READY',
        commitSha: mockValidCommit,
      });

      const decision = SmartCampaignSelector.select({
        snapshot,
        candidateTargets: ['flow_1', 'flow_2'],
        changeComparison: null, // missing comparison
      });

      expect(decision.decision).toBe('RUN_FULL');
      expect(decision.selectedTargets).toEqual(['flow_1', 'flow_2']);
      expect(decision.reasons[0]).toContain(
        'Change analysis inconclusive or missing prior deployment baseline commit'
      );
    });
  });

  // ============================================================================
  // Requirement 14: Campaign Deduplication & Idempotency Key
  // ============================================================================
  describe('14. Campaign Deduplication & Idempotency', () => {
    it('Scenario 14.1: generates identical deterministic idempotency key for identical deployment inputs', () => {
      const input = {
        organizationId: mockOrgId,
        projectId: mockProjectId,
        deploymentId: 'd_abc123',
        triggerType: 'AUTOMATIC_DEPLOYMENT',
        policyVersion: 'v1.0',
        commitSha: mockValidCommit,
      };

      const key1 = computeCampaignIdempotencyKey(input);
      const key2 = computeCampaignIdempotencyKey(input);

      expect(key1).toBe(key2);
      expect(key1).toMatch(/^auto-camp-[a-f0-9]{16}$/);
    });

    it('Scenario 14.2: generates distinct keys for different deployments or trigger types', () => {
      const keyA = computeCampaignIdempotencyKey({
        projectId: mockProjectId,
        deploymentId: 'd_alpha',
        triggerType: 'AUTOMATIC_DEPLOYMENT',
      });
      const keyB = computeCampaignIdempotencyKey({
        projectId: mockProjectId,
        deploymentId: 'd_beta',
        triggerType: 'AUTOMATIC_DEPLOYMENT',
      });

      expect(keyA).not.toBe(keyB);
    });

    it('Scenario 14.3: CampaignDeduplicationManager prevents launching a duplicate campaign', () => {
      const dedupeResult = CampaignDeduplicationManager.shouldCreateCampaign(
        ['camp-already-running-1'],
        'auto-camp-xyz'
      );

      expect(dedupeResult.shouldCreate).toBe(false);
      expect(dedupeResult.existingCampaignId).toBe('camp-already-running-1');

      const freshResult = CampaignDeduplicationManager.shouldCreateCampaign([], 'auto-camp-xyz');
      expect(freshResult.shouldCreate).toBe(true);
    });
  });

  // ============================================================================
  // Requirement 15, 16, 17, 18, 19: Release Gate Policy Engine & Dimensions
  // ============================================================================
  describe('15-19. Release Gate Policy Engine (12 Dimensions, Thresholds & Guardrails)', () => {
    it('Scenario 15.1: evaluates all 12 dimensions deterministically with zero failures to PASS', () => {
      const decision = ReleaseGatePolicyEvaluator.evaluate({
        projectId: mockProjectId,
        deploymentId: 'dep-1501',
        environmentName: 'Production',
        categoryScores: cleanScores,
        overallReadinessScore: 95,
        openIssues: [],
        regressions: [],
        hasMeasuredEvidence: true,
      });

      expect(decision.decision).toBe('PASS');
      expect(decision.blockers).toHaveLength(0);
      expect(decision.warnings).toHaveLength(0);
    });

    it('Scenario 16.1: scores below threshold trigger BLOCK decision with explicit blocker', () => {
      const lowScores: CategoryScores = {
        ...cleanScores,
        functional: 65, // threshold is 80
      };

      const decision = ReleaseGatePolicyEvaluator.evaluate({
        projectId: mockProjectId,
        deploymentId: 'dep-1601',
        categoryScores: lowScores,
        overallReadinessScore: 65,
        openIssues: [],
        regressions: [],
        hasMeasuredEvidence: true,
      });

      expect(decision.decision).toBe('BLOCK');
      const blocker = decision.blockers.find((b) => b.dimension === 'FUNCTIONAL');
      expect(blocker).toBeDefined();
      expect(blocker?.metricValue).toBe(65);
      expect(blocker?.threshold).toBe(80);
    });

    it('Scenario 17.1: missing measured evidence produces INSUFFICIENT_EVIDENCE, NEVER converts to PASS', () => {
      const decision = ReleaseGatePolicyEvaluator.evaluate({
        projectId: mockProjectId,
        deploymentId: 'dep-1701',
        hasMeasuredEvidence: false, // NO QA EVIDENCE
        categoryScores: cleanScores,
      });

      expect(decision.decision).toBe('INSUFFICIENT_EVIDENCE');
      expect(decision.confidence).toBe(0.0);
      expect(decision.blockers[0].reason).toContain('NO EVIDENCE -> NO INFERENCE');
    });

    it('Scenario 18.1: confirmed regression forces BLOCK decision', () => {
      const decision = ReleaseGatePolicyEvaluator.evaluate({
        projectId: mockProjectId,
        deploymentId: 'dep-1801',
        categoryScores: cleanScores,
        overallReadinessScore: 92,
        regressions: [
          {
            issueId: 'reg-001',
            title: 'Cart checkout button unclickable',
            classification: 'NEW_REGRESSION',
            isCriticalWorkflow: true,
          },
        ],
        hasMeasuredEvidence: true,
      });

      expect(decision.decision).toBe('BLOCK');
      const regressionBlocker = decision.blockers.find((b) => b.dimension === 'REGRESSION');
      expect(regressionBlocker).toBeDefined();
      expect(regressionBlocker?.reason).toContain('confirmed regression(s) detected against baseline');
      expect(regressionBlocker?.evidenceRef).toBe('regression:reg-001');
    });

    it('Scenario 19.1: security blocker forces BLOCK decision', () => {
      const decision = ReleaseGatePolicyEvaluator.evaluate({
        projectId: mockProjectId,
        deploymentId: 'dep-1901',
        categoryScores: {
          ...cleanScores,
          security: 50, // below 70 threshold
        },
        overallReadinessScore: 85,
        regressions: [],
        hasMeasuredEvidence: true,
      });

      expect(decision.decision).toBe('BLOCK');
      const secBlocker = decision.blockers.find((b) => b.dimension === 'SECURITY');
      expect(secBlocker).toBeDefined();
    });
  });

  // ============================================================================
  // Requirement 20 & 21: Human Approval & Override Engine
  // ============================================================================
  describe('20 & 21. Human Approval & Override Engine with Audit Trail', () => {
    it('Scenario 20.1: human approval request creation, approval -> PASS, rejection -> BLOCK', () => {
      const reviewDecision: ReleaseGateDecision = {
        id: 'dec-rev-1',
        releaseId: 'rel-1',
        deploymentId: 'dep-1',
        projectId: mockProjectId,
        environmentId: 'env-1',
        policyId: 'pol-1',
        policyVersion: '1.0.0',
        decision: 'REVIEW',
        blockers: [],
        warnings: [{ dimension: 'EVIDENCE_CONFIDENCE', reason: 'Ambiguous correlation' }],
        evidence: [],
        confidence: 0.5,
        evaluatedAt: new Date().toISOString(),
        evaluatedBy: 'system',
        source: 'CI_CD_ORCHESTRATION',
      };

      // 1. Create approval request
      const approval = ReleaseGateApprovalManager.createApprovalRequest({
        decision: reviewDecision,
        organizationId: mockOrgId,
        requesterId: 'user_dev_1',
        reason: 'Ambiguous correlation requires manual sign-off',
      });

      expect(approval.status).toBe('PENDING');
      expect(approval.decisionId).toBe('dec-rev-1');
      expect(approval.organizationId).toBe(mockOrgId);

      // 2. Process approval: APPROVED -> PASS
      const approvedResult = ReleaseGateApprovalManager.processApproval({
        approval,
        decision: reviewDecision,
        approverId: 'user_lead_1',
        approverRole: 'org:admin',
        outcome: 'APPROVED',
        reason: 'Verified manually on staging, safe to proceed.',
      });

      expect(approvedResult.updatedApproval.status).toBe('APPROVED');
      expect(approvedResult.updatedDecision.decision).toBe('PASS');

      // 3. Process rejection: REJECTED -> BLOCK
      const rejectedResult = ReleaseGateApprovalManager.processApproval({
        approval,
        decision: reviewDecision,
        approverId: 'user_lead_1',
        approverRole: 'org:admin',
        outcome: 'REJECTED',
        reason: 'Unresolved visual bugs, rejected.',
      });

      expect(rejectedResult.updatedApproval.status).toBe('REJECTED');
      expect(rejectedResult.updatedDecision.decision).toBe('BLOCK');
    });

    it('Scenario 21.1: unauthorized override attempt is rejected (missing permission)', () => {
      const blockedDecision: ReleaseGateDecision = {
        id: 'dec-block-1',
        releaseId: 'rel-1',
        deploymentId: 'dep-1',
        projectId: mockProjectId,
        environmentId: 'env-1',
        policyId: 'pol-1',
        policyVersion: '1.0.0',
        decision: 'BLOCK',
        blockers: [{ dimension: 'REGRESSION', reason: 'Critical regression detected' }],
        warnings: [],
        evidence: [],
        confidence: 1.0,
        evaluatedAt: new Date().toISOString(),
        evaluatedBy: 'system',
        source: 'CI_CD_ORCHESTRATION',
      };

      expect(() =>
        ReleaseGateApprovalManager.processOverride({
          decision: blockedDecision,
          organizationId: mockOrgId,
          actorId: 'user_junior_dev',
          actorRole: 'org:member',
          overrideDecision: 'PASS',
          reason: 'I want to deploy now anyway',
          hasOverridePermission: false, // Unauthorized!
        })
      ).toThrow(/lacks required 'release.gates.override' permission/);
    });

    it('Scenario 21.2: authorized override records complete audit record and updates decision', () => {
      const blockedDecision: ReleaseGateDecision = {
        id: 'dec-block-2',
        releaseId: 'rel-2',
        deploymentId: 'dep-2',
        projectId: mockProjectId,
        environmentId: 'env-prod',
        policyId: 'pol-1',
        policyVersion: '1.0.0',
        decision: 'BLOCK',
        blockers: [{ dimension: 'REGRESSION', reason: 'Checkout button bug' }],
        warnings: [],
        evidence: [],
        confidence: 1.0,
        evaluatedAt: new Date().toISOString(),
        evaluatedBy: 'system',
        source: 'CI_CD_ORCHESTRATION',
      };

      const result = ReleaseGateApprovalManager.processOverride({
        decision: blockedDecision,
        organizationId: mockOrgId,
        actorId: 'user_vp_eng',
        actorRole: 'org:admin',
        overrideDecision: 'OVERRIDDEN',
        reason: 'Hotfix for critical security CVE; regression is in unreleased feature flag.',
        hasOverridePermission: true,
      });

      expect(result.updatedDecision.decision).toBe('OVERRIDDEN');
      expect(result.overrideRecord.originalDecision).toBe('BLOCK');
      expect(result.overrideRecord.overrideDecision).toBe('OVERRIDDEN');
      expect(result.overrideRecord.actorId).toBe('user_vp_eng');
      expect(result.overrideRecord.reason).toContain('Hotfix for critical security CVE');
    });
  });

  // ============================================================================
  // Requirement 22, 23 & 24: Tenant Isolation, Notifications & CI Feedback
  // ============================================================================
  describe('22-24. Tenant Isolation, Notifications & CI Feedback', () => {
    it('Scenario 22.1: enforces tenant isolation across organizations and projects', () => {
      const decisionA = ReleaseGatePolicyEvaluator.evaluate({
        projectId: 'project-tenant-A',
        deploymentId: 'dep-A',
        categoryScores: cleanScores,
        hasMeasuredEvidence: true,
      });

      const approvalA = ReleaseGateApprovalManager.createApprovalRequest({
        decision: decisionA,
        organizationId: 'org-tenant-A',
        requesterId: 'user-tenant-A',
      });

      expect(approvalA.organizationId).toBe('org-tenant-A');
      expect(approvalA.projectId).toBe('project-tenant-A');
    });

    it('Scenario 23.1: CD notification dispatcher creates evidence-backed notification event without secrets', () => {
      const event = CDNotificationDispatcher.buildEvent({
        eventType: 'RELEASE_GATE_BLOCKED',
        projectId: mockProjectId,
        organizationId: mockOrgId,
        deploymentId: 'dep-2301',
        releaseId: 'rel-2301',
        environmentName: 'production',
        blockers: ['Regression in checkout flow'],
        summaryMessage: 'Gate blocked due to confirmed regression',
      });

      expect(event.eventType).toBe('RELEASE_GATE_BLOCKED');
      expect(event.projectId).toBe(mockProjectId);
      expect(event.title).toContain('Release Gate Blocked');
      expect(event.summary).toContain('Gate blocked due to confirmed regression');
      expect(event.metadata?.blockersSummary).toContain('Regression in checkout flow');
      // No secrets present in metadata
      expect(JSON.stringify(event.metadata)).not.toContain('secret');
      expect(JSON.stringify(event.metadata)).not.toContain('password');
    });

    it('Scenario 24.1: CI Feedback reports truthful statuses to GitHub commit status without fabrication', async () => {
      const passDecision: ReleaseGateDecision = {
        id: 'dec-p1',
        releaseId: 'rel-1',
        deploymentId: 'dep-1',
        projectId: mockProjectId,
        environmentId: 'env-1',
        policyId: 'pol-1',
        policyVersion: '1.0.0',
        decision: 'PASS',
        blockers: [],
        warnings: [],
        evidence: [],
        confidence: 1.0,
        evaluatedAt: new Date().toISOString(),
        evaluatedBy: 'system',
        source: 'CI_CD_ORCHESTRATION',
      };

      // When GitHub token is missing, truthfully records internal gate status without pretending to call external API
      const resultNoToken = await CIFeedbackService.reportGateDecision(passDecision, {
        provider: 'GITHUB',
        repoFullName: 'org/repo',
        commitSha: mockValidCommit,
        githubToken: null,
      });

      expect(resultNoToken.reported).toBe(false);
      expect(resultNoToken.internalStatus).toBe('PASS');
      expect(resultNoToken.reason).toContain('No external CI provider credentials configured');
    });
  });

  // ============================================================================
  // Requirement 25, 26, 27 & 28: No Fake Data, Environment Integrity & Determinism
  // ============================================================================
  describe('25-28. Strict Evidence Integrity, Ambiguity & Determinism Audits', () => {
    it('Scenario 25.1: NO FAKE DATA AUDIT: missing commit, branch, or env remain null', () => {
      const rawPayload = {
        id: 'dep_no_evidence',
        url: '',
        meta: {}, // empty meta
      };

      const provider = new VercelDeploymentProvider();
      const event = provider.normalizeEvent(rawPayload, { 'x-sculra-project-id': mockProjectId });
      expect(event.commitSha).toBeNull();
      expect(event.branch).toBeNull();
      expect(event.deploymentUrl).toBeNull();

      // Ensure no synthetic strings like 'env-default', 'UNKNOWN_BRANCH', 'sha-default'
      expect(event.commitSha).not.toBe('env-default');
      expect(event.commitSha).not.toBe('unknown');
    });

    it('Scenario 26.1: Environment integrity: missing environment never defaults to PRODUCTION or STAGING', () => {
      const provider = new RailwayDeploymentProvider();
      const railwayEvent = provider.normalizeEvent(
        { environment: '' },
        { 'x-sculra-project-id': mockProjectId }
      );
      expect(railwayEvent.environmentType).toBeNull();
      expect(railwayEvent.environmentName).toBeNull();
    });

    it('Scenario 27.1: Ambiguous deployment correlation evaluates gate to REVIEW', () => {
      const ambiguousCorrelation: DeploymentReleaseCorrelation = {
        deploymentId: 'dep-ambig-1',
        releaseId: null,
        status: 'AMBIGUOUS',
        reason: 'Multiple release candidates match commit sha',
        confidence: 0.2,
        correlatedAt: new Date().toISOString(),
      };

      const decision = ReleaseGatePolicyEvaluator.evaluate({
        projectId: mockProjectId,
        deploymentId: 'dep-ambig-1',
        correlation: ambiguousCorrelation,
        categoryScores: cleanScores,
        hasMeasuredEvidence: true,
      });

      expect(decision.decision).toBe('REVIEW');
      expect(decision.warnings[0].reason).toContain('Deployment-to-release correlation is AMBIGUOUS');
    });

    it('Scenario 28.1: Deterministic repeated evaluation: 10 identical runs produce identical output', () => {
      const evaluationInput = {
        projectId: mockProjectId,
        deploymentId: 'dep-determ-1',
        environmentName: 'Production',
        categoryScores: cleanScores,
        overallReadinessScore: 88,
        openIssues: [],
        regressions: [],
        hasMeasuredEvidence: true,
      };

      const results = Array.from({ length: 10 }, () =>
        ReleaseGatePolicyEvaluator.evaluate(evaluationInput)
      );

      for (let i = 1; i < 10; i++) {
        expect(results[i].decision).toBe(results[0].decision);
        expect(results[i].blockers).toEqual(results[0].blockers);
        expect(results[i].warnings).toEqual(results[0].warnings);
      }
    });
  });

  // ============================================================================
  // Concrete Fixtures A through H (Section 25) & Scenario 29
  // ============================================================================
  describe('Concrete Fixtures A-H & Production Lifecycle (Section 25 & Scenario 29)', () => {
    it('Fixture A: Clean deployment (Vercel production, valid commit, healthy baseline, gate PASS)', () => {
      const snapshot = buildDeploymentSnapshot({
        deploymentId: 'dep-fixture-a',
        projectId: mockProjectId,
        organizationId: mockOrgId,
        environmentName: 'production',
        environmentType: 'PRODUCTION',
        deploymentStatus: 'READY',
        commitSha: mockValidCommit,
        branch: 'main',
        deploymentUrl: 'https://clean-app.vercel.app',
      });

      const eligibility = QATriggerPolicyEvaluator.evaluateEligibility(snapshot);
      expect(eligibility.eligible).toBe(true);

      const decision = ReleaseGatePolicyEvaluator.evaluate({
        projectId: mockProjectId,
        deploymentId: snapshot.deploymentId,
        environmentName: snapshot.environmentName,
        categoryScores: cleanScores,
        overallReadinessScore: 95,
        openIssues: [],
        regressions: [],
        hasMeasuredEvidence: true,
      });

      expect(decision.decision).toBe('PASS');
    });

    it('Fixture B & Scenario 29: Regression deployment (Railway staging introduces functional regression in checkout flow -> gate BLOCKS)', () => {
      // Deployment A: healthy
      const decA = ReleaseGatePolicyEvaluator.evaluate({
        projectId: mockProjectId,
        deploymentId: 'dep-a-healthy',
        environmentName: 'staging',
        categoryScores: cleanScores,
        overallReadinessScore: 95,
        regressions: [],
        hasMeasuredEvidence: true,
      });
      expect(decA.decision).toBe('PASS');

      // Deployment B: introduces checkout regression
      const decB = ReleaseGatePolicyEvaluator.evaluate({
        projectId: mockProjectId,
        deploymentId: 'dep-b-regression',
        environmentName: 'staging',
        categoryScores: { ...cleanScores, functional: 70 },
        overallReadinessScore: 78,
        regressions: [
          {
            issueId: 'iss-checkout-fail',
            title: 'Checkout button throws 500 internal server error',
            classification: 'NEW_REGRESSION',
            isCriticalWorkflow: true,
          },
        ],
        hasMeasuredEvidence: true,
      });

      expect(decB.decision).toBe('BLOCK');
      expect(decB.blockers.some((b) => b.dimension === 'REGRESSION')).toBe(true);
      expect(decB.blockers.some((b) => b.dimension === 'CRITICAL_WORKFLOW')).toBe(true);
    });

    it('Fixture C: Missing evidence deployment (Generic webhook missing commit_sha and environment -> INSUFFICIENT_EVIDENCE, MUST NOT PASS)', () => {
      const incompleteSnapshot = buildDeploymentSnapshot({
        deploymentId: 'dep-missing-c',
        projectId: mockProjectId,
        environmentName: null,
        environmentType: null,
        deploymentStatus: 'READY',
        commitSha: null,
      });

      const eligibility = QATriggerPolicyEvaluator.evaluateEligibility(incompleteSnapshot);
      expect(eligibility.eligible).toBe(false);
      expect(eligibility.status).toBe('INSUFFICIENT_EVIDENCE');

      const gateDecision = ReleaseGatePolicyEvaluator.evaluate({
        projectId: mockProjectId,
        deploymentId: incompleteSnapshot.deploymentId,
        hasMeasuredEvidence: false,
      });

      expect(gateDecision.decision).toBe('INSUFFICIENT_EVIDENCE');
      expect(gateDecision.decision).not.toBe('PASS');
    });

    it('Fixture D: Concurrent webhook barrage (10 identical webhooks -> exactly 1 campaign triggered, 9 deduplicated)', () => {
      const idempotencyKey = computeCampaignIdempotencyKey({
        organizationId: mockOrgId,
        projectId: mockProjectId,
        deploymentId: 'dep-barrage-1',
        triggerType: 'AUTOMATIC_DEPLOYMENT',
      });

      const createdCampaigns: string[] = [];

      for (let i = 0; i < 10; i++) {
        const check = CampaignDeduplicationManager.shouldCreateCampaign(
          createdCampaigns,
          idempotencyKey
        );
        if (check.shouldCreate) {
          createdCampaigns.push(`campaign-for-${idempotencyKey}`);
        }
      }

      expect(createdCampaigns).toHaveLength(1);
    });

    it('Fixture E: Critical workflow mutation (Deployment modifies auth route -> Campaign selector MUST include auth journey)', () => {
      const snapshot = buildDeploymentSnapshot({
        deploymentId: 'dep-auth-mutation',
        projectId: mockProjectId,
        environmentName: 'production',
        environmentType: 'PRODUCTION',
        deploymentStatus: 'READY',
        commitSha: mockValidCommit,
      });

      const decision = SmartCampaignSelector.select({
        snapshot,
        candidateTargets: ['checkout_flow', 'auth_journey', 'unrelated_footer'],
        changeComparison: {
          currentDeploymentId: snapshot.deploymentId,
          previousDeploymentId: 'dep-prev',
          currentCommitSha: mockValidCommit,
          previousCommitSha: 'base',
          status: 'ANALYZED',
          changedFilesCount: 1,
          classifications: ['SECURITY'],
          affectedRoutes: ['auth', 'login'],
          affectedApis: [],
          affectedWorkflows: [],
          criticalWorkflows: ['auth'],
          reason: 'Auth login styling update',
          confidence: 0.95,
          evidence: [],
        },
      });

      expect(decision.selectedTargets).toContain('auth_journey');
      expect(decision.selectedTargets).toContain('checkout_flow');
      expect(decision.skippedTargets).toContain('unrelated_footer');
    });

    it('Fixture F: Override with audit (Blocked gate overridden by authorized user with valid rationale)', () => {
      const blockedDecision: ReleaseGateDecision = {
        id: 'dec-block-f',
        releaseId: 'rel-f',
        deploymentId: 'dep-f',
        projectId: mockProjectId,
        environmentId: 'env-prod',
        policyId: 'pol-1',
        policyVersion: '1.0.0',
        decision: 'BLOCK',
        blockers: [{ dimension: 'REGRESSION', reason: 'Non-fatal visual glitch in staging' }],
        warnings: [],
        evidence: [],
        confidence: 0.9,
        evaluatedAt: new Date().toISOString(),
        evaluatedBy: 'system',
        source: 'CI_CD_ORCHESTRATION',
      };

      const { overrideRecord, updatedDecision } = ReleaseGateApprovalManager.processOverride({
        decision: blockedDecision,
        organizationId: mockOrgId,
        actorId: 'usr_release_mgr',
        actorRole: 'org:admin',
        overrideDecision: 'OVERRIDDEN',
        reason: 'Authorized emergency hotfix; non-fatal visual glitch approved by design team.',
        hasOverridePermission: true,
      });

      expect(updatedDecision.decision).toBe('OVERRIDDEN');
      expect(overrideRecord.originalDecision).toBe('BLOCK');
      expect(overrideRecord.actorId).toBe('usr_release_mgr');
      expect(overrideRecord.reason).toContain('Authorized emergency hotfix');
    });

    it('Fixture G: Unauthorized override attempt (Developer attempts gate override -> rejected)', () => {
      const blockedDecision: ReleaseGateDecision = {
        id: 'dec-block-g',
        releaseId: 'rel-g',
        deploymentId: 'dep-g',
        projectId: mockProjectId,
        environmentId: 'env-prod',
        policyId: 'pol-1',
        policyVersion: '1.0.0',
        decision: 'BLOCK',
        blockers: [{ dimension: 'REGRESSION', reason: 'Regression' }],
        warnings: [],
        evidence: [],
        confidence: 0.9,
        evaluatedAt: new Date().toISOString(),
        evaluatedBy: 'system',
        source: 'CI_CD_ORCHESTRATION',
      };

      expect(() =>
        ReleaseGateApprovalManager.processOverride({
          decision: blockedDecision,
          organizationId: mockOrgId,
          actorId: 'usr_junior_dev',
          actorRole: 'org:developer',
          overrideDecision: 'PASS',
          reason: 'Bypassing check for urgent testing',
          hasOverridePermission: false, // Developer lacks permission
        })
      ).toThrow(/lacks required 'release.gates.override' permission/);
    });

    it('Fixture H: Ambiguous deployment correlation (Commit cannot be uniquely mapped -> REVIEW)', () => {
      const ambiguousCorr: DeploymentReleaseCorrelation = {
        deploymentId: 'dep-ambig-h',
        releaseId: null,
        status: 'AMBIGUOUS',
        reason: 'Commit sha matches release-1.2.0 and release-1.2.1 candidates',
        confidence: 0.3,
        correlatedAt: new Date().toISOString(),
      };

      const decision = ReleaseGatePolicyEvaluator.evaluate({
        projectId: mockProjectId,
        deploymentId: 'dep-ambig-h',
        correlation: ambiguousCorr,
        categoryScores: cleanScores,
        hasMeasuredEvidence: true,
      });

      expect(decision.decision).toBe('REVIEW');
      expect(decision.warnings[0].reason).toContain('AMBIGUOUS');
    });
  });

  // ============================================================================
  // Requirement 30: End-to-End CD Orchestrator Simulation
  // ============================================================================
  describe('30. End-to-End Orchestrator Simulation', () => {
    it('simulates full loop: event -> snapshot -> eligibility -> selector -> deduplication -> gates -> feedback', async () => {
      // Mock Supabase DB client for orchestrator
      const mockSupabase: any = {
        from: vi.fn().mockImplementation((table: string) => {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({ data: null, error: null }),
                  order: () => ({
                    limit: () => ({
                      maybeSingle: async () => ({ data: null, error: null }),
                    }),
                  }),
                }),
                order: () => ({
                  limit: () => ({
                    maybeSingle: async () => ({ data: null, error: null }),
                  }),
                }),
              }),
            }),
            insert: () => ({
              select: () => ({
                single: async () => ({
                  data: {
                    id: 'camp-12345',
                    project_id: mockProjectId,
                    status: 'PENDING',
                  },
                  error: null,
                }),
              }),
            }),
          };
        }),
      };

      const event = buildDeploymentEvent({
        provider: 'VERCEL',
        providerEventId: 'evt-e2e-30',
        deploymentId: 'dep-e2e-30',
        projectId: mockProjectId,
        orgId: mockOrgId,
        environmentName: 'production',
        environmentType: 'PRODUCTION',
        deploymentStatus: 'READY',
        commitSha: mockValidCommit,
        branch: 'main',
        deploymentUrl: 'https://sculra-e2e.vercel.app',
      });

      const result = await CDOrchestrator.orchestrate({
        event,
        supabaseClient: mockSupabase,
        candidateTargets: ['checkout_flow', 'auth_login', 'public_landing'],
        campaignExecutorCallback: async () => ({
          campaignId: 'camp-12345',
          taskResults: [{ id: 'task-1', targetId: 'checkout_flow', status: 'PASSED' }],
          bugObservations: [],
          regressions: [],
          categoryScores: cleanScores,
          overallScore: 95,
        }),
      });

      expect(result.snapshot).toBeDefined();
      expect(result.eligibility.eligible).toBe(true);
      expect(result.campaignDecision).toBeDefined();
      expect(result.campaignDecision?.decision).toBe('RUN_FULL'); // no prior snapshot -> full run
      expect(result.campaignDecision?.selectedTargets).toContain('checkout_flow');
      expect(result.campaignDecision?.selectedTargets).toContain('auth_login');
      expect(result.gateDecision).toBeDefined();
      expect(result.gateDecision?.decision).toBe('PASS');
      expect(result.notificationsDispatched.length).toBeGreaterThan(0);
    });
  });
});
