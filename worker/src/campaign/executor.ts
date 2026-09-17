// ==============================================================================
// Sculra Master Autonomous Campaign Executor (worker/src/campaign/executor.ts)
// ==============================================================================

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { SupabaseClient } from '@supabase/supabase-js';
import {
  CampaignConfig,
  CampaignSummary,
  CampaignTask,
  CampaignTaskResult,
  CampaignObjective,
  QACampaignStatus,
  CampaignDomain,
} from './types';
import { CampaignBudgetManager } from './budget';
import { CampaignStateManager } from './state';
import { CampaignDependencyGraph } from './dependency-graph';
import { AutonomousCampaignPlanner } from './planner';
import { CampaignScheduler } from './scheduler';
import { TargetSelector } from './target-selector';
import { CampaignEvidenceCorrelator } from './correlation';
import { CampaignTerminationEvaluator } from './termination';
import { CampaignAnalyzer } from './analyzer';
import { CampaignPersistenceManager } from './persistence';
import { CampaignEvidenceFormatter } from './evidence';
import {
  DiscoveryAdapter,
  ProductAdapter,
  AuthAdapter,
  JourneyAdapter,
  ApiAdapter,
  SecurityAdapter,
  AccessibilityAdapter,
  VisualAdapter,
  PerformanceAdapter,
  HistoricalAdapter,
  ReleaseAdapter,
} from './adapters';
import { CancellationToken, TestExecutionResult } from '../types';
import { WorkerLogger } from '../logger';

export interface CampaignExecutionOptions {
  campaignId: string;
  projectId: string;
  targetUrl: string;
  objective?: CampaignObjective;
  config?: Partial<CampaignConfig>;
  organizationId?: string;
  testRunId?: string;
  supabaseClient?: SupabaseClient | null;
  pastRuns?: any[];
  cancellationToken?: CancellationToken;
  browserInstance?: Browser;
  pageInstance?: Page;
  allowLocalhost?: boolean;
}

export class CampaignExecutor {
  private options: CampaignExecutionOptions;
  private logger: WorkerLogger;
  private stateManager: CampaignStateManager;
  private budgetManager: CampaignBudgetManager;
  private persistenceManager: CampaignPersistenceManager;
  private analyzer: CampaignAnalyzer;

  constructor(options: CampaignExecutionOptions) {
    this.options = options;
    this.logger = new WorkerLogger(options.campaignId, options.projectId);

    const objective = options.objective || options.config?.objective || 'release_readiness';
    const config: CampaignConfig = {
      objective,
      domains: options.config?.domains || [
        'DISCOVERY',
        'PRODUCT',
        'FUNCTIONAL',
        'JOURNEY',
        'API',
        'SECURITY',
        'ACCESSIBILITY',
        'VISUAL',
        'PERFORMANCE',
        'HISTORICAL',
        'RELEASE',
      ],
      environment: options.config?.environment || 'staging',
      branch: options.config?.branch || 'main',
      viewports: options.config?.viewports || ['desktop', 'tablet', 'mobile'],
      roles: options.config?.roles || ['ANONYMOUS'],
      maxDurationSeconds: options.config?.maxDurationSeconds || 600,
      maxTasks: options.config?.maxTasks || 100,
      maxConcurrentTasks: options.config?.maxConcurrentTasks || 4,
      targetUrl: options.targetUrl,
      ...options.config,
    };

    this.budgetManager = new CampaignBudgetManager(config);
    this.stateManager = new CampaignStateManager(
      options.campaignId,
      options.projectId,
      objective,
      config,
      this.budgetManager.getSnapshot(),
      options.organizationId
    );
    this.persistenceManager = new CampaignPersistenceManager(options.supabaseClient);
    this.analyzer = new CampaignAnalyzer();
  }

