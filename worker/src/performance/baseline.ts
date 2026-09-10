// ==============================================================================
// Sculra Performance Baseline & Regression Engine (worker/src/performance/baseline.ts)
// ==============================================================================
// Enforces explicit, dimensionally-compatible baseline comparisons, calculating
// deterministic latency regressions without fabricating missing baselines.

import {
  PerformanceBaseline,
  PerformanceRegression,
  PerformancePolicyConfig,
  BaselineStatus,
} from './types';
import { BugSeverity } from '../issues/types';
import { ViewportName } from '../visual/types';
import { DEFAULT_PERFORMANCE_POLICY } from './policy';

export class PerformanceBaselineManager {
  /**
   * Generates a deterministic composite target key for baseline indexing.
   */
  static generateTargetKey(params: {
    type: 'PAGE' | 'API';
    path: string;
    method?: string;
    viewport?: ViewportName;
    role?: string;
  }): string {
    const { type, path, method = 'GET', viewport = 'desktop', role = 'ANY' } = params;
    return `${type}:${method.toUpperCase()}:${path.toLowerCase()}:${viewport.toLowerCase()}:${role.toUpperCase()}`;
  }

  /**
   * Calculates deterministic regression between current measurement and historical baseline.
   */
  static evaluateRegression(params: {
    metric: string;
    currentValue: number;
    baselineValue: number;
    isCriticalWorkflow?: boolean;
    policy?: PerformancePolicyConfig;
  }): PerformanceRegression {
    const { metric, currentValue, baselineValue, isCriticalWorkflow, policy = DEFAULT_PERFORMANCE_POLICY } = params;

    if (baselineValue <= 0) {
      return {
        metric,
        currentValue,
        baselineValue,
        absoluteDelta: 0,
        percentageDelta: 0,
        thresholdPercentage: policy.thresholds.regressionThresholdPercent,
        isRegression: false,
        severity: 'info',
      };
    }

    const absoluteDelta = Math.round(currentValue - baselineValue);
    const percentageDelta = Math.round(((currentValue - baselineValue) / baselineValue) * 100);

    const thresholdPercentage = isCriticalWorkflow
      ? policy.thresholds.criticalWorkflowRegressionThresholdPercent
      : policy.thresholds.regressionThresholdPercent;

    const isRegression = percentageDelta >= thresholdPercentage && absoluteDelta >= 100; // Require at least 100ms delta

    let severity: BugSeverity = 'low';
    if (isRegression) {
      if (percentageDelta >= 100 || (isCriticalWorkflow && percentageDelta >= 50)) {
        severity = 'critical';
      } else if (percentageDelta >= 50 || isCriticalWorkflow) {
        severity = 'high';
      } else if (percentageDelta >= 25) {
        severity = 'medium';
      }
    }

    return {
      metric,
      currentValue,
      baselineValue,
      absoluteDelta,
      percentageDelta,
      thresholdPercentage,
      isRegression,
      severity,
    };
  }

  /**
   * Constructs a baseline record from current measurements.
   */
  static createBaseline(params: {
    projectId: string;
    testRunId: string;
    targetKey: string;
    targetUrl: string;
    path: string;
    viewport: ViewportName;
    role?: string;
    environment?: string;
    metrics: PerformanceBaseline['metrics'];
    status?: BaselineStatus;
  }): PerformanceBaseline {
    return {
      id: `perf_base_${params.targetKey.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}`,
      projectId: params.projectId,
      testRunId: params.testRunId,
      targetKey: params.targetKey,
      targetUrl: params.targetUrl,
      path: params.path,
      viewport: params.viewport,
      role: params.role,
      environment: params.environment || 'testing',
      metrics: params.metrics,
      establishedAt: new Date().toISOString(),
      status: params.status || 'BASELINE_AVAILABLE',
    };
  }
}
