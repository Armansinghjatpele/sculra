// ==============================================================================
// Sculra Release Health & Environment Status Observations
// (worker/src/release/release-health.ts)
// ==============================================================================

import { EnvironmentHealthStatus, ProjectEnvironment, ReleaseRecord } from './types';

export interface FactualEnvironmentHealth {
  environmentId: string;
  name: string;
  type: string;
  baseUrl: string;
  healthStatus: EnvironmentHealthStatus;
  latencyMs?: number;
  lastCheckedAt?: string;
  isReachable: boolean;
  statusBadge: {
    label: string;
    variant: 'success' | 'warning' | 'danger' | 'neutral';
  };
}

export class ReleaseHealthEvaluator {
  /**
   * Evaluates factual health display attributes for an environment.
   * Never fabricates 100% uptime or simulated responsiveness.
   */
  public static evaluateEnvironmentHealth(env: ProjectEnvironment): FactualEnvironmentHealth {
    const isReachable = env.healthStatus === 'HEALTHY' || env.healthStatus === 'AUTH_REQUIRED';
    let variant: FactualEnvironmentHealth['statusBadge']['variant'] = 'neutral';
    let label: string = env.healthStatus;

    switch (env.healthStatus) {
      case 'HEALTHY':
        variant = 'success';
        label = 'Healthy';
        break;
      case 'DEGRADED':
        variant = 'warning';
        label = 'Degraded';
        break;
      case 'UNREACHABLE':
        variant = 'danger';
        label = 'Unreachable';
        break;
      case 'AUTH_REQUIRED':
        variant = 'warning';
        label = 'Auth Required';
        break;
      case 'MISCONFIGURED':
        variant = 'danger';
        label = 'Misconfigured';
        break;
      default:
        variant = 'neutral';
        label = 'Unknown';
        break;
    }

    const latencyMs = env.metadata?.lastValidationLatencyMs;

    return {
      environmentId: env.id,
      name: env.name,
      type: env.type,
      baseUrl: env.baseUrl,
      healthStatus: env.healthStatus,
      latencyMs,
      lastCheckedAt: env.lastHealthCheckAt || undefined,
      isReachable,
      statusBadge: { label, variant },
    };
  }
}
