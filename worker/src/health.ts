// ==============================================================================
// Sculra Production Worker Health & Readiness Server (worker/src/health.ts)
// ==============================================================================
// Independent, lightweight HTTP health/readiness server exposing /health and /ready.
// Distinguishes STARTING, READY, BUSY, DRAINING, UNHEALTHY, and STOPPED operational states.
// Exposes operational metrics with zero secret exposure.

import * as http from 'node:http';

export type WorkerHealthState =
  | 'STARTING'
  | 'READY'
  | 'BUSY'
  | 'DRAINING'
  | 'UNHEALTHY'
  | 'STOPPED';

export interface HealthServerOptions {
  port: number;
  workerId: string;
  concurrency: number;
  getActiveJobsCount: () => number;
  getLastError?: () => string | null;
}

export interface HealthCheckResponse {
  status: WorkerHealthState;
  workerId: string;
  uptimeSeconds: number;
  activeJobs: number;
  concurrency: number;
  timestamp: string;
  error?: string;
}

export interface ReadinessCheckResponse {
  ready: boolean;
  status: WorkerHealthState;
  workerId: string;
  activeJobs: number;
  availableSlots: number;
  timestamp: string;
  error?: string;
}

export class WorkerHealthServer {
  private server: http.Server | null = null;
  private state: WorkerHealthState = 'STARTING';
  private startTime: number = Date.now();
  private lastError: string | null = null;
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
    if (options.getLastError) {
      this.lastError = options.getLastError();
    }
  }

  public getState(): WorkerHealthState {
    return this.state;
  }

  public setState(newState: WorkerHealthState, errorDetails?: string | null): void {
    this.state = newState;
    if (errorDetails !== undefined) {
      this.lastError = errorDetails;
    }
  }

  public setUnhealthy(reason: string): void {
    this.state = 'UNHEALTHY';
    this.lastError = reason;
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
          res.writeHead(405, { 'Content-Type': 'application/json' });
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
            error: this.lastError || undefined,
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

          const responseData: ReadinessCheckResponse = {
            ready: isReady,
            status: currentState,
            workerId: this.workerId,
            activeJobs,
            availableSlots,
            timestamp: new Date().toISOString(),
            error: !isReady ? (this.lastError || `Worker is in ${currentState} state`) : undefined,
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
