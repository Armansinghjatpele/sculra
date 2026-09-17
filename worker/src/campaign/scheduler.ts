// ==============================================================================
// Sculra Campaign Task Scheduler (worker/src/campaign/scheduler.ts)
// ==============================================================================

import { CampaignState, CampaignTask, CampaignDomain } from './types';
import { CampaignDependencyGraph } from './dependency-graph';

export class CampaignScheduler {
  /**
   * Retrieves tasks that are ready to be executed immediately based on satisfied DAG dependencies.
   */
  static getReadyTasks(state: CampaignState, maxConcurrency: number = 4): CampaignTask[] {
    const tasks = Array.from(state.tasks.values());
    const runningTasksCount = tasks.filter((t) => t.status === 'RUNNING').length;
    const availableSlots = Math.max(0, maxConcurrency - runningTasksCount);

    if (availableSlots <= 0) {
      return [];
    }

    const completedTaskIds = new Set<string>();
    for (const t of tasks) {
      if (t.status === 'PASSED' || t.status === 'FAILED') {
        completedTaskIds.add(t.id);
      }
    }

    const activeDomains = new Set(state.config.domains || []);
    const candidateTasks: CampaignTask[] = [];

    for (const task of tasks) {
      if (task.status === 'QUEUED' || task.status === 'PENDING_DEPENDENCIES') {
        const check = CampaignDependencyGraph.canExecuteTask(
          task,
          completedTaskIds,
          state.domainsExecuted,
          activeDomains,
          state.tasks
        );

        if (check.canExecute) {
          candidateTasks.push(task);
        } else {
          // Update status to pending dependencies if waiting
          task.status = 'PENDING_DEPENDENCIES';
        }
      }
    }

    // Sort candidate tasks: Highest priority first
    candidateTasks.sort((a, b) => b.priority - a.priority);

    return candidateTasks.slice(0, availableSlots);
  }
}
