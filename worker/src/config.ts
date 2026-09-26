// ==============================================================================
// Sculra Production Worker Configuration & Validation (worker/src/config.ts)
// ==============================================================================
// Centralized configuration validator distinguishing REQUIRED, OPTIONAL,
// DEVELOPMENT-ONLY, and TEST-ONLY variables. Fails fast in production without leaking secrets.

import { StartupConfigurationError } from './errors';

export type VariableClassification =
  | 'REQUIRED'
  | 'OPTIONAL'
  | 'DEVELOPMENT_ONLY'
  | 'TEST_ONLY';

export interface VariableMetadata {
  name: string;
  classification: VariableClassification;
  description: string;
  isSecret: boolean;
  defaultValue?: string | number;
}

export const WORKER_ENV_SCHEMA: Record<string, VariableMetadata> = {
  SUPABASE_URL: {
    name: 'SUPABASE_URL',
    classification: 'REQUIRED',
    description: 'Supabase PostgreSQL & REST endpoint URL',
    isSecret: false,
  },
  NEXT_PUBLIC_SUPABASE_URL: {
    name: 'NEXT_PUBLIC_SUPABASE_URL',
    classification: 'REQUIRED',
    description: 'Supabase URL alias commonly provided in unified configs',
    isSecret: false,
  },
  SUPABASE_SERVICE_ROLE_KEY: {
    name: 'SUPABASE_SERVICE_ROLE_KEY',
    classification: 'REQUIRED',
    description: 'Supabase Service Role administrative secret key',
    isSecret: true,
  },
  NEXT_PUBLIC_SUPABASE_ANON_KEY: {
    name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    classification: 'DEVELOPMENT_ONLY',
    description: 'Supabase client anon key (NOT permitted as service role substitute in production)',
    isSecret: true,
  },
  WORKER_ID: {
    name: 'WORKER_ID',
    classification: 'OPTIONAL',
    description: 'Unique identifier for this worker instance (auto-generated if omitted)',
    isSecret: false,
  },
  WORKER_POLL_INTERVAL_MS: {
    name: 'WORKER_POLL_INTERVAL_MS',
    classification: 'OPTIONAL',
    description: 'Frequency in milliseconds to poll the execution queue',
    isSecret: false,
    defaultValue: 2000,
  },
  WORKER_CONCURRENCY: {
    name: 'WORKER_CONCURRENCY',
    classification: 'OPTIONAL',
    description: 'Maximum number of concurrent browser jobs processed on this worker',
    isSecret: false,
    defaultValue: 1,
  },
  WORKER_SHUTDOWN_GRACE_PERIOD_MS: {
    name: 'WORKER_SHUTDOWN_GRACE_PERIOD_MS',
    classification: 'OPTIONAL',
    description: 'Grace period in milliseconds before active jobs are forcibly terminated on shutdown',
    isSecret: false,
    defaultValue: 30000,
  },
  WORKER_HEALTH_PORT: {
    name: 'WORKER_HEALTH_PORT',
    classification: 'OPTIONAL',
    description: 'Port for the lightweight HTTP health & readiness server',
    isSecret: false,
    defaultValue: 8080,
  },
  WORKER_LEASE_SECONDS: {
    name: 'WORKER_LEASE_SECONDS',
    classification: 'OPTIONAL',
    description: 'Duration of initial job lease before heartbeat renewal is required',
    isSecret: false,
    defaultValue: 60,
  },
  WORKER_RECOVERY_INTERVAL_MS: {
    name: 'WORKER_RECOVERY_INTERVAL_MS',
    classification: 'OPTIONAL',
    description: 'Interval in milliseconds to scan for and recover stale orphaned jobs',
    isSecret: false,
    defaultValue: 60000,
  },
  OPENAI_API_KEY: {
    name: 'OPENAI_API_KEY',
    classification: 'OPTIONAL',
    description: 'OpenAI API key for autonomous QA analysis and synthesis',
    isSecret: true,
  },
  SENTRY_DSN: {
    name: 'SENTRY_DSN',
    classification: 'OPTIONAL',
    description: 'Sentry DSN for operational error tracking and telemetry',
    isSecret: false,
  },
  NODE_ENV: {
    name: 'NODE_ENV',
    classification: 'OPTIONAL',
    description: 'Runtime environment: production, development, or test',
    isSecret: false,
    defaultValue: 'development',
  },
  MOCK_TEST_SERVER_PORT: {
    name: 'MOCK_TEST_SERVER_PORT',
    classification: 'TEST_ONLY',
    description: 'Port for local integration test fixture HTTP servers',
    isSecret: false,
  },
};

