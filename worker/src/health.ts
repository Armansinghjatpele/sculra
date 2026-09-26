// ==============================================================================
// Sculra Production Worker Health & Readiness Server (worker/src/health.ts)
// ==============================================================================
// Independent, lightweight HTTP health/readiness server exposing /health and /ready.
// Distinguishes STARTING, READY, BUSY, DRAINING, UNHEALTHY, and STOPPED operational states.
// Exposes strictly sanitized operational metrics and standardized error codes.
// Zero secrets, zero stack traces, zero SQL details, and zero arbitrary exception strings.

import * as http from 'node:http';
import { WorkerErrorCode } from './errors';

export type WorkerHealthState =
  | 'STARTING'
  | 'READY'
  | 'BUSY'
  | 'DRAINING'
  | 'UNHEALTHY'
  | 'STOPPED';

export type WorkerSafeErrorCode =
  | WorkerErrorCode
  | 'DRAINING'
  | 'STOPPED'
  | 'NOT_READY';

export const KNOWN_SAFE_ERROR_CODES: ReadonlySet<string> = new Set<string>([
  'STARTUP_CONFIGURATION_ERROR',
  'DATABASE_CONNECTION_ERROR',
  'BROWSER_INITIALIZATION_ERROR',
  'QUEUE_ERROR',
  'EXECUTION_ERROR',
  'CANCELLATION',
  'SHUTDOWN_TIMEOUT',
  'WORKER_RUNTIME_ERROR',
  'DRAINING',
  'STOPPED',
  'NOT_READY',
]);

/**
 * Sanitizes arbitrary error objects, strings, or exception values into safe,
 * enumerated operational error codes. Under NO circumstances are exception messages,
 * stack traces, database queries, file paths, URLs, or secrets emitted.
 */
export function sanitizeToSafeErrorCode(errOrCode: unknown): WorkerSafeErrorCode {
  if (typeof errOrCode === 'string') {
    if (KNOWN_SAFE_ERROR_CODES.has(errOrCode)) {
      return errOrCode as WorkerSafeErrorCode;
    }
  } else if (errOrCode && typeof errOrCode === 'object') {
    if ('code' in errOrCode && typeof (errOrCode as any).code === 'string') {
      const code = (errOrCode as any).code;
      if (KNOWN_SAFE_ERROR_CODES.has(code)) {
        return code as WorkerSafeErrorCode;
      }
    }
  }
  return 'WORKER_RUNTIME_ERROR';
}

export interface HealthServerOptions {
  port: number;
  workerId: string;
  concurrency: number;
  getActiveJobsCount: () => number;
  getLastErrorCode?: () => WorkerSafeErrorCode | null;
}

export interface HealthCheckResponse {
  status: WorkerHealthState;
  workerId: string;
  uptimeSeconds: number;
  activeJobs: number;
  concurrency: number;
  timestamp: string;
  errorCode?: WorkerSafeErrorCode;
}

export interface ReadinessCheckResponse {
  ready: boolean;
  status: WorkerHealthState;
  workerId: string;
  activeJobs: number;
  availableSlots: number;
  timestamp: string;
  errorCode?: WorkerSafeErrorCode;
}

export class WorkerHealthServer {
  private server: http.Server | null = null;
  private state: WorkerHealthState = 'STARTING';
  private startTime: number = Date.now();
  private lastErrorCode: WorkerSafeErrorCode | null = null;
  private readonly port: number;
  private readonly workerId: string;
  private readonly concurrency: number;
  private readonly getActiveJobsCount: () => number;
  private isListening: boolean = false;

  constructor(options: HealthServerOptions) {
    this.port = options.port;
    this.workerId = options.workerId;
    this.concurrency = options.concurrency;
    this.getActiveJobsCount = options.getActiveJobsCount;
    if (options.getLastErrorCode) {
      this.lastErrorCode = options.getLastErrorCode();
    }
  }

  public getState(): WorkerHealthState {
    return this.state;
  }

  public getLastErrorCode(): WorkerSafeErrorCode | null {
    return this.lastErrorCode;
  }

