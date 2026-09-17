// ==============================================================================
// Sculra Campaign Shared State Manager (worker/src/campaign/state.ts)
// ==============================================================================

import {
  CampaignState,
  CampaignTask,
  CampaignTaskResult,
  CampaignTaskStatus,
  CampaignObservation,
  CampaignEvidenceLink,
  CampaignDomain,
  CampaignConfig,
  CampaignBudget,
  CampaignObjective,
  QACampaignStatus,
} from './types';
import { ApplicationMap, CapturedScreenshot, CapturedConsoleError, CapturedNetworkError } from '../types';
import { ProductModel } from '../product';
import { StrategyDecision } from '../strategy/types';
import { QASignalRecord, RunComparison } from '../history/types';
import { ReleaseAssessment } from '../release/types';
import { SecurityFinding, SecurityCoverageSummary } from '../security/types';
import { PerformanceFinding, PerformanceCoverageSummary } from '../performance/types';
import { AccessibilityFinding, AccessibilityCoverageSummary } from '../accessibility/types';
import { ApiEndpoint, ApiTestResult, ApiCoverageSummary } from '../api-qa/types';
import { JourneyResult } from '../journeys/types';
import { BugObservation } from '../issues/types';
import { RoleContext, AuthenticatedSession, AuthorizationCheckResult } from '../auth/types';

export class CampaignStateManager {
  private state: CampaignState;

  constructor(
    campaignIdOrOptions:
      | string
      | {
          campaignId: string;
          projectId: string;
          objective: CampaignObjective;
          config: CampaignConfig;
          budget?: CampaignBudget;
          organizationId?: string;
        },
    projectId?: string,
    objective?: CampaignObjective,
    config?: CampaignConfig,
    budget?: CampaignBudget,
    organizationId?: string
  ) {
    let resolvedCampaignId: string;
    let resolvedProjectId: string;
    let resolvedObjective: CampaignObjective;
    let resolvedConfig: CampaignConfig;
    let resolvedBudget: CampaignBudget;
    let resolvedOrgId: string | undefined;

    if (typeof campaignIdOrOptions === 'object') {
      resolvedCampaignId = campaignIdOrOptions.campaignId;
      resolvedProjectId = campaignIdOrOptions.projectId;
      resolvedObjective = campaignIdOrOptions.objective;
      resolvedConfig = campaignIdOrOptions.config;
      resolvedBudget =
        campaignIdOrOptions.budget ||
        ({
          maxDurationSeconds: 900,
          maxTasks: 25,
          maxConcurrentTasks: 4,
          maxAdaptiveInsertions: 10,
          maxRetries: 1,
          maxEvidenceLinksPerTask: 10,
          elapsedSeconds: 0,
          tasksExecuted: 0,
          tasksRemaining: 0,
          adaptiveInsertionsCount: 0,
        } as CampaignBudget);
      resolvedOrgId = campaignIdOrOptions.organizationId;
    } else {
      resolvedCampaignId = campaignIdOrOptions;
      resolvedProjectId = projectId!;
      resolvedObjective = objective!;
      resolvedConfig = config!;
      resolvedBudget =
        budget ||
        ({
          maxDurationSeconds: 900,
          maxTasks: 25,
          maxConcurrentTasks: 4,
          maxAdaptiveInsertions: 10,
          maxRetries: 1,
          maxEvidenceLinksPerTask: 10,
          elapsedSeconds: 0,
          tasksExecuted: 0,
          tasksRemaining: 0,
          adaptiveInsertionsCount: 0,
        } as CampaignBudget);
      resolvedOrgId = organizationId;
    }

    this.state = {
      campaignId: resolvedCampaignId,
      projectId: resolvedProjectId,
      organizationId: resolvedOrgId,
      status: 'PLANNING',
      objective: resolvedObjective,
      config: resolvedConfig,
      budget: resolvedBudget,
      startedAt: undefined,
      completedAt: undefined,
      tasks: new Map<string, CampaignTask>(),
      executedTaskResults: new Map<string, CampaignTaskResult>(),
      testedTargets: new Set<string>(),
      queuedTargets: new Set<string>(),
      runningTargets: new Set<string>(),
      passedTargets: new Set<string>(),
      failedTargets: new Set<string>(),
      blockedTargets: new Set<string>(),
      skippedTargets: new Set<string>(),
      cancelledTargets: new Set<string>(),
      regressedTargets: new Set<string>(),
      recoveredTargets: new Set<string>(),
      unstableTargets: new Set<string>(),
      domainsExecuted: new Set<CampaignDomain>(),
      domainsUnavailable: new Set<CampaignDomain>(),
      observations: [],
      evidenceLinks: [],
      strategyDecisions: [],
      historicalSignals: [],
      roleContexts: [],
      authenticatedSessions: [],
      authorizationChecks: [],
      securityFindings: [],
      performanceFindings: [],
      accessibilityFindings: [],
      apiEndpoints: [],
      apiResponses: [],
      journeyResults: [],
      bugObservations: [],
      consoleErrors: [],
      networkErrors: [],
      screenshots: [],
    };
  }