  /**
   * Executes the full autonomous QA campaign lifecycle.
   */
  async execute(): Promise<{
    success: boolean;
    status: QACampaignStatus;
    summary: CampaignSummary;
    error?: string;
  }> {
    const { campaignId, projectId, targetUrl, cancellationToken, pastRuns = [] } = this.options;
    this.logger.log('campaign_execution_initiated', { campaignId, targetUrl });

    // 1. Mark Campaign as RUNNING
    this.stateManager.setStatus('RUNNING');
    await this.persistenceManager.updateCampaign(campaignId, 'RUNNING', {
      startedAt: new Date().toISOString(),
    });

    let browser: Browser | null = this.options.browserInstance || null;
    let context: BrowserContext | null = null;
    let page: Page | null = this.options.pageInstance || null;
    let ownsBrowser = false;

    try {
      // 2. Launch Browser if not injected
      if (!browser) {
        browser = await chromium.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
        });
        ownsBrowser = true;
      }

      if (!page) {
        context = await browser.newContext({
          viewport: { width: 1280, height: 720 },
        });
        page = await context.newPage();
      } else {
        context = page.context();
      }

      // 3. Target Selection & Task Planning
      const initialTargets = TargetSelector.selectInitialTargets({
        targetUrl,
        config: this.stateManager.rawState.config,
        historicalSignals: this.stateManager.rawState.historicalSignals,
      });

      const plannedTasks = AutonomousCampaignPlanner.planCampaign(
        campaignId,
        targetUrl,
        this.stateManager.rawState.config,
        initialTargets
      );

      for (const t of plannedTasks) {
        this.stateManager.addTask(t);
      }

      await this.persistenceManager.insertTasks(
        campaignId,
        projectId,
        plannedTasks,
        this.options.organizationId
      );

      this.logger.log('campaign_planning_completed', {
        targetsCount: initialTargets.length,
        tasksCount: plannedTasks.length,
      });

      // 4. Master Autonomous Adaptive Loop
      let loopIteration = 0;
      const MAX_LOOP_ITERATIONS = 200;

