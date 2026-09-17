// ==============================================================================
// Sculra Execution Error Hierarchy & Classification (worker/src/execution/execution-errors.ts)
// ==============================================================================

import { ExecutionErrorCode } from './types';

export class ExecutionError extends Error {
  public readonly code: ExecutionErrorCode;
  public readonly isRetryable: boolean;
  public readonly details?: Record<string, any>;

  constructor(
    message: string,
    code: ExecutionErrorCode = 'UNKNOWN_ERROR',
    isRetryable: boolean = true,
    details?: Record<string, any>
  ) {
    super(message);
    this.name = 'ExecutionError';
    this.code = code;
    this.isRetryable = isRetryable;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InfrastructureError extends ExecutionError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'INFRASTRUCTURE_FAILURE', true, details);
    this.name = 'InfrastructureError';
  }
}

export class BrowserLaunchError extends ExecutionError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'BROWSER_LAUNCH_FAILED', true, details);
    this.name = 'BrowserLaunchError';
  }
}

export class DatabasePersistenceError extends ExecutionError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'DATABASE_PERSISTENCE_FAILED', true, details);
    this.name = 'DatabasePersistenceError';
  }
}

export class LeaseLostError extends ExecutionError {
  constructor(
    message: string = 'Worker heartbeat lease was lost or overtaken by peer',
    details?: Record<string, any>
  ) {
    super(message, 'LEASE_LOST', false, details);
    this.name = 'LeaseLostError';
  }
}

export class JobTimeoutError extends ExecutionError {
  constructor(
    message: string = 'Job execution exceeded maximum allowed time',
    details?: Record<string, any>
  ) {
    super(message, 'JOB_TIMEOUT', false, details);
    this.name = 'JobTimeoutError';
  }
}

export class TaskTimeoutError extends ExecutionError {
  constructor(
    message: string = 'Task execution exceeded timeout limit',
    details?: Record<string, any>
  ) {
    super(message, 'TASK_TIMEOUT', true, details);
    this.name = 'TaskTimeoutError';
  }
}

export class CampaignExecutionError extends ExecutionError {
  constructor(message: string, isRetryable: boolean = true, details?: Record<string, any>) {
    super(message, 'CAMPAIGN_EXECUTION_FAILED', isRetryable, details);
    this.name = 'CampaignExecutionError';
  }
}

export class MaxAttemptsExceededError extends ExecutionError {
  constructor(
    message: string = 'Job exceeded maximum retry attempts',
    details?: Record<string, any>
  ) {
    super(message, 'MAX_ATTEMPTS_EXCEEDED', false, details);
    this.name = 'MaxAttemptsExceededError';
  }
}

export class PermanentJobError extends ExecutionError {
  constructor(
    message: string,
    code: ExecutionErrorCode = 'PERMANENT_JOB_ERROR',
    details?: Record<string, any>
  ) {
    super(message, code, false, details);
    this.name = 'PermanentJobError';
  }
}

export class InvalidConfigError extends ExecutionError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'INVALID_CONFIG', false, details);
    this.name = 'InvalidConfigError';
  }
}

export class InvalidTargetUrlError extends ExecutionError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'INVALID_TARGET_URL', false, details);
    this.name = 'InvalidTargetUrlError';
  }
}

export class ShutdownCancelledError extends ExecutionError {
  constructor(
    message: string = 'Job execution cancelled due to worker shutdown',
    details?: Record<string, any>
  ) {
    super(message, 'SHUTDOWN_CANCELLED', true, details);
    this.name = 'ShutdownCancelledError';
  }
}

export function isRetryableError(error: any): boolean {
  if (error instanceof ExecutionError) {
    return error.isRetryable;
  }
  const msg = (error?.message || '').toLowerCase();
  if (
    msg.includes('invalid url') ||
    msg.includes('unsupported source type') ||
    msg.includes('project record not found') ||
    msg.includes('target url is missing') ||
    msg.includes('jwt') ||
    msg.includes('unauthorized') ||
    msg.includes('forbidden') ||
    msg.includes('schema violation')
  ) {
    return false;
  }
  return true;
}

export function classifyExecutionError(error: any): ExecutionError {
  if (error instanceof ExecutionError) {
    return error;
  }

  const msg = error instanceof Error ? error.message : String(error || 'Unknown error');
  const lower = msg.toLowerCase();

  if (
    lower.includes('lease lost') ||
    lower.includes('lease expired') ||
    lower.includes('overtaken') ||
    lower.includes('stale worker')
  ) {
    return new LeaseLostError(msg);
  }
  if (
    lower.includes('database') ||
    lower.includes('supabase') ||
    lower.includes('postgrest') ||
    lower.includes('pgrst')
  ) {
    return new DatabasePersistenceError(msg);
  }
  if (
    lower.includes('browser') ||
    lower.includes('playwright') ||
    lower.includes('launch') ||
    lower.includes('page crashed') ||
    lower.includes('target closed')
  ) {
    return new BrowserLaunchError(msg);
  }
  if (
    lower.includes('invalid url') ||
    lower.includes('source url') ||
    lower.includes('malformed url')
  ) {
    return new InvalidTargetUrlError(msg);
  }
  if (lower.includes('unsupported') && (lower.includes('source') || lower.includes('project'))) {
    return new PermanentJobError(msg, 'UNSUPPORTED_PROJECT_TYPE');
  }
  if (lower.includes('timeout') || lower.includes('timed out')) {
    return new JobTimeoutError(msg);
  }
  if (lower.includes('cancelled') || lower.includes('shutdown') || lower.includes('abort')) {
    return new ShutdownCancelledError(msg);
  }

  return new ExecutionError(msg, 'UNKNOWN_ERROR', isRetryableError(error));
}