  get rawState(): CampaignState {
    return this.state;
  }

  setStatus(status: QACampaignStatus): void {
    this.state.status = status;
    if (status === 'RUNNING' && !this.state.startedAt) {
      this.state.startedAt = new Date().toISOString();
    }
    if ((status === 'COMPLETED' || status === 'FAILED' || status === 'CANCELLED' || status === 'NEEDS_REVIEW') && !this.state.completedAt) {
      this.state.completedAt = new Date().toISOString();
    }
  }

  addTask(task: CampaignTask): void {
    this.state.tasks.set(task.id, task);
    this.state.queuedTargets.add(task.target.identifier);
  }

  getTask(taskId: string): CampaignTask | undefined {
    return this.state.tasks.get(taskId);
  }

  getAllTasks(): CampaignTask[] {
    return Array.from(this.state.tasks.values());
  }

  updateTaskStatus(taskId: string, status: CampaignTaskStatus, result?: CampaignTaskResult): void {
    const task = this.state.tasks.get(taskId);
    if (!task) return;

    task.status = status;
    if (result) {
      task.result = result;
      this.state.executedTaskResults.set(taskId, result);
    }

    const targetId = task.target.identifier;
    this.state.queuedTargets.delete(targetId);

    if (status === 'RUNNING') {
      task.startedAt = task.startedAt || new Date().toISOString();
      this.state.runningTargets.add(targetId);
    } else {
      this.state.runningTargets.delete(targetId);
      task.completedAt = new Date().toISOString();
      if (task.startedAt) {
        task.durationMs = new Date(task.completedAt).getTime() - new Date(task.startedAt).getTime();
      }

      this.state.testedTargets.add(targetId);

      if (status === 'PASSED') {
        this.state.passedTargets.add(targetId);
      } else if (status === 'FAILED') {
        this.state.failedTargets.add(targetId);
      } else if (status === 'BLOCKED') {
        this.state.blockedTargets.add(targetId);
      } else if (status === 'SKIPPED') {
        this.state.skippedTargets.add(targetId);
      } else if (status === 'CANCELLED') {
        this.state.cancelledTargets.add(targetId);
      }
    }
  }

  recordObservation(observation: CampaignObservation): void {
    this.state.observations.push(observation);
  }

  recordEvidenceLink(link: CampaignEvidenceLink): void {
    this.state.evidenceLinks.push(link);
  }

  markDomainExecuted(domain: CampaignDomain): void {
    this.state.domainsExecuted.add(domain);
  }

  markDomainUnavailable(domain: CampaignDomain): void {
    this.state.domainsUnavailable.add(domain);
  }

  setApplicationMap(map: ApplicationMap): void {
    this.state.applicationMap = map;
  }

  setProductModel(model: ProductModel): void {
    this.state.productModel = model;
  }

  setHistoricalSignals(signals: QASignalRecord[]): void {
    this.state.historicalSignals = signals;
  }