export interface WorkerConfig {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  workerId: string;
  pollIntervalMs: number;
  concurrency: number;
  shutdownGracePeriodMs: number;
  healthPort: number;
  leaseSeconds: number;
  recoveryIntervalMs: number;
  openAiApiKey?: string;
  sentryDsn?: string;
  nodeEnv: 'production' | 'development' | 'test';
  isProduction: boolean;
}

export interface SafeWorkerConfig {
  supabaseUrl: string;
  hasServiceRoleKey: boolean;
  workerId: string;
  pollIntervalMs: number;
  concurrency: number;
  shutdownGracePeriodMs: number;
  healthPort: number;
  leaseSeconds: number;
  recoveryIntervalMs: number;
  hasOpenAiKey: boolean;
  hasSentryDsn: boolean;
  nodeEnv: string;
  isProduction: boolean;
}

/**
 * Validates and extracts a typed WorkerConfig from environment variables.
 * Fails fast with StartupConfigurationError on any validation error.
 */
export function validateWorkerConfig(
  env: Record<string, string | undefined> = process.env
): WorkerConfig {
  const nodeEnvRaw = env.NODE_ENV || 'development';
  const nodeEnv = (nodeEnvRaw === 'production' || nodeEnvRaw === 'test' ? nodeEnvRaw : 'development') as
    | 'production'
    | 'development'
    | 'test';
  const isProduction = nodeEnv === 'production';

  // 1. Resolve Supabase URL
  const supabaseUrl = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || '';
  if (!supabaseUrl) {
    if (isProduction) {
      throw new StartupConfigurationError(
        'Required configuration variable "SUPABASE_URL" (or "NEXT_PUBLIC_SUPABASE_URL") is missing.'
      );
    }
  } else {
    try {
      const parsed = new URL(supabaseUrl);
      if (!parsed.protocol.startsWith('http')) {
        throw new Error('Protocol must be http or https');
      }
    } catch {
      throw new StartupConfigurationError(
        `Invalid URL format for SUPABASE_URL: "${supabaseUrl.substring(0, 16)}..."`
      );
    }
  }

  // 2. Resolve and Validate Supabase Service Role Key
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || '';
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (isProduction) {
    if (!serviceRoleKey) {
      throw new StartupConfigurationError(
        'Required configuration variable "SUPABASE_SERVICE_ROLE_KEY" is missing for production worker.'
      );
    }

    // Guard against accidentally passing anon key as service-role key
    if (anonKey && serviceRoleKey === anonKey) {
      throw new StartupConfigurationError(
        'SUPABASE_SERVICE_ROLE_KEY cannot match NEXT_PUBLIC_SUPABASE_ANON_KEY in production. Anonymous key is not permitted for worker execution.'
      );
    }

    if (serviceRoleKey.length < 20) {
      throw new StartupConfigurationError(
        'SUPABASE_SERVICE_ROLE_KEY appears invalid (less than 20 characters).'
      );
    }
  }

  // Effective key for non-production environments
  const effectiveKey = serviceRoleKey || (!isProduction ? anonKey : '');

  // 3. Concurrency
  let concurrency = 1;
  if (env.WORKER_CONCURRENCY) {
    const parsed = parseInt(env.WORKER_CONCURRENCY, 10);
    if (isNaN(parsed) || parsed < 1) {
      throw new StartupConfigurationError(
        `WORKER_CONCURRENCY must be a positive integer, received: "${env.WORKER_CONCURRENCY}"`
      );
    }
    if (parsed > 10) {
      throw new StartupConfigurationError(
        `WORKER_CONCURRENCY cannot exceed 10 for safe Chromium resource limits, received: ${parsed}`
      );
    }
    concurrency = parsed;
  }

  // 4. Poll Interval
  let pollIntervalMs = 2000;
  if (env.WORKER_POLL_INTERVAL_MS) {
    const parsed = parseInt(env.WORKER_POLL_INTERVAL_MS, 10);
    if (isNaN(parsed) || parsed < 100) {
      throw new StartupConfigurationError(
        `WORKER_POLL_INTERVAL_MS must be at least 100ms, received: "${env.WORKER_POLL_INTERVAL_MS}"`
      );
    }
    pollIntervalMs = parsed;
  }

  // 5. Shutdown Grace Period
  let shutdownGracePeriodMs = 30000;
  if (env.WORKER_SHUTDOWN_GRACE_PERIOD_MS) {
    const parsed = parseInt(env.WORKER_SHUTDOWN_GRACE_PERIOD_MS, 10);
    if (isNaN(parsed) || parsed < 1000) {
      throw new StartupConfigurationError(
        `WORKER_SHUTDOWN_GRACE_PERIOD_MS must be at least 1000ms, received: "${env.WORKER_SHUTDOWN_GRACE_PERIOD_MS}"`
      );
    }
    shutdownGracePeriodMs = parsed;
  }

  // 6. Health Port
  let healthPort = 8080;
  if (env.WORKER_HEALTH_PORT) {
    const parsed = parseInt(env.WORKER_HEALTH_PORT, 10);
    if (isNaN(parsed) || parsed < 1 || parsed > 65535) {
      throw new StartupConfigurationError(
        `WORKER_HEALTH_PORT must be a valid port (1-65535), received: "${env.WORKER_HEALTH_PORT}"`
      );
    }
    healthPort = parsed;
  }

  // 7. Lease Seconds
  let leaseSeconds = 60;
  if (env.WORKER_LEASE_SECONDS) {
    const parsed = parseInt(env.WORKER_LEASE_SECONDS, 10);
    if (isNaN(parsed) || parsed < 10) {
      throw new StartupConfigurationError(
        `WORKER_LEASE_SECONDS must be at least 10s, received: "${env.WORKER_LEASE_SECONDS}"`
      );
    }
    leaseSeconds = parsed;
  }

  // 8. Recovery Interval
  let recoveryIntervalMs = 60000;
  if (env.WORKER_RECOVERY_INTERVAL_MS) {
    const parsed = parseInt(env.WORKER_RECOVERY_INTERVAL_MS, 10);
    if (isNaN(parsed) || parsed < 5000) {
      throw new StartupConfigurationError(
        `WORKER_RECOVERY_INTERVAL_MS must be at least 5000ms, received: "${env.WORKER_RECOVERY_INTERVAL_MS}"`
      );
    }
    recoveryIntervalMs = parsed;
  }

  // 9. Worker ID
  const workerId =
    env.WORKER_ID ||
    `worker_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  return {
    supabaseUrl,
    supabaseServiceRoleKey: effectiveKey,
    workerId,
    pollIntervalMs,
    concurrency,
    shutdownGracePeriodMs,
    healthPort,
    leaseSeconds,
    recoveryIntervalMs,
    openAiApiKey: env.OPENAI_API_KEY || undefined,
    sentryDsn: env.SENTRY_DSN || undefined,
    nodeEnv,
    isProduction,
  };
}

/**
 * Returns a sanitized copy of configuration safe for logging and health diagnostics.
 */
export function getSafeWorkerConfig(config: WorkerConfig): SafeWorkerConfig {
  return {
    supabaseUrl: config.supabaseUrl,
    hasServiceRoleKey: !!config.supabaseServiceRoleKey,
    workerId: config.workerId,
    pollIntervalMs: config.pollIntervalMs,
    concurrency: config.concurrency,
    shutdownGracePeriodMs: config.shutdownGracePeriodMs,
    healthPort: config.healthPort,
    leaseSeconds: config.leaseSeconds,
    recoveryIntervalMs: config.recoveryIntervalMs,
    hasOpenAiKey: !!config.openAiApiKey,
    hasSentryDsn: !!config.sentryDsn,
    nodeEnv: config.nodeEnv,
    isProduction: config.isProduction,
  };
}
