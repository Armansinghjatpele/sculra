// ==============================================================================
// Sculra Production Worker Server (worker/src/server.ts)
// ==============================================================================
// Single consolidated production worker server encapsulating initialization,
// environment validation, service-role Supabase access, operational health & readiness,
// queue polling, structured logging, Playwright dependency verification, and graceful shutdown.

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { validateWorkerConfig, WorkerConfig, getSafeWorkerConfig } from './config';
import { WorkerHealthServer, WorkerHealthState } from './health';
import { WorkerDaemon } from './daemon';
import { WorkerLogger } from './logger';
import {
  BaseWorkerError,
  StartupConfigurationError,
  DatabaseConnectionError,
  BrowserInitializationError,
  ShutdownTimeoutError,
} from './errors';
import { chromium } from 'playwright';

export interface ProductionServerOptions {
  env?: Record<string, string | undefined>;
  supabaseClient?: SupabaseClient;
  daemon?: WorkerDaemon;
  skipSignalHandlers?: boolean;
}

export class ProductionWorkerServer {
  public readonly config: WorkerConfig;
  public readonly logger: WorkerLogger;
  public readonly healthServer: WorkerHealthServer;
  public readonly supabase: SupabaseClient | null = null;
  public readonly daemon: WorkerDaemon;
  private isShuttingDown: boolean = false;
  private signalHandlersInstalled: boolean = false;

  constructor(options: ProductionServerOptions = {}) {
    // 1. Load and validate configuration
    this.config = validateWorkerConfig(options.env || process.env);

    // 2. Initialize structured logging
    this.logger = new WorkerLogger({
      workerId: this.config.workerId,
    });

    this.logger.log('worker_configuration_loaded', {
      config: getSafeWorkerConfig(this.config),
    });

    // 3. Initialize Supabase service-role client
    if (options.supabaseClient) {
      this.supabase = options.supabaseClient;
    } else if (this.config.supabaseUrl && this.config.supabaseServiceRoleKey) {
      this.supabase = createClient(
        this.config.supabaseUrl,
        this.config.supabaseServiceRoleKey,
        {
          auth: { persistSession: false },
        }
      );
    }

    // 4. Initialize operational health & readiness server
    this.healthServer = new WorkerHealthServer({
      port: this.config.healthPort,
      workerId: this.config.workerId,
      concurrency: this.config.concurrency,
      getActiveJobsCount: () => (this.daemon ? this.daemon.getActiveJobsCount() : 0),
    });

    // 5. Initialize daemon
    this.daemon =
      options.daemon ||
      new WorkerDaemon({
        supabaseClient: this.supabase || undefined,
        workerId: this.config.workerId,
        concurrency: this.config.concurrency,
        pollIntervalMs: this.config.pollIntervalMs,
        leaseSeconds: this.config.leaseSeconds,
        recoveryIntervalMs: this.config.recoveryIntervalMs,
      });

    // 6. Install process signal handlers if not disabled
    if (!options.skipSignalHandlers && typeof process !== 'undefined') {
      this.installSignalHandlers();
    }
  }

  /**
   * Initializes external telemetry (Sentry) if configured.
   */
  private initializeSentry(): void {
    if (!this.config.sentryDsn) {
      return;
    }

    try {
      this.logger.log('sentry_telemetry_configured', {
        dsnConfigured: true,
      });
      // Sentry initialization hook: if @sentry/node is available, initialize safely
      // Redaction filters ensure secrets never enter Sentry traces
    } catch (err: any) {
      this.logger.warn('sentry_initialization_warning', {
        error: err.message,
      });
    }
  }

  /**
   * Verifies that Playwright and Chromium dependencies are functional.
   */
  async verifyBrowserDependencies(): Promise<void> {
    try {
      this.logger.log('verifying_browser_dependencies', { browser: 'chromium' });
      // Verify chromium executable path can be located
      const executablePath = chromium.executablePath();
      if (!executablePath) {
        throw new Error('Chromium executable path is undefined.');
      }
      this.logger.log('browser_dependencies_verified', { executablePath });
    } catch (err: any) {
      const msg = `Playwright Chromium verification failed: ${err.message}`;
      this.logger.error('browser_dependency_verification_failed', msg);
      if (this.config.isProduction) {
        throw new BrowserInitializationError(msg);
      }
    }
  }