  setHistoricalComparison(comparison: RunComparison): void {
    this.state.historicalComparison = comparison;
    if (comparison.regressions) {
      for (const reg of comparison.regressions) {
        this.state.regressedTargets.add(reg.targetUrl || reg.fingerprint);
      }
    }
    if (comparison.recoveries) {
      for (const rec of comparison.recoveries) {
        this.state.recoveredTargets.add(rec.targetUrl || rec.fingerprint);
      }
    }
    if (comparison.stabilitySignals) {
      for (const stab of comparison.stabilitySignals) {
        if (stab.stability === 'INTERMITTENT' || stab.flakeRate > 0.2) {
          this.state.unstableTargets.add(stab.targetIdentifier);
        }
      }
    }
  }

  setReleaseAssessment(assessment: ReleaseAssessment): void {
    this.state.releaseAssessment = assessment;
  }

  setChangeIntelligence(result: any): void {
    this.state.changeIntelligence = result;
  }

  mergeObservations(obs: BugObservation[]): void {
    if (!obs || obs.length === 0) return;
    this.state.bugObservations.push(...obs);
  }

  mergeSecurityFindings(findings: SecurityFinding[], coverage?: SecurityCoverageSummary): void {
    if (findings && findings.length > 0) {
      this.state.securityFindings.push(...findings);
    }
    if (coverage) {
      this.state.securityCoverage = coverage;
    }
  }

  mergePerformanceFindings(findings: PerformanceFinding[], coverage?: PerformanceCoverageSummary): void {
    if (findings && findings.length > 0) {
      this.state.performanceFindings.push(...findings);
    }
    if (coverage) {
      this.state.performanceCoverage = coverage;
    }
  }

  mergeAccessibilityFindings(findings: AccessibilityFinding[], coverage?: AccessibilityCoverageSummary): void {
    if (findings && findings.length > 0) {
      this.state.accessibilityFindings.push(...findings);
    }
    if (coverage) {
      this.state.accessibilityCoverage = coverage;
    }
  }

  mergeApiResults(endpoints: ApiEndpoint[], responses: ApiTestResult[], coverage?: ApiCoverageSummary): void {
    if (endpoints && endpoints.length > 0) {
      this.state.apiEndpoints.push(...endpoints);
    }
    if (responses && responses.length > 0) {
      this.state.apiResponses.push(...responses);
    }
    if (coverage) {
      this.state.apiCoverage = coverage;
    }
  }

  mergeJourneyResults(results: JourneyResult[]): void {
    if (results && results.length > 0) {
      this.state.journeyResults.push(...results);
    }
  }

  mergeScreenshots(screenshots: CapturedScreenshot[]): void {
    if (screenshots && screenshots.length > 0) {
      this.state.screenshots.push(...screenshots);
    }
  }

  mergeConsoleErrors(errors: CapturedConsoleError[]): void {
    if (errors && errors.length > 0) {
      this.state.consoleErrors.push(...errors);
    }
  }

  mergeNetworkErrors(errors: CapturedNetworkError[]): void {
    if (errors && errors.length > 0) {
      this.state.networkErrors.push(...errors);
    }
  }

  /**
   * Returns a JSON-serializable snapshot of the state (converting Sets and Maps).
   */
  getSerializableSnapshot(): any {
    return {
      campaignId: this.state.campaignId,
      projectId: this.state.projectId,
      organizationId: this.state.organizationId,
      status: this.state.status,
      objective: this.state.objective,
      startedAt: this.state.startedAt,
      completedAt: this.state.completedAt,
      testedTargetsCount: this.state.testedTargets.size,
      queuedTargetsCount: this.state.queuedTargets.size,
      runningTargetsCount: this.state.runningTargets.size,
      passedTargetsCount: this.state.passedTargets.size,
      failedTargetsCount: this.state.failedTargets.size,
      blockedTargetsCount: this.state.blockedTargets.size,
      skippedTargetsCount: this.state.skippedTargets.size,
      regressedTargetsCount: this.state.regressedTargets.size,
      recoveredTargetsCount: this.state.recoveredTargets.size,
      unstableTargetsCount: this.state.unstableTargets.size,
      domainsExecuted: Array.from(this.state.domainsExecuted),
      domainsUnavailable: Array.from(this.state.domainsUnavailable),
      observationsCount: this.state.observations.length,
      evidenceLinksCount: this.state.evidenceLinks.length,
      tasksSummary: {
        total: this.state.tasks.size,
        executed: this.state.executedTaskResults.size,
      },
    };
  }
}
