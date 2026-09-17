// ==============================================================================
// Sculra Execution Metrics Tracker (worker/src/execution/metrics.ts)
// ==============================================================================

export interface WorkerProcessMetrics {
  workerId: string;
  uptimeSeconds: number;
  jobsAcquired: number;
  jobsCompleted: number;
  jobsFailed: number;
  jobsCancelled: number;
  jobsRecovered: number;
  heartbeatsSent: number;
  heartbeatsFailed: number;
  errorsByCode: Record<string, number>;
}

export class ExecutionMetricsTracker {
  private static instance: ExecutionMetricsTracker | null = null;
  private workerId: string;
  private startedAt: number;
  private jobsAcquired: number = 0;
  private jobsCompleted: number = 0;
  private jobsFailed: number = 0;
  private jobsCancelled: number = 0;
  private jobsRecovered: number = 0;
  private heartbeatsSent: number = 0;
  private heartbeatsFailed: number = 0;
  private errorsByCode: Map<string, number> = new Map();

  constructor(workerId: string = 'worker') {
    this.workerId = workerId;
    this.startedAt = Date.now();
  }

  public static getInstance(workerId?: string): ExecutionMetricsTracker {
    if (!ExecutionMetricsTracker.instance) {
      ExecutionMetricsTracker.instance = new ExecutionMetricsTracker(workerId);
    }
    return ExecutionMetricsTracker.instance;
  }

  public static resetInstance(): void {
    ExecutionMetricsTracker.instance = null;
  }

  recordJobAcquired(): void {
    this.jobsAcquired++;
  }

  recordJobOutcome(status: string, errorCode?: string): void {
    const s = status.toUpperCase();
    if (s === 'COMPLETED' || s === 'PASSED') {
      this.jobsCompleted++;
    } else if (s === 'CANCELLED') {
      this.jobsCancelled++;
    } else {
      this.jobsFailed++;
    }

    if (errorCode) {
      const curr = this.errorsByCode.get(errorCode) || 0;
      this.errorsByCode.set(errorCode, curr + 1);
    }
  }

  recordJobRecovered(): void {
    this.jobsRecovered++;
  }

  recordHeartbeat(success: boolean): void {
    this.heartbeatsSent++;
    if (!success) {
      this.heartbeatsFailed++;
    }
  }

  getSnapshot(): WorkerProcessMetrics {
    const errorObj: Record<string, number> = {};
    for (const [code, count] of this.errorsByCode.entries()) {
      errorObj[code] = count;
    }

    return {
      workerId: this.workerId,
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      jobsAcquired: this.jobsAcquired,
      jobsCompleted: this.jobsCompleted,
      jobsFailed: this.jobsFailed,
      jobsCancelled: this.jobsCancelled,
      jobsRecovered: this.jobsRecovered,
      heartbeatsSent: this.heartbeatsSent,
      heartbeatsFailed: this.heartbeatsFailed,
      errorsByCode: errorObj,
    };
  }
}
