// ==============================================================================
// Sculra Campaign Analyzer & Synthesis Engine (worker/src/campaign/analyzer.ts)
// ==============================================================================

import {
  CampaignState,
  CampaignSummary,
  CampaignTerminationReason,
} from './types';
import { CampaignAIReasoner } from './ai-reasoner';
import { CampaignProgressCalculator } from './progress';

export class CampaignAnalyzer {
  private aiReasoner: CampaignAIReasoner;

  constructor(aiReasoner?: CampaignAIReasoner) {
    this.aiReasoner = aiReasoner || new CampaignAIReasoner();
  }

  /**
   * Generates a comprehensive summary from the finalized campaign state.
   */
  async generateSummary(
    state: CampaignState,
    terminationReason: CampaignTerminationReason = 'ALL_TASKS_COMPLETED'
  ): Promise<CampaignSummary> {
    const progress = CampaignProgressCalculator.calculateProgress(state);

    const startedTime = state.startedAt ? new Date(state.startedAt).getTime() : Date.now();
    const completedTime = state.completedAt ? new Date(state.completedAt).getTime() : Date.now();
    const durationMs = Math.max(0, completedTime - startedTime);

    const newIssuesCount = state.bugObservations.length;
    const regressionsCount = state.regressedTargets.size;
    const recoveriesCount = state.recoveredTargets.size;
    const recurringDefectsCount = state.historicalSignals.filter(
      (s) => s.signalType === 'RECURRING_DEFECT' || s.signalType === ('RECURRING' as any)
    ).length;
    const unstableTargetsCount = state.unstableTargets.size;
    const evidenceCount = state.evidenceLinks.length;

    // Coverage details
    const pagesCovered = state.applicationMap?.totalPages || (state.testedTargets.size > 0 ? 1 : 0);
    const apisCovered = state.apiEndpoints?.length || 0;
    const workflowsCovered = progress.criticalWorkflowCoverage.tested;
    const rolesCovered = state.roleContexts?.length || 1;
    const viewportsCovered = state.config.viewports?.length || 1;

    let finalStatus = state.status;
    if (finalStatus === 'PLANNING' || finalStatus === 'RUNNING') {
      if (terminationReason === 'GOAL_SATISFIED' || terminationReason === 'ALL_TASKS_COMPLETED') {
        finalStatus = 'COMPLETED';
      } else if (terminationReason === 'CANCELLED_BY_USER') {
        finalStatus = 'CANCELLED';
      } else if (terminationReason === 'EXECUTION_FAILED' || terminationReason === 'CRITICAL_BLOCKER_THRESHOLD') {
        finalStatus = 'FAILED';
      } else {
        finalStatus = 'COMPLETED';
      }
    }

    const summary: CampaignSummary = {
      campaignId: state.campaignId,
      projectId: state.projectId,
      organizationId: state.organizationId,
      status: finalStatus,
      objective: state.objective,
      startedAt: state.startedAt || new Date(startedTime).toISOString(),
      completedAt: state.completedAt || new Date(completedTime).toISOString(),
      durationMs,
      domainsExecuted: Array.from(state.domainsExecuted),
      domainsUnavailable: Array.from(state.domainsUnavailable),
      tasksPlanned: progress.totalTasks,
      tasksExecuted: progress.completedTasks,
      tasksPassed: Array.from(state.tasks.values()).filter((t) => t.status === 'PASSED').length,
      tasksFailed: Array.from(state.tasks.values()).filter((t) => t.status === 'FAILED').length,
      tasksBlocked: progress.blockedTasks,
      tasksSkipped: progress.skippedTasks,
      criticalWorkflowsTested: progress.criticalWorkflowCoverage.tested,
      criticalWorkflowsUntested: progress.criticalWorkflowCoverage.untested,
      newIssuesCount,
      regressionsCount,
      recoveriesCount,
      recurringDefectsCount,
      unstableTargetsCount,
      evidenceCount,
      coverageSummary: {
        taskCoveragePct: progress.taskCoveragePct,
        domainCoveragePct: progress.domainCoveragePct,
        pagesCovered,
        apisCovered,
        workflowsCovered,
        rolesCovered,
        viewportsCovered,
      },
      terminationReason,
      releaseAssessment: state.releaseAssessment,
      historicalScoreDeltas: state.historicalComparison?.metricDeltas,
    };

    // Generate grounded AI executive narrative
    summary.aiExecutiveSummary = await this.aiReasoner.generateExecutiveSummary(state, summary);

    return summary;
  }
}
