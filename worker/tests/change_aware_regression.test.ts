// ==============================================================================
// Prompt 60: Change-Aware Autonomous Regression Intelligence Test Suite
// (worker/tests/change_aware_regression.test.ts)
// ==============================================================================

import { describe, it, expect } from 'vitest';
import {
  buildChangeSnapshot,
  ImpactMapper,
  RegressionTargetGenerator,
  ChangeDecisionEngine,
  RegressionComparator,
  classifyChangedFile,
  ChangedFile,
} from '../src/change-intelligence';
import { ProductModel } from '../src/product';
import { QASignalRecord, HistoricalRun } from '../src/history/types';
import { CampaignTaskResult } from '../src/campaign/types';

describe('Prompt 60: Change-Aware Autonomous Regression Intelligence', () => {
  const sampleProductModel: ProductModel = {
    projectId: 'proj-p60',
    analyzedCommit: 'commit-001',
    summary: 'Sculra Test Product Architecture',
    businessContext: 'E-commerce checkout & auth engine',
    criticalWorkflowsCount: 1,
    highWorkflowsCount: 1,
    mediumWorkflowsCount: 0,
    rolesCount: 2,
    featuresCount: 3,
    confidence: 'HIGH',
    analyzedAt: new Date().toISOString(),
    workflows: [
      {
        id: 'wf-checkout',
        name: 'Checkout & Payment Processing',
        criticality: {
          level: 'CRITICAL',
          score: 95,
          reasons: ['Direct revenue transaction path'],
          classificationSource: 'DETERMINISTIC_RULES',
        },
        steps: [
          { order: 1, description: 'Navigate to Cart', pageUrl: '/cart' },
          { order: 2, description: 'Submit Payment', pageUrl: '/checkout' },
        ],
        prerequisites: [],
        requiredRoles: ['MEMBER'],
      },
      {
        id: 'wf-search',
        name: 'Product Catalog Search',
        criticality: {
          level: 'HIGH',
          score: 75,
          reasons: ['Customer discovery funnel'],
          classificationSource: 'DETERMINISTIC_RULES',
        },
        steps: [{ order: 1, description: 'Search items', pageUrl: '/search' }],
        prerequisites: [],
        requiredRoles: ['ANONYMOUS'],
      },
    ],
    features: [],
    roles: [
      { name: 'ANONYMOUS', permissions: ['browse'] },
      { name: 'MEMBER', permissions: ['browse', 'purchase'] },
    ],
  };

  const sampleHistoricalSignals: QASignalRecord[] = [
    {
      id: 'sig-rec-1',
      projectId: 'proj-p60',
      testRunId: 'run-prev',
      signalType: 'RECOVERED_DEFECT',
      targetType: 'API',
      targetIdentifier: 'POST /api/checkout',
      severity: 'high',
      confidence: 'high',
      occurrenceCount: 3,
      consecutiveCount: 1,
      environment: 'staging',
      firstSeenAt: '2026-09-01T00:00:00Z',
      lastSeenAt: '2026-09-20T00:00:00Z',
      metadata: { reason: 'Previously resolved 500 error on payment webhook payload' },
    },
    {
      id: 'sig-flaky-1',
      projectId: 'proj-p60',
      testRunId: 'run-prev',
      signalType: 'INTERMITTENT_TARGET',
      targetType: 'ROUTE',
      targetIdentifier: '/cart',
      severity: 'medium',
      confidence: 'medium',
      occurrenceCount: 5,
      consecutiveCount: 1,
      environment: 'staging',
      firstSeenAt: '2026-09-01T00:00:00Z',
      lastSeenAt: '2026-09-20T00:00:00Z',
      metadata: { reason: 'Hydration timing glitch observed intermittently' },
    },
  ];

  // ============================================================================
  // Dimension 1: Canonical Change Snapshot ("What changed?")
  // ============================================================================
  describe('Canonical ChangeSnapshot & Classification', () => {
    it('accurately captures product code changes across UI, API, and Database', () => {
      const changedFiles: ChangedFile[] = [
        {
          path: 'src/app/checkout/page.tsx',
          status: 'MODIFIED',
          additions: 25,
          deletions: 5,
          changes: 30,
          hunks: [{ oldStart: 1, oldLines: 10, newStart: 1, newLines: 30, lines: ['+ export function CheckoutForm() {'] }],
          isBinary: false,
          isGeneratedOrMinified: false,
          isLockfile: false,
          isDocumentation: false,
          classifications: classifyChangedFile('src/app/checkout/page.tsx'),
        },
        {
          path: 'src/app/api/checkout/route.ts',
          status: 'MODIFIED',
          additions: 15,
          deletions: 2,
          changes: 17,
          hunks: [{ oldStart: 1, oldLines: 5, newStart: 1, newLines: 18, lines: ['+ export async function POST(req: Request) {'] }],
          isBinary: false,
          isGeneratedOrMinified: false,
          isLockfile: false,
          isDocumentation: false,
          classifications: classifyChangedFile('src/app/api/checkout/route.ts'),
        },
      ];

      const snapshot = buildChangeSnapshot({
        commitSha: 'a1b2c3d4e5f6',
        branch: 'feat/checkout-tax',
        source: 'GIT',
        files: changedFiles,
      });

      expect(snapshot.commitSha).toBe('a1b2c3d4e5f6');
      expect(snapshot.totalAdditions).toBe(40);
      expect(snapshot.totalDeletions).toBe(7);
      expect(snapshot.sizeCategory).toBe('SMALL');
      expect(snapshot.isDocumentationOnly).toBe(false);
      expect(snapshot.isTestOnly).toBe(false);
      expect(snapshot.classifications).toContain('UI');
      expect(snapshot.classifications).toContain('API');
    });

    it('identifies Documentation-Only change sets for safe test reduction', () => {
      const docFiles: ChangedFile[] = [
        {
          path: 'README.md',
          status: 'MODIFIED',
          additions: 10,
          deletions: 2,
          changes: 12,
          hunks: [],
          isBinary: false,
          isGeneratedOrMinified: false,
          isLockfile: false,
          isDocumentation: true,
          classifications: ['DOCUMENTATION'],
        },
        {
          path: 'docs/architecture.md',
          status: 'ADDED',
          additions: 50,
          deletions: 0,
          changes: 50,
          hunks: [],
          isBinary: false,
          isGeneratedOrMinified: false,
          isLockfile: false,
          isDocumentation: true,
          classifications: ['DOCUMENTATION'],
        },
      ];

      const snapshot = buildChangeSnapshot({
        commitSha: 'doc123456789',
        branch: 'docs/update',
        source: 'PR',
        files: docFiles,
      });

      expect(snapshot.isDocumentationOnly).toBe(true);
      expect(snapshot.isTestOnly).toBe(false);
      expect(snapshot.classifications).toEqual(['DOCUMENTATION']);
    });

    it('identifies Test-Only changes to optimize test execution', () => {
      const testFiles: ChangedFile[] = [
        {
          path: 'tests/checkout.test.ts',
          status: 'MODIFIED',
          additions: 10,
          deletions: 2,
          changes: 12,
          hunks: [],
          isBinary: false,
          isGeneratedOrMinified: false,
          isLockfile: false,
          isDocumentation: false,
          classifications: ['TEST', 'TEST_ONLY'],
        },
      ];

      const snapshot = buildChangeSnapshot({
        commitSha: 'test12345678',
        source: 'CI',
        files: testFiles,
      });

      expect(snapshot.isDocumentationOnly).toBe(false);
      expect(snapshot.isTestOnly).toBe(true);
    });
  });

  // ============================================================================
  // Dimension 2: Canonical ImpactGraph & Bounded Mapping ("What is affected?")
  // ============================================================================
  describe('Bounded Impact Mapping & Cycle Detection', () => {
    it('builds multi-tier graph: File -> Function -> Route -> Workflow -> QA Target', () => {
      const changedFiles: ChangedFile[] = [
        {
          path: 'src/app/checkout/page.tsx',
          status: 'MODIFIED',
          additions: 20,
          deletions: 5,
          changes: 25,
          hunks: [{
            oldStart: 1,
            oldLines: 5,
            newStart: 1,
            newLines: 20,
            lines: ['+ export function CheckoutForm() { return <div />; }'],
          }],
          isBinary: false,
          isGeneratedOrMinified: false,
          isLockfile: false,
          isDocumentation: false,
          classifications: ['UI', 'ROUTING'],
        },
      ];

      const impactGraph = ImpactMapper.buildImpactGraph({
        changedFiles,
        affectedRoutes: [{ route: '/checkout', confidence: 'HIGH', reason: 'Touched src/app/checkout/page.tsx' }],
        affectedApis: [{ path: '/api/checkout', method: 'POST', confidence: 'HIGH', reason: 'Checkout API endpoint' }],
        affectedWorkflows: [{
          workflowId: 'wf-checkout',
          workflowName: 'Checkout & Payment Processing',
          criticality: 'CRITICAL',
          confidence: 'HIGH',
          reason: 'Route /checkout touches wf-checkout',
        }],
        productModel: sampleProductModel,
        historicalSignals: sampleHistoricalSignals,
      });

      expect(impactGraph.nodeCount).toBeGreaterThan(4);
      expect(impactGraph.nodes['src/app/checkout/page.tsx']).toBeDefined();
      expect(impactGraph.nodes['/checkout']).toBeDefined();
      expect(impactGraph.nodes['workflow:wf-checkout']).toBeDefined();
      expect(impactGraph.nodes['qa_target:workflow:wf-checkout']).toBeDefined();

      // Verify edge relationships
      const hasServesEdge = impactGraph.edges.some(
        (e) => e.sourceId === 'src/app/checkout/page.tsx' && e.targetId === '/checkout' && e.relationship === 'SERVES'
      );
      expect(hasServesEdge).toBe(true);

      const hasTestedByEdge = impactGraph.edges.some(
        (e) => e.targetId === 'qa_target:workflow:wf-checkout' && e.relationship === 'TESTED_BY'
      );
      expect(hasTestedByEdge).toBe(true);
    });
  });

  // ============================================================================
  // Dimension 3: 10-Source Regression Target Discovery
  // ============================================================================
  describe('10-Source Regression Target Discovery', () => {
    it('discovers targets across direct, critical, recovered, flaky, and visual sources', () => {
      const snapshot = buildChangeSnapshot({
        commitSha: 'commit-prod-01',
        source: 'GIT',
        files: [
          {
            path: 'src/app/checkout/page.tsx',
            status: 'MODIFIED',
            additions: 15,
            deletions: 2,
            changes: 17,
            hunks: [],
            isBinary: false,
            isGeneratedOrMinified: false,
            isLockfile: false,
            isDocumentation: false,
            classifications: ['UI', 'FORM'],
          },
        ],
      });

      const candidates = RegressionTargetGenerator.generateCandidates({
        snapshot,
        affectedWorkflows: [{
          workflowId: 'wf-checkout',
          workflowName: 'Checkout & Payment Processing',
          criticality: 'CRITICAL',
          confidence: 'HIGH',
          reason: 'Workflow touches checkout page',
        }],
        affectedApis: [{ path: '/api/checkout', method: 'POST', confidence: 'HIGH', reason: 'Checkout endpoint' }],
        affectedRoutes: [{ route: '/checkout', confidence: 'HIGH', reason: 'Checkout route modified' }],
        productModel: sampleProductModel,
        historicalSignals: sampleHistoricalSignals,
        targetUrl: 'http://localhost:3000',
        hasVisualBaselineLookup: (route) => route === '/home', // /checkout has no baseline
      });

      expect(candidates.length).toBeGreaterThanOrEqual(5);

      const sources = candidates.map((c) => c.source);
      expect(sources).toContain('DIRECT_WORKFLOW');
      expect(sources).toContain('CRITICAL_WORKFLOW');
      expect(sources).toContain('AFFECTED_API');
      expect(sources).toContain('RECOVERED_REGRESSION');
      expect(sources).toContain('FLAKY_OR_RECURRING');
      expect(sources).toContain('VISUAL_BASELINE');
      expect(sources).toContain('ACCESSIBILITY_SURFACE');

      // Zero fake visual diffs: verifies hasVisualBaseline is accurately false
      const visualCandidate = candidates.find((c) => c.source === 'VISUAL_BASELINE');
      expect(visualCandidate?.hasVisualBaseline).toBe(false);
      expect(visualCandidate?.reason).toContain('NO_BASELINE');
    });
  });

  // ============================================================================
  // Dimension 4: Decision Engine & Critical Workflow Override ("What to test vs skip")
  // ============================================================================
  describe('Change Decision Engine & Critical Workflow Override', () => {
    it('safely skips non-critical routes on documentation-only change', () => {
      const docSnapshot = buildChangeSnapshot({
        commitSha: 'commit-docs-only',
        source: 'GIT',
        files: [
          {
            path: 'README.md',
            status: 'MODIFIED',
            additions: 5,
            deletions: 1,
            changes: 6,
            hunks: [],
            isBinary: false,
            isGeneratedOrMinified: false,
            isLockfile: false,
            isDocumentation: true,
            classifications: ['DOCUMENTATION'],
          },
        ],
      });

      const candidates = [
        {
          id: 'cand-search',
          source: 'DIRECT_WORKFLOW' as const,
          targetId: 'wf-search',
          targetType: 'WORKFLOW' as const,
          targetIdentifier: 'Product Catalog Search',
          domain: 'JOURNEY',
          businessCriticality: 'HIGH' as const,
          priority: 75,
          reason: 'Non-critical workflow candidate',
        },
      ];

      const decisions = ChangeDecisionEngine.evaluate({
        snapshot: docSnapshot,
        candidates,
      });

      expect(decisions).toHaveLength(1);
      expect(decisions[0].decision).toBe('SKIP');
      expect(decisions[0].skipReason).toBe('DOCS_ONLY');
      expect(decisions[0].reason).toContain('Safe test reduction');
    });

    it('enforces Critical Workflow Override: NEVER skips critical workflows even on docs change', () => {
      const docSnapshot = buildChangeSnapshot({
        commitSha: 'commit-docs-only-critical',
        source: 'GIT',
        files: [
          {
            path: 'docs/guide.md',
            status: 'MODIFIED',
            additions: 10,
            deletions: 0,
            changes: 10,
            hunks: [],
            isBinary: false,
            isGeneratedOrMinified: false,
            isLockfile: false,
            isDocumentation: true,
            classifications: ['DOCUMENTATION'],
          },
        ],
      });

      const candidates = [
        {
          id: 'cand-checkout-critical',
          source: 'CRITICAL_WORKFLOW' as const,
          targetId: 'wf-checkout',
          targetType: 'WORKFLOW' as const,
          targetIdentifier: 'Checkout & Payment Processing',
          domain: 'JOURNEY',
          businessCriticality: 'CRITICAL' as const,
          priority: 100,
          reason: 'Revenue-critical payment flow',
        },
      ];

      const decisions = ChangeDecisionEngine.evaluate({
        snapshot: docSnapshot,
        candidates,
      });

      expect(decisions).toHaveLength(1);
      expect(decisions[0].decision).toBe('TEST');
      expect(decisions[0].criticalOverride).toBe(true);
      expect(decisions[0].reason).toContain('CRITICAL_WORKFLOW_OVERRIDE');
    });
  });

  // ============================================================================
  // Dimension 5: Post-Execution Regression Comparator ("Did change break anything?")
  // ============================================================================
  describe('Regression Comparator (7 Canonical Classifications)', () => {
    const baselineRun: HistoricalRun = {
      testRunId: 'run-baseline-001',
      projectId: 'proj-p60',
      status: 'passed',
      createdAt: '2026-09-25T10:00:00Z',
      environment: 'staging',
      targetUrl: 'http://localhost:3000',
      targets: [
        { targetType: 'PAGE', targetIdentifier: '/checkout', status: 'passed', tested: true },
        { targetType: 'API', targetIdentifier: 'POST /api/checkout', status: 'failed', tested: true },
        { targetType: 'PAGE', targetIdentifier: '/about', status: 'passed', tested: true },
      ],
      findings: [
        {
          fingerprint: 'fp-old-500',
          title: '500 error on POST /api/checkout',
          type: 'api_error',
          severity: 'high',
          category: 'api',
          targetUrl: 'http://localhost:3000/api/checkout',
          firstSeenAt: '2026-09-25T10:00:00Z',
          lastSeenAt: '2026-09-25T10:00:00Z',
          occurrenceCount: 1,
          consecutiveRunCount: 1,
          historicalStatus: 'CURRENT',
        },
      ],
    };

    it('classifies REGRESSION when a previously passing target fails on touched code', () => {
      const taskResults: CampaignTaskResult[] = [
        {
          taskId: 'task-checkout-regressed',
          status: 'FAILED',
          target: { id: 't1', type: 'PAGE', identifier: '/checkout' },
          domain: 'JOURNEY',
          findings: [],
          evidence: [],
          observations: [{
            fingerprint: 'obs-btn-broken',
            title: 'Checkout button unresponsive',
            severity: 'critical',
            type: 'functional_bug',
            selector: 'button#pay',
            url: 'http://localhost:3000/checkout',
          }],
          durationMs: 1200,
        },
      ];

      const comparison = RegressionComparator.compare({
        currentRunId: 'run-current-002',
        baselineRun,
        taskResults,
        snapshot: buildChangeSnapshot({
          commitSha: 'commit-bad-change',
          source: 'GIT',
          files: [{
            path: 'src/app/checkout/page.tsx',
            status: 'MODIFIED',
            additions: 10,
            deletions: 2,
            changes: 12,
            hunks: [],
            isBinary: false,
            isGeneratedOrMinified: false,
            isLockfile: false,
            isDocumentation: false,
            classifications: ['UI'],
          }],
        }),
      });

      expect(comparison.regressionsCount).toBe(1);
      expect(comparison.targets[0].classification).toBe('REGRESSION');
      expect(comparison.targets[0].baselineStatus).toBe('PASSED');
      expect(comparison.targets[0].currentStatus).toBe('FAILED');
      expect(comparison.targets[0].reason).toContain('REGRESSION CONFIRMED');
    });

    it('classifies RECOVERED when a previously failing target now passes', () => {
      const taskResults: CampaignTaskResult[] = [
        {
          taskId: 'task-api-recovered',
          status: 'COMPLETED',
          target: { id: 't2', type: 'API', identifier: 'POST /api/checkout' },
          domain: 'API',
          findings: [],
          evidence: [],
          observations: [],
          durationMs: 450,
        },
      ];

      const comparison = RegressionComparator.compare({
        currentRunId: 'run-current-003',
        baselineRun,
        taskResults,
      });

      expect(comparison.recoveriesCount).toBe(1);
      expect(comparison.targets[0].classification).toBe('RECOVERED');
      expect(comparison.targets[0].baselineStatus).toBe('FAILED');
      expect(comparison.targets[0].currentStatus).toBe('PASSED');
    });

    it('classifies UNCHANGED_PASS when an unmutated target remains healthy', () => {
      const taskResults: CampaignTaskResult[] = [
        {
          taskId: 'task-about-pass',
          status: 'COMPLETED',
          target: { id: 't3', type: 'PAGE', identifier: '/about' },
          domain: 'FUNCTIONAL',
          findings: [],
          evidence: [],
          observations: [],
          durationMs: 300,
        },
      ];

      const comparison = RegressionComparator.compare({
        currentRunId: 'run-current-004',
        baselineRun,
        taskResults,
      });

      expect(comparison.unchangedPassCount).toBe(1);
      expect(comparison.targets[0].classification).toBe('UNCHANGED_PASS');
      expect(comparison.targets[0].baselineStatus).toBe('PASSED');
      expect(comparison.targets[0].currentStatus).toBe('PASSED');
    });

    it('classifies INCONCLUSIVE on task execution error/timeout', () => {
      const taskResults: CampaignTaskResult[] = [
        {
          taskId: 'task-timeout-err',
          status: 'FAILED',
          target: { id: 't4', type: 'PAGE', identifier: '/heavy-report' },
          domain: 'PERFORMANCE',
          findings: [],
          evidence: [],
          observations: [],
          durationMs: 30000,
          error: 'Execution timed out after 30000ms waiting for selector',
        },
      ];

      const comparison = RegressionComparator.compare({
        currentRunId: 'run-current-005',
        baselineRun,
        taskResults,
      });

      expect(comparison.inconclusiveCount).toBe(1);
      expect(comparison.targets[0].classification).toBe('INCONCLUSIVE');
      expect(comparison.targets[0].reason).toContain('Execution encountered runtime or harness error');
    });
  });
});
