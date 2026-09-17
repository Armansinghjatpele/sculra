// ==============================================================================
// Sculra Campaign Dependency Graph & DAG Engine (worker/src/campaign/dependency-graph.ts)
// ==============================================================================

import { CampaignDomain, CampaignTask, CampaignTaskStatus } from './types';

export class CampaignDependencyGraph {
  /**
   * Canonical domain prerequisites.
   * If a domain is selected in the campaign, its prerequisite domains must complete first.
   */
  private static readonly DOMAIN_PREREQUISITES: Record<CampaignDomain, CampaignDomain[]> = {
    DISCOVERY: [],
    PRODUCT: ['DISCOVERY'],
    FUNCTIONAL: ['DISCOVERY', 'PRODUCT'],
    JOURNEY: ['DISCOVERY'],
    API: ['DISCOVERY'],
    AUTHORIZATION: ['DISCOVERY'],
    SECURITY: ['DISCOVERY'],
    ACCESSIBILITY: ['DISCOVERY'],
    VISUAL: ['DISCOVERY'],
    RESPONSIVE: ['DISCOVERY'],
    PERFORMANCE: ['DISCOVERY'],
    RELIABILITY: ['DISCOVERY'],
    HISTORICAL: ['DISCOVERY'], // Runs after test execution
    RELEASE: [], // Runs at the end, after all active test domains
  };

  /**
   * Get prerequisite domains for a specific domain.
   */
  static getPrerequisiteDomains(domain: CampaignDomain, activeDomains: Set<CampaignDomain>): CampaignDomain[] {
    const rawPrereqs = this.DOMAIN_PREREQUISITES[domain] || [];
    // Only enforce prerequisites that are actively included in the campaign
    return rawPrereqs.filter((prereq) => activeDomains.has(prereq));
  }

  /**
   * Evaluates if all domain prerequisites for a task's domain have completed.
   */
  static areDomainPrerequisitesSatisfied(
    domain: CampaignDomain,
    completedDomains: Set<CampaignDomain>,
    activeDomains: Set<CampaignDomain>
  ): boolean {
    const required = this.getPrerequisiteDomains(domain, activeDomains);
    for (const req of required) {
      if (!completedDomains.has(req)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Evaluates if a specific task can be scheduled/executed given the current completed tasks and domains.
   */
  static canExecuteTask(
    task: CampaignTask,
    completedTaskIds: Set<string>,
    completedDomains: Set<CampaignDomain>,
    activeDomains: Set<CampaignDomain>,
    tasksMap: Map<string, CampaignTask>
  ): { canExecute: boolean; reason?: string } {
    // 1. Task must be in QUEUED or PENDING_DEPENDENCIES state
    if (task.status !== 'QUEUED' && task.status !== 'PENDING_DEPENDENCIES') {
      return { canExecute: false, reason: `Task is already in status ${task.status}` };
    }

    // 2. Check explicit task-level dependencies
    if (task.dependencies && task.dependencies.length > 0) {
      for (const depId of task.dependencies) {
        const depTask = tasksMap.get(depId);
        if (!depTask) {
          // Missing dependency ID
          continue;
        }
        if (!completedTaskIds.has(depId) && depTask.status !== 'PASSED' && depTask.status !== 'FAILED') {
          return { canExecute: false, reason: `Waiting on prerequisite task: ${depTask.taskType} (${depTask.target.identifier})` };
        }
      }
    }

    // 3. Check domain-level prerequisites
    if (!this.areDomainPrerequisitesSatisfied(task.domain, completedDomains, activeDomains)) {
      const pendingPrereqs = this.getPrerequisiteDomains(task.domain, activeDomains).filter(
        (d) => !completedDomains.has(d)
      );
      return {
        canExecute: false,
        reason: `Waiting on prerequisite domain(s): ${pendingPrereqs.join(', ')}`,
      };
    }

    // 4. Special rule: RELEASE domain tasks only execute when all other active domain tasks have finished
    if (task.domain === 'RELEASE') {
      for (const [id, otherTask] of tasksMap.entries()) {
        if (id === task.id) continue;
        if (otherTask.domain !== 'RELEASE') {
          const isFinished =
            otherTask.status === 'PASSED' ||
            otherTask.status === 'FAILED' ||
            otherTask.status === 'BLOCKED' ||
            otherTask.status === 'SKIPPED' ||
            otherTask.status === 'CANCELLED' ||
            otherTask.status === 'NOT_AVAILABLE';
          if (!isFinished) {
            return {
              canExecute: false,
              reason: `Release evaluation requires all prior tasks to finish (waiting on ${otherTask.taskType})`,
            };
          }
        }
      }
    }

    // 5. Special rule: HISTORICAL domain tasks execute after all functional/api/security/a11y/perf test tasks
    if (task.domain === 'HISTORICAL') {
      for (const [id, otherTask] of tasksMap.entries()) {
        if (id === task.id) continue;
        if (
          otherTask.domain === 'FUNCTIONAL' ||
          otherTask.domain === 'JOURNEY' ||
          otherTask.domain === 'API' ||
          otherTask.domain === 'SECURITY' ||
          otherTask.domain === 'ACCESSIBILITY' ||
          otherTask.domain === 'PERFORMANCE' ||
          otherTask.domain === 'VISUAL'
        ) {
          const isFinished =
            otherTask.status === 'PASSED' ||
            otherTask.status === 'FAILED' ||
            otherTask.status === 'BLOCKED' ||
            otherTask.status === 'SKIPPED' ||
            otherTask.status === 'CANCELLED' ||
            otherTask.status === 'NOT_AVAILABLE';
          if (!isFinished) {
            return {
              canExecute: false,
              reason: `Historical analysis requires testing tasks to finish (waiting on ${otherTask.taskType})`,
            };
          }
        }
      }
    }

    return { canExecute: true };
  }
}
