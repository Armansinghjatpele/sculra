// ==============================================================================
// Sculra Autonomous QA Control Plane & Campaign Engine Tests (worker/tests/campaign_engine.test.ts)
// ==============================================================================

import { describe, it, expect } from 'vitest';
import {
  CampaignBudgetManager,
  CampaignStateManager,
  CampaignDependencyGraph,
  AutonomousCampaignPlanner,
  CampaignScheduler,
  TargetSelector,
  CampaignEvidenceCorrelator,
  CampaignTerminationEvaluator,
  CampaignAnalyzer,
  CampaignEvidenceFormatter,
  DEFAULT_CAMPAIGN_POLICY,
  CampaignConfig,
  CampaignTask,
  CampaignTarget,
  CampaignTaskResult,
  CampaignProgressCalculator,
} from '../src/campaign';
import { ApplicationMap } from '../src/types';
import { ProductModel } from '../src/product';
import { BugObservation } from '../src/issues/types';
import { QASignalRecord } from '../src/history/types';

describe('Autonomous QA Control Plane & Campaign Engine Unit Suite', () => {
  const projectId = 'proj-control-plane-1';
  const campaignId = 'camp-test-123';
  const targetUrl = 'https://app.sculra-test.local';

  // Sample ApplicationMap fixture
  const sampleAppMap: ApplicationMap = {
    startUrl: targetUrl,
    totalPages: 3,
    totalLinks: 8,
    totalButtons: 5,
    totalForms: 2,
    totalInputs: 4,
    pages: [
      {
        url: `${targetUrl}/`,
        title: 'Home Page',
        depth: 0,
        elementsCount: 5,
        elements: [],
        forms: [],
        links: [],
        consoleErrors: [],
        networkErrors: [],
        timestamp: new Date().toISOString(),
      },
      {
        url: `${targetUrl}/dashboard`,
        title: 'User Dashboard',
        depth: 1,
        elementsCount: 4,
        elements: [],
        forms: [],
        links: [],
        consoleErrors: [],
        networkErrors: [],
        timestamp: new Date().toISOString(),
      },
      {
        url: `${targetUrl}/checkout`,
        title: 'Payment Checkout',
        depth: 1,
        elementsCount: 6,
        elements: [],
        forms: [],
        links: [],
        consoleErrors: [],
        networkErrors: [],
        timestamp: new Date().toISOString(),
      },
    ],
    discoveredAt: new Date().toISOString(),
  };

  // Sample ProductModel fixture
  const sampleProductModel: ProductModel = {
    appType: 'SaaS',
    profile: {
      applicationTypes: [{ type: 'SaaS', confidence: 0.95, evidence: [] }],
      primaryType: 'SaaS',
      detectedDomains: ['saas'],
      authenticationPresent: true,
      multiRoleSignals: true,
      majorSections: ['dashboard', 'checkout'],
      confidence: 0.9,
      evidenceReferences: [],
    },
    features: [
      {
        id: 'feat-checkout',
        name: 'Checkout Flow',
        description: 'Processes credit card payments',
        relatedPages: [`${targetUrl}/checkout`],
        relatedControls: [],
        relatedForms: [],
        relatedRoutes: ['/checkout'],
        relatedWorkflowIds: ['wf-checkout'],
        confidence: 0.9,
        evidence: [],
        criticality: { score: 95, level: 'CRITICAL', reasons: ['Handles revenue'], evidence: [], confidence: 0.9 },
        status: 'CONFIRMED',
        isCoreCapability: true,
      },
    ],
    roles: [
      {
        id: 'role-member',
        name: 'member',
        confidence: 0.9,
        evidence: [],
        observedCapabilities: [],
        relatedFeatureIds: ['feat-checkout'],
        relatedWorkflowIds: ['wf-checkout'],
        status: 'CONFIRMED',
      },
    ],
    workflows: [
      {
        id: 'wf-checkout',
        name: 'Order Placement Workflow',
        goal: 'Complete customer purchase',
        steps: [
          { id: 's1', stepNumber: 1, actionType: 'NAVIGATE', pageUrl: `${targetUrl}/checkout`, evidence: [], confidence: 0.9 },
        ],
        entryPoint: `${targetUrl}/checkout`,
        exitPoint: `${targetUrl}/checkout/success`,
        relatedFeatureIds: ['feat-checkout'],
        relatedRoutes: ['/checkout'],
        confidence: 0.9,
        evidence: [],
        criticality: { score: 95, level: 'CRITICAL', reasons: ['Revenue path'], evidence: [], confidence: 0.9 },
        status: 'CONFIRMED',
        executionStatus: 'UNTESTED',
      },
      {
        id: 'wf-settings',
        name: 'Profile Settings',
        goal: 'Update user settings',
        steps: [
          { id: 's2', stepNumber: 1, actionType: 'NAVIGATE', pageUrl: `${targetUrl}/settings`, evidence: [], confidence: 0.8 },
        ],
        entryPoint: `${targetUrl}/settings`,
        exitPoint: `${targetUrl}/settings`,
        relatedFeatureIds: [],
        relatedRoutes: ['/settings'],
        confidence: 0.8,
        evidence: [],
        criticality: { score: 75, level: 'HIGH', reasons: ['Account security & config'], evidence: [], confidence: 0.8 },
        status: 'CONFIRMED',
        executionStatus: 'UNTESTED',
      },
    ],
    graph: { nodes: [], edges: [] },
    evidence: [],
    testedAt: new Date().toISOString(),
  };

  describe('1. CampaignBudgetManager', () => {
    it('creates budget initialized with policy limits', () => {
      const bm = new CampaignBudgetManager({
        maxDurationSeconds: 120,
        maxTasks: 15,
      });

      const snap = bm.getSnapshot();
      expect(snap.maxDurationSeconds).toBe(120);
      expect(snap.maxTasks).toBe(15);
      expect(snap.tasksExecuted).toBe(0);
      expect(snap.tasksRemaining).toBe(15);
      expect(snap.adaptiveInsertionsCount).toBe(0);
    });

    it('denies task execution when max tasks limit reached', () => {
      const bm = new CampaignBudgetManager({ maxTasks: 2 });
      expect(bm.canExecuteTask().allowed).toBe(true);

      bm.recordTaskExecuted();
      expect(bm.canExecuteTask().allowed).toBe(true);

      bm.recordTaskExecuted();
      const check = bm.canExecuteTask();
      expect(check.allowed).toBe(false);
      expect(check.reason).toContain('Maximum task budget reached');
    });

    it('strictly bounds adaptive insertions', () => {
      const bm = new CampaignBudgetManager({ maxTasks: 50 });
      expect(bm.canInsertAdaptiveTask()).toBe(true);

      for (let i = 0; i < DEFAULT_CAMPAIGN_POLICY.maxAdaptiveInsertions; i++) {
        bm.recordAdaptiveInsertion();
      }

      expect(bm.canInsertAdaptiveTask()).toBe(false);
    });
  });

  describe('2. TargetSelector', () => {
    it('extracts targets from ApplicationMap, ProductModel, and API endpoints', () => {
      const apiEndpoints = [
        {
          id: 'ep-1',
          method: 'GET' as const,
          path: '/api/v1/orders',
          url: `${targetUrl}/api/v1/orders`,
          source: 'NETWORK_OBSERVATION' as const,
          firstSeen: new Date().toISOString(),
          lastSeen: new Date().toISOString(),
          confidence: 0.9,
          isAuthorizationBoundary: true,
        },
      ];

      const targets = TargetSelector.selectInitialTargets({
        targetUrl,
        config: { objective: 'full_suite', domains: ['DISCOVERY', 'PRODUCT', 'JOURNEY', 'API', 'SECURITY'] },
        applicationMap: sampleAppMap,
        productModel: sampleProductModel,
        apiEndpoints,
        historicalSignals: [],
      });

      expect(targets.length).toBeGreaterThanOrEqual(4);
      expect(targets.some((t) => t.type === 'PAGE' && t.identifier === '/')).toBe(true);
      expect(targets.some((t) => t.type === 'WORKFLOW' && t.identifier === 'Order Placement Workflow')).toBe(true);
      expect(targets.some((t) => t.type === 'API' && t.method === 'GET')).toBe(true);
    });

    it('boosts priority score for recent regressions and critical workflows', () => {
      const regSignal: QASignalRecord = {
        projectId,
        testRunId: 'prev-run',
        signalType: 'NEW_REGRESSION',
        targetType: 'page',
        targetIdentifier: '/checkout',
        severity: 'critical',
        confidence: 'high',
        occurrenceCount: 1,
        consecutiveCount: 1,
        environment: 'staging',
        metadata: {},
        firstSeenAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
      };

      const targets = TargetSelector.selectInitialTargets({
        targetUrl,
        config: { objective: 'regression', domains: ['JOURNEY'] },
        applicationMap: sampleAppMap,
        productModel: sampleProductModel,
        apiEndpoints: [],
        historicalSignals: [regSignal],
      });

      const checkoutTarget = targets.find((t) => t.identifier === '/checkout');
      expect(checkoutTarget).toBeDefined();
      expect(checkoutTarget!.isRecentRegression).toBe(true);
      expect(checkoutTarget!.strategyScore).toBeGreaterThanOrEqual(80);
    });

    it('creates reactive adaptive targets from bug observations', () => {
      const obs: BugObservation = {
        id: 'obs-1',
        testRunId: 'run-1',
        projectId,
        type: 'CLICK_TIMEOUT',
        severity: 'critical',
        confidence: 'high',
        status: 'open',
        title: 'Submit order button frozen',
        summary: 'Button did not respond',
        description: 'Button did not respond',
        url: `${targetUrl}/checkout/submit`,
        selector: '#btn-place-order',
        fingerprint: 'fp-btn-submit',
        reproductionSteps: [],
        timestamp: new Date().toISOString(),
      };

      const adaptiveTarget = TargetSelector.createAdaptiveTargetFromObservation(
        obs,
        targetUrl,
        []
      );

      expect(adaptiveTarget).not.toBeNull();
      expect(adaptiveTarget!.type).toBe('SELECTOR');
      expect(adaptiveTarget!.selector).toBe('#btn-place-order');
      expect(adaptiveTarget!.businessCriticality).toBe('CRITICAL');
      expect(adaptiveTarget!.isRecentRegression).toBe(true);
    });
  });

  describe('3. CampaignDependencyGraph & Scheduler', () => {
    it('builds valid DAG stages and respects stage ordering', () => {
      const stateManager = new CampaignStateManager({
        campaignId,
        projectId,
        objective: 'full_suite',
        config: { objective: 'full_suite', domains: ['DISCOVERY', 'JOURNEY', 'RELEASE'] },
      });

      const taskDiscovery: CampaignTask = {
        id: 't-disc',
        campaignId,
        taskType: 'APPLICATION_DISCOVERY',
        domain: 'DISCOVERY',
        target: { id: 'tgt-root', type: 'PAGE', identifier: '/' },
        priority: 100,
        reason: 'Root crawl',
        dependencies: [],
        status: 'PASSED',
        retryCount: 0,
      };

      const taskJourney: CampaignTask = {
        id: 't-journ',
        campaignId,
        taskType: 'JOURNEY_EXECUTION',
        domain: 'JOURNEY',
        target: { id: 'tgt-wf', type: 'WORKFLOW', identifier: 'Order Placement' },
        priority: 90,
        reason: 'Checkout journey',
        dependencies: ['t-disc'],
        status: 'QUEUED',
        retryCount: 0,
      };

      const taskRelease: CampaignTask = {
        id: 't-rel',
        campaignId,
        taskType: 'RELEASE_ASSESSMENT',
        domain: 'RELEASE',
        target: { id: 'tgt-root', type: 'PAGE', identifier: '/' },
        priority: 10,
        reason: 'Final scoring',
        dependencies: ['t-journ'],
        status: 'QUEUED',
        retryCount: 0,
      };

      stateManager.addTask(taskDiscovery);
      stateManager.addTask(taskJourney);
      stateManager.addTask(taskRelease);
      stateManager.markDomainExecuted('DISCOVERY');

      const completedTaskIds = new Set(['t-disc']);
      const activeDomains = new Set<import('../src/campaign').CampaignDomain>(['DISCOVERY', 'JOURNEY', 'RELEASE']);

      // Verify dependencies satisfied for t-journ since t-disc is PASSED
      const canExecJourney = CampaignDependencyGraph.canExecuteTask(
        taskJourney,
        completedTaskIds,
        stateManager.rawState.domainsExecuted,
        activeDomains,
        stateManager.rawState.tasks
      );
      expect(canExecJourney.canExecute).toBe(true);

      // Verify dependencies not satisfied for t-rel since t-journ is QUEUED
      const canExecRelease = CampaignDependencyGraph.canExecuteTask(
        taskRelease,
        completedTaskIds,
        stateManager.rawState.domainsExecuted,
        activeDomains,
        stateManager.rawState.tasks
      );
      expect(canExecRelease.canExecute).toBe(false);

      // Scheduler should yield ready tasks
      const ready = CampaignScheduler.getReadyTasks(stateManager.rawState, 2);
      expect(ready.length).toBe(1);
      expect(ready[0].id).toBe('t-journ');
    });

    it('blocks dependent tasks if dependency is pending', () => {
      const stateManager = new CampaignStateManager({
        campaignId,
        projectId,
        objective: 'full_suite',
        config: { objective: 'full_suite', domains: ['DISCOVERY', 'PRODUCT'] },
      });

      const taskDiscovery: CampaignTask = {
        id: 't-disc-fail',
        campaignId,
        taskType: 'APPLICATION_DISCOVERY',
        domain: 'DISCOVERY',
        target: { id: 'tgt-root', type: 'PAGE', identifier: '/' },
        priority: 100,
        reason: 'Root crawl',
        dependencies: [],
        status: 'RUNNING',
        retryCount: 0,
      };

      const taskProduct: CampaignTask = {
        id: 't-prod',
        campaignId,
        taskType: 'PRODUCT_MODEL_SYNTHESIS',
        domain: 'PRODUCT',
        target: { id: 'tgt-root', type: 'PAGE', identifier: '/' },
        priority: 95,
        reason: 'Product model',
        dependencies: ['t-disc-fail'],
        status: 'QUEUED',
        retryCount: 0,
      };

      stateManager.addTask(taskDiscovery);
      stateManager.addTask(taskProduct);

      const completedTaskIds = new Set<string>();
      const activeDomains = new Set<import('../src/campaign').CampaignDomain>(['DISCOVERY', 'PRODUCT']);

      const canExec = CampaignDependencyGraph.canExecuteTask(
        taskProduct,
        completedTaskIds,
        stateManager.rawState.domainsExecuted,
        activeDomains,
        stateManager.rawState.tasks
      );
      expect(canExec.canExecute).toBe(false);
    });
  });

  describe('4. AutonomousCampaignPlanner', () => {
    it('generates multi-stage tasks for full_suite objective', () => {
      const initialTargets = TargetSelector.selectInitialTargets({
        targetUrl,
        config: {
          objective: 'full_suite',
          domains: ['DISCOVERY', 'PRODUCT', 'JOURNEY', 'API', 'SECURITY', 'ACCESSIBILITY', 'PERFORMANCE', 'VISUAL', 'HISTORICAL', 'RELEASE'],
        },
        applicationMap: sampleAppMap,
        productModel: sampleProductModel,
      });

      const tasks = AutonomousCampaignPlanner.planCampaign(
        campaignId,
        targetUrl,
        {
          objective: 'full_suite',
          domains: ['DISCOVERY', 'PRODUCT', 'JOURNEY', 'API', 'SECURITY', 'ACCESSIBILITY', 'PERFORMANCE', 'VISUAL', 'HISTORICAL', 'RELEASE'],
        },
        initialTargets
      );

      expect(tasks.length).toBeGreaterThanOrEqual(6);
      expect(tasks.some((t) => t.domain === 'DISCOVERY')).toBe(true);
      expect(tasks.some((t) => t.domain === 'RELEASE')).toBe(true);
    });

    it('generates targeted tasks for regression objective', () => {
      const initialTargets = TargetSelector.selectInitialTargets({
        targetUrl,
        config: {
          objective: 'regression',
          domains: ['JOURNEY', 'HISTORICAL', 'RELEASE'],
        },
        applicationMap: sampleAppMap,
        productModel: sampleProductModel,
      });

      const tasks = AutonomousCampaignPlanner.planCampaign(
        campaignId,
        targetUrl,
        {
          objective: 'regression',
          domains: ['JOURNEY', 'HISTORICAL', 'RELEASE'],
        },
        initialTargets
      );

      expect(tasks.length).toBeGreaterThan(0);
      expect(tasks.some((t) => t.domain === 'JOURNEY')).toBe(true);
      expect(tasks.some((t) => t.domain === 'HISTORICAL')).toBe(true);
    });
  });

  describe('5. CampaignEvidenceCorrelator', () => {
    it('correlates functional failure with API 500 error', () => {
      const stateManager = new CampaignStateManager({
        campaignId,
        projectId,
        objective: 'full_suite',
        config: { objective: 'full_suite', domains: ['JOURNEY', 'API'] },
      });

      const taskJourney: CampaignTask = {
        id: 't-chk-fail',
        campaignId,
        taskType: 'JOURNEY_EXECUTION',
        domain: 'JOURNEY',
        target: { id: 'tgt-chk', type: 'WORKFLOW', identifier: 'Checkout' },
        priority: 90,
        reason: 'Test checkout',
        dependencies: [],
        status: 'RUNNING',
        retryCount: 0,
      };
      stateManager.addTask(taskJourney);

      stateManager.rawState.networkErrors.push({
        url: `${targetUrl}/api/checkout/pay`,
        method: 'POST',
        status: 500,
        timestamp: new Date().toISOString(),
      });

      const taskResult: CampaignTaskResult = {
        taskId: 't-chk-fail',
        status: 'FAILED',
        target: { id: 'tgt-chk', type: 'WORKFLOW', identifier: 'Checkout' },
        domain: 'JOURNEY',
        findings: [],
        evidence: [],
        observations: [
          {
            id: 'obs-fail-1',
            testRunId: 'run-1',
            projectId,
            type: 'RUNTIME_EXCEPTION',
            severity: 'critical',
            confidence: 'high',
            status: 'open',
            title: 'Payment gateway error 500',
            summary: '500 Server Error',
            description: '500 Server Error',
            url: `${targetUrl}/checkout`,
            fingerprint: 'fp-500-pay',
            reproductionSteps: [],
            timestamp: new Date().toISOString(),
          },
        ],
        durationMs: 1500,
      };

      const correlation = CampaignEvidenceCorrelator.correlate(stateManager.rawState, taskResult);
      expect(correlation.crossDomainCorrelations.length).toBeGreaterThan(0);
      expect(correlation.crossDomainCorrelations.some((c) => c.type === 'RELATED_BACKEND_FAILURE')).toBe(true);
    });
  });

  describe('6. CampaignTerminationEvaluator', () => {
    it('evaluates ALL_TASKS_COMPLETED when all tasks passed', () => {
      const stateManager = new CampaignStateManager({
        campaignId,
        projectId,
        objective: 'full_suite',
        config: { objective: 'full_suite', domains: ['DISCOVERY'] },
      });

      stateManager.addTask({
        id: 't-d1',
        campaignId,
        taskType: 'APPLICATION_DISCOVERY',
        domain: 'DISCOVERY',
        target: { id: 'tgt-1', type: 'PAGE', identifier: '/' },
        priority: 100,
        reason: 'Crawl',
        dependencies: [],
        status: 'PASSED',
        retryCount: 0,
      });

      const bm = new CampaignBudgetManager();
      const term = CampaignTerminationEvaluator.evaluate(stateManager.rawState, bm);
      expect(term.status).toBe('COMPLETED');
      expect(term.reason).toBe('ALL_TASKS_COMPLETED');
    });

    it('terminates with CRITICAL_BLOCKER_THRESHOLD when critical blocker count exceeds threshold', () => {
      const stateManager = new CampaignStateManager({
        campaignId,
        projectId,
        objective: 'full_suite',
        config: { objective: 'full_suite', domains: ['JOURNEY'] },
      });

      // Add 4 critical observations
      for (let i = 0; i < 4; i++) {
        stateManager.recordObservation({
          id: `obs-crit-${i}`,
          timestamp: new Date().toISOString(),
          domain: 'JOURNEY',
          taskId: 't-1',
          targetIdentifier: 'target-1',
          type: 'CRITICAL_BLOCKER',
          severity: 'critical',
          message: `Critical blocker ${i}`,
        });
      }

      const bm = new CampaignBudgetManager();
      const term = CampaignTerminationEvaluator.evaluate(stateManager.rawState, bm);
      expect(term.status).toBe('FAILED');
      expect(term.reason).toBe('CRITICAL_BLOCKER_THRESHOLD');
    });
  });

  describe('7. CampaignAnalyzer & ProgressCalculator', () => {
    it('calculates coverage metrics without metric fabrication', async () => {
      const stateManager = new CampaignStateManager({
        campaignId,
        projectId,
        objective: 'full_suite',
        config: { objective: 'full_suite', domains: ['DISCOVERY', 'JOURNEY', 'API'] },
      });

      stateManager.setApplicationMap(sampleAppMap);
      stateManager.setProductModel(sampleProductModel);

      stateManager.addTask({
        id: 't-1',
        campaignId,
        taskType: 'APPLICATION_DISCOVERY',
        domain: 'DISCOVERY',
        target: { id: 'tgt-1', type: 'PAGE', identifier: '/' },
        priority: 100,
        reason: 'Crawl',
        dependencies: [],
        status: 'PASSED',
        retryCount: 0,
      });

      stateManager.addTask({
        id: 't-2',
        campaignId,
        taskType: 'JOURNEY_EXECUTION',
        domain: 'JOURNEY',
        target: { id: 'tgt-2', type: 'WORKFLOW', identifier: 'Order Placement Workflow', workflowId: 'wf-checkout' },
        priority: 90,
        reason: 'Order flow',
        dependencies: [],
        status: 'PASSED',
        retryCount: 0,
      });

      const progress = CampaignProgressCalculator.calculateProgress(stateManager.rawState);
      expect(progress.taskCoveragePct).toBe(100);
      expect(progress.criticalWorkflowCoveragePct).toBe(50); // 1 of 2 critical workflows tested

      const analyzer = new CampaignAnalyzer();
      const summary = await analyzer.generateSummary(stateManager.rawState, 'ALL_TASKS_COMPLETED');

      expect(summary.status).toBe('COMPLETED');
      expect(summary.tasksPlanned).toBe(2);
      expect(summary.tasksPassed).toBe(2);
      expect(summary.criticalWorkflowsTested).toBe(1);
      expect(summary.criticalWorkflowsUntested).toBe(1);
      expect(summary.coverageSummary.pagesCovered).toBe(3);
    });
  });

  describe('8. CampaignEvidenceFormatter', () => {
    it('formats structured evidence for database persistence', () => {
      const taskResult: CampaignTaskResult = {
        taskId: 't-sample-ev',
        status: 'PASSED',
        target: { id: 'tgt-1', type: 'PAGE', identifier: '/dashboard' },
        domain: 'VISUAL',
        findings: [],
        evidence: [
          {
            type: 'visual_snapshot',
            title: 'Desktop Snapshot',
            url: `${targetUrl}/dashboard`,
            metadata: { width: 1280, height: 800 },
          },
        ],
        observations: [],
        durationMs: 800,
      };

      const record = CampaignEvidenceFormatter.formatTaskEvidence(projectId, taskResult);
      expect(record.project_id).toBe(projectId);
      expect(record.type).toBe('campaign_task_result');
      expect(record.title).toContain('VISUAL');
      expect(record.metadata?.target?.identifier).toBe('/dashboard');
    });
  });
});