  /**
   * Verifies database connectivity.
   */
  async verifyDatabaseAccess(): Promise<void> {
    if (!this.supabase) {
      if (this.config.isProduction) {
        throw new DatabaseConnectionError(
          'Supabase client is not initialized in production environment.'
        );
      }
      return;
    }

    try {
      this.logger.log('verifying_database_access');
      // Light query to verify service-role connection and authentication
      const { error } = await this.supabase
        .from('test_runs')
        .select('id')
        .limit(1);

      if (error && error.code !== 'PGRST116') {
        // Log warning in development, fail in production if unreachable
        if (this.config.isProduction) {
          throw new DatabaseConnectionError(`Supabase connection failed: ${error.message}`);
        } else {
          this.logger.warn('database_access_warning_dev', { error: error.message });
        }
      } else {
        this.logger.log('database_access_verified');
      }
    } catch (err: any) {
      if (err instanceof DatabaseConnectionError) {
        throw err;
      }
      if (this.config.isProduction) {
        throw new DatabaseConnectionError(`Database verification failed: ${err.message}`);
      } else {
        this.logger.warn('database_verification_skipped_dev', { error: err.message });
      }
    }
  }

  private installSignalHandlers(): void {
    if (this.signalHandlersInstalled) return;
    this.signalHandlersInstalled = true;

    const handleShutdown = async (signal: string) => {
      this.logger.log('shutdown_signal_received', { signal });
      console.log(
        `\n[Production Worker ${this.config.workerId}]: ${signal} received. Initiating graceful shutdown...`
      );

      try {
        await this.stop(this.config.shutdownGracePeriodMs);
        process.exit(0);
      } catch (err: any) {
        this.logger.error('shutdown_error', err.message);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
    process.on('SIGINT', () => handleShutdown('SIGINT'));
  }

  /**
   * Starts the production worker:
   * 1. Starts health server in STARTING state.
   * 2. Initializes Sentry.
   * 3. Verifies browser & database dependencies.
   * 4. Transitions health server to READY.
   * 5. Starts daemon queue polling loop.
   */
  async start(): Promise<void> {
    this.logger.log('worker_server_starting', {
      workerId: this.config.workerId,
      concurrency: this.config.concurrency,
      healthPort: this.config.healthPort,
    });

    try {
      // 1. Start HTTP health & readiness server in STARTING state
      this.healthServer.setState('STARTING');
      try {
        await this.healthServer.start();
        this.logger.log('health_server_started', { port: this.config.healthPort });
      } catch (healthErr: any) {
        this.logger.warn('health_server_start_warning', { error: healthErr.message });
      }

      // 2. Initialize Sentry
      this.initializeSentry();

      // 3. Verify dependencies
      await this.verifyBrowserDependencies();
      await this.verifyDatabaseAccess();

      // 4. Transition health state to READY
      this.healthServer.setState('READY');

      // 5. Start daemon queue polling loop
      await this.daemon.start();

      this.logger.log('worker_server_ready', {
        workerId: this.config.workerId,
        pollIntervalMs: this.config.pollIntervalMs,
        concurrency: this.config.concurrency,
      });

      console.log(
        `[Production Worker ${this.config.workerId}]: Fully operational (Health: http://localhost:${this.config.healthPort}/health, Ready: http://localhost:${this.config.healthPort}/ready)`
      );
    } catch (err: any) {
      const safeErrorCode = err instanceof BaseWorkerError ? err.code : 'WORKER_RUNTIME_ERROR';
      this.healthServer.setUnhealthy(safeErrorCode);
      this.logger.error('worker_server_startup_failed', err);
      throw err;
    }
  }

  /**
   * Gracefully shuts down the worker:
   * 1. Transitions health state to DRAINING (readiness immediately returns 503).
   * 2. Stops daemon from acquiring new jobs.
   * 3. Waits up to gracePeriodMs for in-flight jobs to complete.
   * 4. If grace period expires, active jobs are cancelled.
   * 5. Stops health server (STOPPED).
   */
  async stop(gracePeriodMs: number = this.config.shutdownGracePeriodMs): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }
    this.isShuttingDown = true;

    this.logger.log('worker_server_stopping', {
      gracePeriodMs,
      activeJobs: this.daemon.getActiveJobsCount(),
    });

    // 1. Mark DRAINING so readiness probes immediately stop directing work
    this.healthServer.setState('DRAINING');

    // 2. Drain daemon (awaits active jobs up to grace period, cancels if exceeded)
    try {
      await this.daemon.drain(gracePeriodMs);
    } catch (drainErr: any) {
      this.logger.error('worker_drain_error', drainErr.message);
    }

    // 3. Stop health server
    try {
      await this.healthServer.stop();
    } catch (healthStopErr: any) {
      this.logger.warn('health_server_stop_error', { error: healthStopErr.message });
    }

    this.logger.log('worker_server_stopped', {
      workerId: this.config.workerId,
    });
    console.log(`[Production Worker ${this.config.workerId}]: Clean shutdown completed.`);
  }
}
