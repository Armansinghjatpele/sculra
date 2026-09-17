// ==============================================================================
// Sculra Campaign Progress & Coverage Calculator (worker/src/campaign/progress.ts)
// ==============================================================================

import { CampaignProgress, CampaignState, CampaignDomain } from './types';

export class CampaignProgressCalculator {
  static calculateProgress(state: CampaignState): CampaignProgress {
    const tasks = Array.from(state.tasks.values());
    const totalTasks = tasks.length;

    let completedTasks = 0;
    let runningTasks = 0;
    let queuedTasks = 0;
    let blockedTasks = 0;
    let skippedTasks = 0;

    for (const task of tasks) {
      if (task.status === 'PASSED' || task.status === 'FAILED') {
        completedTasks += 1;
      } else if (task.status === 'RUNNING') {
        runningTasks += 1;
      } else if (task.status === 'QUEUED' || task.status === 'PENDING_DEPENDENCIES') {
        queuedTasks += 1;
      } else if (task.status === 'BLOCKED') {
        blockedTasks += 1;
      } else if (task.status === 'SKIPPED' || task.status === 'CANCELLED' || task.status === 'NOT_AVAILABLE') {
        skippedTasks += 1;
      }
    }

    const taskCoveragePct = totalTasks > 0 ? Math.min(100, Math.round((completedTasks / totalTasks) * 100)) : 0;

    const configuredDomains = state.config?.domains || [];
    const domainCoveragePct =
      configuredDomains.length > 0
        ? Math.min(100, Math.round((state.domainsExecuted.size / configuredDomains.length) * 100))
        : 0;

    // Domains status map
    const domainsStatus: Record<CampaignDomain, 'PENDING' | 'RUNNING' | 'COMPLETED' | 'BLOCKED' | 'NOT_AVAILABLE' | 'SKIPPED'> = {
      DISCOVERY: 'PENDING',
      PRODUCT: 'PENDING',
      FUNCTIONAL: 'PENDING',
      JOURNEY: 'PENDING',
      API: 'PENDING',
      AUTHORIZATION: 'PENDING',
      SECURITY: 'PENDING',
      ACCESSIBILITY: 'PENDING',
      VISUAL: 'PENDING',
      RESPONSIVE: 'PENDING',
      PERFORMANCE: 'PENDING',
      RELIABILITY: 'PENDING',
      HISTORICAL: 'PENDING',
      RELEASE: 'PENDING',
    };

    for (const d of Object.keys(domainsStatus) as CampaignDomain[]) {
      if (!configuredDomains.includes(d)) {
        domainsStatus[d] = 'SKIPPED';
      } else if (state.domainsExecuted.has(d)) {
        domainsStatus[d] = 'COMPLETED';
      } else if (state.domainsUnavailable.has(d)) {
        domainsStatus[d] = 'NOT_AVAILABLE';
      } else {
        // Check if any task in this domain is currently running
        const isRunning = tasks.some((t) => t.domain === d && t.status === 'RUNNING');
        const isBlocked = tasks.some((t) => t.domain === d && t.status === 'BLOCKED') && !tasks.some((t) => t.domain === d && (t.status === 'QUEUED' || t.status === 'RUNNING'));
        if (isRunning) {
          domainsStatus[d] = 'RUNNING';
        } else if (isBlocked) {
          domainsStatus[d] = 'BLOCKED';
        } else {
          domainsStatus[d] = 'PENDING';
        }
      }
    }

    // Critical workflow coverage
    const workflows = state.productModel?.workflows || [];
    const criticalWorkflows = workflows.filter((w) => w.criticality?.level === 'CRITICAL' || w.criticality?.level === 'HIGH');
    const totalCritical = criticalWorkflows.length;

    let testedCritical = 0;
    let passedCritical = 0;
    let failedCritical = 0;
    let blockedCritical = 0;

    for (const cw of criticalWorkflows) {
      const matchingTasks = tasks.filter(
        (t) => t.target.workflowId === cw.id || t.target.identifier === cw.name
      );
      if (matchingTasks.length > 0) {
        const isCompleted = matchingTasks.some((t) => t.status === 'PASSED' || t.status === 'FAILED');
        const isPassed = matchingTasks.every((t) => t.status === 'PASSED');
        const isFailed = matchingTasks.some((t) => t.status === 'FAILED');
        const isBlocked = matchingTasks.some((t) => t.status === 'BLOCKED');

        if (isCompleted) testedCritical += 1;
        if (isPassed && isCompleted) passedCritical += 1;
        if (isFailed) failedCritical += 1;
        if (isBlocked && !isCompleted) blockedCritical += 1;
      }
    }

    return {
      completedTasks,
      runningTasks,
      queuedTasks,
      blockedTasks,
      skippedTasks,
      totalTasks,
      taskCoveragePct,
      domainCoveragePct,
      domainsStatus,
      criticalWorkflowCoveragePct:
        totalCritical > 0 ? Math.min(100, Math.round((testedCritical / totalCritical) * 100)) : undefined,
      criticalWorkflowCoverage: {
        total: totalCritical,
        tested: testedCritical,
        untested: Math.max(0, totalCritical - testedCritical),
        passed: passedCritical,
        failed: failedCritical,
        blocked: blockedCritical,
      },
    };
  }
}