      while (loopIteration++ < MAX_LOOP_ITERATIONS) {
        // Check Termination Conditions
        const termination = CampaignTerminationEvaluator.evaluate(
          this.stateManager.rawState,
          this.budgetManager,
          cancellationToken
        );

        if (termination.shouldTerminate) {
          this.stateManager.setStatus(termination.status || 'COMPLETED');
          this.stateManager.rawState.terminationReason = termination.reason;
          this.stateManager.rawState.terminationDetails = termination.details;
          break;
        }

        // Get Ready Tasks from Scheduler
        const readyTasks = CampaignScheduler.getReadyTasks(
          this.stateManager.rawState,
          this.stateManager.rawState.config.maxConcurrentTasks || 4
        );

        if (readyTasks.length === 0) {
          // If no tasks ready and none running, evaluate if all remaining tasks are blocked
          const remainingTasks = Array.from(this.stateManager.rawState.tasks.values()).filter(
            (t) => t.status === 'QUEUED' || t.status === 'PENDING_DEPENDENCIES' || t.status === 'RUNNING'
          );
          if (remainingTasks.length === 0) {
            break; // Finished
          }

          // Mark unresolvable pending tasks as BLOCKED
          for (const rt of remainingTasks) {
            if (rt.status === 'PENDING_DEPENDENCIES') {
              this.stateManager.updateTaskStatus(rt.id, 'BLOCKED');
              await this.persistenceManager.updateTask(rt.id, 'BLOCKED');
            }
          }
          break;
        }

        // Execute Ready Tasks
        for (const task of readyTasks) {
          if (cancellationToken?.isCancelled) break;

          const budgetCheck = this.budgetManager.canExecuteTask();
          if (!budgetCheck.allowed) {
            this.stateManager.updateTaskStatus(task.id, 'SKIPPED');
            continue;
          }

          this.stateManager.updateTaskStatus(task.id, 'RUNNING');
          await this.persistenceManager.updateTask(task.id, 'RUNNING', undefined, new Date().toISOString());

          const taskResult = await this.executeDomainTask(task, browser, page, context!, targetUrl, pastRuns);
          this.budgetManager.recordTaskExecuted();

          // Update task in state and DB
          this.stateManager.updateTaskStatus(task.id, taskResult.status, taskResult);
          await this.persistenceManager.updateTask(
            task.id,
            taskResult.status,
            taskResult,
            undefined,
            new Date().toISOString()
          );

          // Mark domain executed
          if (taskResult.status === 'PASSED' || taskResult.status === 'FAILED') {
            this.stateManager.markDomainExecuted(task.domain);
          } else if (taskResult.status === 'NOT_AVAILABLE') {
            this.stateManager.markDomainUnavailable(task.domain);
          }

          // Correlate Evidence & Observations
          const correlation = CampaignEvidenceCorrelator.correlate(this.stateManager.rawState, taskResult);
          for (const obs of correlation.observations) {
            this.stateManager.recordObservation(obs);
          }
          for (const evLink of correlation.evidenceLinks) {
            this.stateManager.recordEvidenceLink(evLink);
          }

          // Persist task evidence records
          const taskEvidenceRecords = taskResult.evidence.map((e) =>
            CampaignEvidenceFormatter.formatTaskEvidence(projectId, {
              ...taskResult,
              evidence: [e],
            }, this.options.testRunId)
          );
          await this.persistenceManager.persistEvidence(taskEvidenceRecords);

          // Adaptive Reactive Loop: If failure or regression detected, inject high-priority adaptive task
          if (
            taskResult.status === 'FAILED' &&
            taskResult.observations.length > 0 &&
            this.budgetManager.canInsertAdaptiveTask()
          ) {
            for (const obs of taskResult.observations) {
              const adaptiveTarget = TargetSelector.createAdaptiveTargetFromObservation(
                obs,
                targetUrl,
                Array.from(this.stateManager.rawState.tasks.values()).map((t) => t.target)
              );

              if (adaptiveTarget) {
                const adaptiveTask: CampaignTask = {
                  id: `task-adaptive-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
                  campaignId,
                  taskType: 'ADAPTIVE_REGRESSION_VERIFICATION',
                  domain: task.domain,
                  target: adaptiveTarget,
                  priority: 95,
                  reason: `Adaptive priority check triggered by failure observation: ${obs.title}`,
                  dependencies: [],
                  status: 'QUEUED',
                  retryCount: 0,
                };

                this.stateManager.addTask(adaptiveTask);
                this.budgetManager.recordAdaptiveInsertion();
                await this.persistenceManager.insertTasks(
                  campaignId,
                  projectId,
                  [adaptiveTask],
                  this.options.organizationId
                );

                this.logger.log('adaptive_task_inserted', {
                  taskId: adaptiveTask.id,
                  target: adaptiveTarget.identifier,
                  reason: adaptiveTask.reason,
                });
              }
            }
          }
        }
      }

      // Final Termination & Summary
      const isCancelled = !!cancellationToken?.isCancelled;
      const finalTermination = isCancelled
        ? { status: 'CANCELLED', reason: 'CANCELLED_BY_USER' as const }
        : CampaignTerminationEvaluator.evaluate(
            this.stateManager.rawState,
            this.budgetManager
          );

      const finalStatus: QACampaignStatus = isCancelled
        ? 'CANCELLED'
        : (finalTermination.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED');
      this.stateManager.setStatus(finalStatus);

      const summary = await this.analyzer.generateSummary(
        this.stateManager.rawState,
        finalTermination.reason
      );

      // Persist Campaign Summary Evidence
      const summaryEvidence = CampaignEvidenceFormatter.formatSummaryEvidence(
        projectId,
        summary,
        this.options.testRunId
      );
      await this.persistenceManager.persistEvidence([summaryEvidence]);

      // Update Campaign DB Record
      await this.persistenceManager.updateCampaign(campaignId, finalStatus, {
        stateSnapshot: this.stateManager.getSerializableSnapshot(),
        summarySnapshot: summary,
        completedAt: new Date().toISOString(),
      });

      this.logger.log('campaign_completed', {
        status: finalStatus,
        tasksExecuted: summary.tasksExecuted,
        regressionsCount: summary.regressionsCount,
        recoveriesCount: summary.recoveriesCount,
        releaseRecommendation: summary.releaseAssessment?.recommendation,
      });

      return {
        success: finalStatus === 'COMPLETED',
        status: finalStatus,
        summary,
      };
    } catch (err: any) {
      const isCancelled = !!cancellationToken?.isCancelled;
      const finalStatus: QACampaignStatus = isCancelled ? 'CANCELLED' : 'FAILED';
      this.logger.error('campaign_fatal_error', err.message);
      this.stateManager.setStatus(finalStatus);

      const fallbackSummary = await this.analyzer.generateSummary(
        this.stateManager.rawState,
        isCancelled ? 'CANCELLED_BY_USER' : 'EXECUTION_FAILED'
      );

      await this.persistenceManager.updateCampaign(campaignId, finalStatus, {
        stateSnapshot: this.stateManager.getSerializableSnapshot(),
        summarySnapshot: fallbackSummary,
        completedAt: new Date().toISOString(),
      });

      return {
        success: false,
        status: finalStatus,
        summary: fallbackSummary,
        error: err.message || 'Campaign execution encountered fatal error',
      };
    } finally {
      if (ownsBrowser && browser) {
        await browser.close().catch(() => {});
      }
    }
  }

  private async executeDomainTask(
    task: CampaignTask,
    browser: Browser,
    page: Page,
    context: BrowserContext,
    targetUrl: string,
    pastRuns: any[]
  ): Promise<CampaignTaskResult> {
    const rawState = this.stateManager.rawState;

    switch (task.domain) {
      case 'DISCOVERY': {
        const res = await DiscoveryAdapter.execute(task, browser, targetUrl, { allowLocalhost: this.options.allowLocalhost });
        if (res.status === 'PASSED' && res.metadata?.applicationMap) {
          this.stateManager.setApplicationMap(res.metadata.applicationMap);
        }
        return res;
      }

      case 'PRODUCT': {
        const res = await ProductAdapter.execute(task, targetUrl, rawState.applicationMap);
        if (res.status === 'PASSED' && res.metadata?.productModel) {
          this.stateManager.setProductModel(res.metadata.productModel);
        }
        return res;
      }

      case 'AUTHORIZATION': {
        const res = await AuthAdapter.execute(task, context, targetUrl, {
          testIdentities: (rawState.config as any).testIdentities,
          authorizationChecks: (rawState.config as any).authorizationChecks,
          appMap: rawState.applicationMap,
        });
        if (res.metadata?.sessions) {
          rawState.authenticatedSessions.push(...res.metadata.sessions);
        }
        if (res.metadata?.roleContexts) {
          rawState.roleContexts.push(...res.metadata.roleContexts);
        }
        if (res.metadata?.authChecks) {
          rawState.authorizationChecks.push(...res.metadata.authChecks);
        }
        return res;
      }

      case 'JOURNEY':
      case 'FUNCTIONAL': {
        const res = await JourneyAdapter.execute(
          task,
          browser,
          targetUrl,
          rawState.applicationMap,
          rawState.productModel,
          {
            screenshots: rawState.screenshots,
            consoleErrors: rawState.consoleErrors,
            networkErrors: rawState.networkErrors,
            allowLocalhost: this.options.allowLocalhost,
          }
        );
        if (res.metadata?.journeyResults) {
          this.stateManager.mergeJourneyResults(res.metadata.journeyResults);
        }
        if (res.observations) {
          this.stateManager.mergeObservations(res.observations);
        }
        return res;
      }

      case 'API': {
        const res = await ApiAdapter.execute(
          task,
          targetUrl,
          rawState.apiEndpoints,
          {
            applicationMap: rawState.applicationMap,
            config: rawState.config,
            allowLocalhost: this.options.allowLocalhost,
          }
        );
        if (res.metadata?.apiResults) {
          this.stateManager.mergeApiResults(
            rawState.apiEndpoints,
            res.metadata.apiResults,
            res.metadata.apiCoverage
          );
        }
        if (res.observations) {
          this.stateManager.mergeObservations(res.observations);
        }
        return res;
      }

      case 'SECURITY': {
        const res = await SecurityAdapter.execute(task, targetUrl, {
          appMap: rawState.applicationMap,
          apiEndpoints: rawState.apiEndpoints,
          roleContexts: rawState.roleContexts,
          sessions: rawState.authenticatedSessions,
          policy: rawState.config.securityPolicy,
          allowLocalhost: this.options.allowLocalhost,
        });
        if (res.findings) {
          this.stateManager.mergeSecurityFindings(res.findings, res.metadata?.scanResult?.coverage);
        }
        if (res.observations) {
          this.stateManager.mergeObservations(res.observations);
        }
        return res;
      }

      case 'ACCESSIBILITY': {
        const res = await AccessibilityAdapter.execute(
          task,
          page,
          context,
          targetUrl,
          rawState.applicationMap,
          rawState.productModel,
          rawState.config.accessibilityPolicy,
          browser,
          this.options.allowLocalhost
        );
        if (res.findings) {
          this.stateManager.mergeAccessibilityFindings(res.findings, res.metadata?.scanResult?.coverage);
        }
        if (res.observations) {
          this.stateManager.mergeObservations(res.observations);
        }
        return res;
      }

      case 'VISUAL':
      case 'RESPONSIVE': {
        const res = await VisualAdapter.execute(task, browser, targetUrl, rawState.applicationMap);
        if (res.observations) {
          this.stateManager.mergeObservations(res.observations);
        }
        return res;
      }

      case 'PERFORMANCE':
      case 'RELIABILITY': {
        const res = await PerformanceAdapter.execute(task, page, context, targetUrl, {
          projectId: this.options.projectId,
          appMap: rawState.applicationMap,
          productModel: rawState.productModel,
          apiEndpoints: rawState.apiEndpoints,
          policy: rawState.config.performancePolicy,
          allowLocalhost: this.options.allowLocalhost,
        });
        if (res.findings) {
          this.stateManager.mergePerformanceFindings(res.findings, res.metadata?.scanResult?.coverage);
        }
        if (res.observations) {
          this.stateManager.mergeObservations(res.observations);
        }
        return res;
      }

      case 'HISTORICAL': {
        const executionResult: Partial<TestExecutionResult> = {
          bugObservations: rawState.bugObservations,
          journeyResults: rawState.journeyResults,
          apiTestResults: rawState.apiResponses,
          securityFindings: rawState.securityFindings,
          performanceFindings: rawState.performanceFindings,
          accessibilityFindings: rawState.accessibilityFindings,
        };
        const res = await HistoricalAdapter.execute(
          task,
          targetUrl,
          executionResult,
          pastRuns,
          rawState.config.historicalPolicy
        );
        if (res.metadata?.historicalComparison) {
          this.stateManager.setHistoricalComparison(res.metadata.historicalComparison);
        }
        return res;
      }

      case 'RELEASE': {
        const executionResult: Partial<TestExecutionResult> = {
          bugObservations: rawState.bugObservations,
          journeyResults: rawState.journeyResults,
          apiTestResults: rawState.apiResponses,
          securityFindings: rawState.securityFindings,
          performanceFindings: rawState.performanceFindings,
          accessibilityFindings: rawState.accessibilityFindings,
          historicalComparison: rawState.historicalComparison,
        };
        const res = await ReleaseAdapter.execute(task, targetUrl, executionResult, {
          projectId: this.options.projectId,
          productModel: rawState.productModel,
        });
        if (res.metadata?.releaseAssessment) {
          this.stateManager.setReleaseAssessment(res.metadata.releaseAssessment);
        }
        return res;
      }

      default:
        return {
          taskId: task.id,
          status: 'NOT_AVAILABLE',
          target: task.target,
          domain: task.domain,
          findings: [],
          evidence: [],
          observations: [],
          durationMs: 0,
          error: `Unsupported domain adapter: ${task.domain}`,
        };
    }
  }
}