  public setState(newState: WorkerHealthState, errorCode?: unknown): void {
    this.state = newState;
    if (errorCode !== undefined) {
      this.lastErrorCode = errorCode ? sanitizeToSafeErrorCode(errorCode) : null;
    } else if (newState === 'READY' || newState === 'BUSY') {
      // Clear error code on return to operational readiness
      this.lastErrorCode = null;
    }
  }

  public setUnhealthy(reason?: unknown): void {
    this.state = 'UNHEALTHY';
    this.lastErrorCode = sanitizeToSafeErrorCode(reason || 'WORKER_RUNTIME_ERROR');
  }

  public isReady(): boolean {
    return this.state === 'READY' || this.state === 'BUSY';
  }

  public isAlive(): boolean {
    return this.state !== 'UNHEALTHY' && this.state !== 'STOPPED';
  }

  async start(): Promise<void> {
    if (this.server && this.isListening) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        const url = req.url || '';
        const method = req.method || 'GET';

        if (method !== 'GET' && method !== 'HEAD') {
          res.writeHead(405, { 'Content-Type': 'application/json', 'Connection': 'close' });
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);
        const activeJobs = this.getActiveJobsCount();
        const availableSlots = Math.max(0, this.concurrency - activeJobs);

        // Derive dynamic state between READY and BUSY if alive and running
        let currentState = this.state;
        if (currentState === 'READY' && activeJobs > 0) {
          currentState = 'BUSY';
        } else if (currentState === 'BUSY' && activeJobs === 0) {
          currentState = 'READY';
        }

        if (url === '/health' || url === '/healthz' || url === '/live' || url === '/') {
          const isHealthy = currentState !== 'UNHEALTHY' && currentState !== 'STOPPED';
          const statusCode = isHealthy ? 200 : 503;

          const responseData: HealthCheckResponse = {
            status: currentState,
            workerId: this.workerId,
            uptimeSeconds,
            activeJobs,
            concurrency: this.concurrency,
            timestamp: new Date().toISOString(),
            ...(this.lastErrorCode || currentState === 'UNHEALTHY'
              ? { errorCode: this.lastErrorCode || 'WORKER_RUNTIME_ERROR' }
              : {}),
          };

          res.writeHead(statusCode, {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Connection': 'close',
          });
          res.end(JSON.stringify(responseData));
          return;
        }

        if (url === '/ready' || url === '/readiness') {
          // Worker is only ready to accept or continue processing if READY or BUSY
          const isReady = currentState === 'READY' || currentState === 'BUSY';
          const statusCode = isReady ? 200 : 503;

          const fallbackNotReadyCode: WorkerSafeErrorCode =
            currentState === 'DRAINING'
              ? 'DRAINING'
              : currentState === 'STARTING'
              ? 'NOT_READY'
              : currentState === 'STOPPED'
              ? 'STOPPED'
              : 'WORKER_RUNTIME_ERROR';

          const responseData: ReadinessCheckResponse = {
            ready: isReady,
            status: currentState,
            workerId: this.workerId,
            activeJobs,
            availableSlots,
            timestamp: new Date().toISOString(),
            ...(!isReady
              ? { errorCode: this.lastErrorCode || fallbackNotReadyCode }
              : {}),
          };

          res.writeHead(statusCode, {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Connection': 'close',
          });
          res.end(JSON.stringify(responseData));
          return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json', 'Connection': 'close' });
        res.end(JSON.stringify({ error: 'Not found' }));
      });

      this.server.on('error', (err) => {
        this.isListening = false;
        reject(err);
      });

      this.server.listen(this.port, () => {
        this.isListening = true;
        resolve();
      });
    });
  }

  public getBoundPort(): number {
    if (!this.server) return this.port;
    const addr = this.server.address();
    if (typeof addr === 'object' && addr !== null) {
      return addr.port;
    }
    return this.port;
  }

  async stop(): Promise<void> {
    this.state = 'STOPPED';
    this.lastErrorCode = 'STOPPED';
    if (!this.server || !this.isListening) {
      return;
    }

    return new Promise((resolve) => {
      if (typeof (this.server as any)?.closeAllConnections === 'function') {
        (this.server as any).closeAllConnections();
      }
      this.server?.close(() => {
        this.isListening = false;
        resolve();
      });
      // Fallback unref in case sockets linger
      this.server?.unref();
    });
  }
}
