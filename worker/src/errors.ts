// ==============================================================================
// Sculra Production Worker Error Taxonomy (worker/src/errors.ts)
// ==============================================================================
// Distinguishes fatal startup/infrastructure failures from job execution errors.
// Ensures infrastructure failures are never converted into PASSED or silently swallowed.

export type WorkerErrorCode =
  | 'STARTUP_CONFIGURATION_ERROR'
  | 'DATABASE_CONNECTION_ERROR'
  | 'BROWSER_INITIALIZATION_ERROR'
  | 'QUEUE_ERROR'
  | 'EXECUTION_ERROR'
  | 'CANCELLATION'
  | 'SHUTDOWN_TIMEOUT';

export abstract class BaseWorkerError extends Error {
  public abstract readonly code: WorkerErrorCode;
  public readonly isFatal: boolean;
  public readonly timestamp: string;

  constructor(message: string, isFatal: boolean = true) {
    super(message);
    this.name = this.constructor.name;
    this.isFatal = isFatal;
    this.timestamp = new Date().toISOString();
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Thrown when required environment variables or configuration values are missing,
 * invalid, or misconfigured at startup.
 */
export class StartupConfigurationError extends BaseWorkerError {
  public readonly code: WorkerErrorCode = 'STARTUP_CONFIGURATION_ERROR';

  constructor(message: string) {
    super(message, true);
  }
}

/**
 * Thrown when the worker cannot connect to Supabase or execute required database queries.
 */
export class DatabaseConnectionError extends BaseWorkerError {
  public readonly code: WorkerErrorCode = 'DATABASE_CONNECTION_ERROR';

  constructor(message: string) {
    super(message, true);
  }
}

/**
 * Thrown when Playwright or Chromium fails to launch, install, or initialize.
 */
export class BrowserInitializationError extends BaseWorkerError {
  public readonly code: WorkerErrorCode = 'BROWSER_INITIALIZATION_ERROR';

  constructor(message: string) {
    super(message, false);
  }
}

/**
 * Thrown when queue polling, job claiming, or lease management encounters a failure.
 */
export class QueueError extends BaseWorkerError {
  public readonly code: WorkerErrorCode = 'QUEUE_ERROR';

  constructor(message: string) {
    super(message, false);
  }
}

/**
 * Thrown when a job execution fails unrecoverably during runtime.
 */
export class WorkerExecutionError extends BaseWorkerError {
  public readonly code: WorkerErrorCode = 'EXECUTION_ERROR';

  constructor(message: string) {
    super(message, false);
  }
}

/**
 * Thrown when a job or worker operation is cancelled.
 */
export class CancellationError extends BaseWorkerError {
  public readonly code: WorkerErrorCode = 'CANCELLATION';

  constructor(message: string = 'Worker operation was cancelled') {
    super(message, false);
  }
}

/**
 * Thrown when graceful shutdown grace period expires while active jobs are still running.
 */
export class ShutdownTimeoutError extends BaseWorkerError {
  public readonly code: WorkerErrorCode = 'SHUTDOWN_TIMEOUT';

  constructor(message: string = 'Graceful shutdown timed out waiting for active jobs to finish') {
    super(message, false);
  }
}
