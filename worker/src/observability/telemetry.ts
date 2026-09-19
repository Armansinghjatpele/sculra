// ==============================================================================
// Sculra Observability Telemetry Tracker (worker/src/observability/telemetry.ts)
// ==============================================================================

import { AutonomousHealthMetrics } from './types';

export class ObservabilityTelemetry {
  private static eventsRecorded = 0;
  private static decisionsRecorded = 0;
  private static approvalsRecorded = 0;

  public static trackEvent(): void {
    this.eventsRecorded++;
  }

  public static trackDecision(): void {
    this.decisionsRecorded++;
  }

  public static trackApproval(): void {
    this.approvalsRecorded++;
  }

  public static getCounts(): { events: number; decisions: number; approvals: number } {
    return {
      events: this.eventsRecorded,
      decisions: this.decisionsRecorded,
      approvals: this.approvalsRecorded,
    };
  }

  /**
   * Constructs factual system health metrics from real counts.
   * Never injects fake uptime or arbitrary percentages.
   */
  public static assembleHealthMetrics(data: {
    activeWorkersCount?: number;
    queuedJobsCount?: number;
    staleLeasesCount?: number;
    failedJobsCount?: number;
    activeCampaignsCount?: number;
    blockedTasksCount?: number;
    pendingApprovalsCount?: number;
    openCriticalIssuesCount?: number;
    recentRegressionsCount?: number;
    recentRemediationsCount?: number;
  }): AutonomousHealthMetrics {
    return {
      activeWorkersCount: data.activeWorkersCount ?? 0,
      queuedJobsCount: data.queuedJobsCount ?? 0,
      staleLeasesCount: data.staleLeasesCount ?? 0,
      failedJobsCount: data.failedJobsCount ?? 0,
      activeCampaignsCount: data.activeCampaignsCount ?? 0,
      blockedTasksCount: data.blockedTasksCount ?? 0,
      pendingApprovalsCount: data.pendingApprovalsCount ?? 0,
      openCriticalIssuesCount: data.openCriticalIssuesCount ?? 0,
      recentRegressionsCount: data.recentRegressionsCount ?? 0,
      recentRemediationsCount: data.recentRemediationsCount ?? 0,
      updatedAt: new Date().toISOString(),
    };
  }

  public static resetForTest(): void {
    this.eventsRecorded = 0;
    this.decisionsRecorded = 0;
    this.approvalsRecorded = 0;
  }
}
