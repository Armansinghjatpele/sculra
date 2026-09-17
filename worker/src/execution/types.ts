// ==============================================================================
// Sculra Execution Layer Type Definitions (worker/src/execution/types.ts)
// ==============================================================================

import { CancellationToken } from '../types';

export type JobType = 'CAMPAIGN' | 'TEST_RUN';

export type ExecutionJobStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'TIMEOUT'
  | 'SKIPPED';

export type ExecutionErrorCode =
  | 'INFRASTRUCTURE_FAILURE'
  | 'BROWSER_LAUNCH_FAILED'
  | 'DATABASE_PERSISTENCE_FAILED'
  | 'LEASE_LOST'
  | 'JOB_TIMEOUT'
  | 'TASK_TIMEOUT'
  | 'CAMPAIGN_EXECUTION_FAILED'
  | 'TEST_RUN_EXECUTION_FAILED'
  | 'MAX_ATTEMPTS_EXCEEDED'
  | 'PERMANENT_JOB_ERROR'
  | 'INVALID_CONFIG'
  | 'INVALID_TARGET_URL'
  | 'UNSUPPORTED_PROJECT_TYPE'
  | 'SHUTDOWN_CANCELLED'
  | 'UNKNOWN_ERROR';

export interface ExecutionJob {
  jobId: string;
  jobType: JobType;
  projectId: string;
  organizationId?: string | null;
  testRunId?: string | null;
  campaignId?: string | null;
  status: ExecutionJobStatus;
  attempt: number;
  maxAttempts: number;
  workerId?: string | null;
  leaseExpiresAt?: string | null;
  lastHeartbeatAt?: string | null;
  targetUrl: string;
  config?: Record<string, any>;
  metadata?: Record<string, any>;
  createdAt?: string;
  startedAt?: string;
  completedAt?: string;
  errorCode?: ExecutionErrorCode | null;
  errorMessage?: string | null;
  previousWorkerId?: string | null;
  recoveryCount?: number;
}

export interface ExecutionResult {
  success: boolean;
  status: ExecutionJobStatus;
  error?: string;
  errorCode?: ExecutionErrorCode;
  durationMs?: number;
  metrics?: ExecutionMetrics;
  summary?: any;
  data?: any;
}

export interface WorkerIdentityInfo {
  workerId: string;
  hostname: string;
  pid: number;
  startedAt: string;
  tags?: Record<string, string>;
}

export interface AcquisitionOptions {
  workerId: string;
  leaseSeconds?: number;
  supportedTypes?: JobType[];
  batchSize?: number;
}

export interface HeartbeatOptions {
  intervalMs?: number;
  leaseSeconds?: number;
  onLeaseLost?: (jobId: string, error: Error) => void;
}

export interface RetryPolicyConfig {
  maxAttempts?: number;
  backoffBaseMs?: number;
  maxBackoffMs?: number;
}

export interface ExecutionMetrics {
  durationMs?: number;
  tasksExecuted?: number;
  tasksPassed?: number;
  tasksFailed?: number;
  heartbeatCount?: number;
  retryAttempt?: number;
  adaptiveTasksCount?: number;
}
