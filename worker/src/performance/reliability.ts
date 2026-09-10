// ==============================================================================
// Sculra Page Reliability Evaluator (worker/src/performance/reliability.ts)
// ==============================================================================
// Executes tightly bounded, deterministic multi-run probes (max 3) to measure page load
// consistency, navigation stability, timeout ratios, and runtime error resilience.

import { Page } from 'playwright';
import { ReliabilityMeasurement, PerformancePolicyConfig } from './types';
import { DEFAULT_PERFORMANCE_POLICY } from './policy';

export class PageReliabilityEvaluator {
  /**
   * Evaluates the multi-attempt reliability of navigating to a target URL.
   */
  static async evaluatePageReliability(
    page: Page,
    targetUrl: string,
    policy: PerformancePolicyConfig = DEFAULT_PERFORMANCE_POLICY
  ): Promise<ReliabilityMeasurement> {
    const path = new URL(targetUrl).pathname;
    const maxRepetitions = Math.min(3, policy.maxReliabilityRepetitions);

    let successfulAttempts = 0;
    let failedAttempts = 0;
    let timeouts = 0;
    let runtimeErrors = 0;
    const repetitionDurations: number[] = [];

    // Capture runtime errors during reliability probes
    const errorHandler = () => {
      runtimeErrors++;
    };
    page.on('pageerror', errorHandler);

    for (let attempt = 1; attempt <= maxRepetitions; attempt++) {
      const startTime = Date.now();
      try {
        const response = await page.goto(targetUrl, {
          timeout: policy.requestTimeoutMs,
          waitUntil: 'domcontentloaded',
        });

        const duration = Date.now() - startTime;
        repetitionDurations.push(duration);

        if (response && response.status() < 400) {
          successfulAttempts++;
        } else {
          failedAttempts++;
        }
      } catch (err: any) {
        const duration = Date.now() - startTime;
        repetitionDurations.push(duration);
        failedAttempts++;
        if (err.message && err.message.toLowerCase().includes('timeout')) {
          timeouts++;
        }
      }
    }

    page.off('pageerror', errorHandler);

    const totalAttempts = maxRepetitions;
    const successRate = totalAttempts > 0 ? successfulAttempts / totalAttempts : 0;
    const validDurations = repetitionDurations.length > 0 ? repetitionDurations : [0];
    const averageDurationMs = Math.round(validDurations.reduce((a, b) => a + b, 0) / validDurations.length);
    const minDurationMs = Math.min(...validDurations);
    const maxDurationMs = Math.max(...validDurations);

    // Consistency score: 100 if all succeed and latency is uniform; deducted for failures and high variance
    const durationDelta = maxDurationMs - minDurationMs;
    const variancePenalty = averageDurationMs > 0 ? Math.min(30, Math.round((durationDelta / averageDurationMs) * 30)) : 0;
    const failurePenalty = Math.round((1 - successRate) * 70);
    const consistencyScore = Math.max(0, Math.min(100, 100 - variancePenalty - failurePenalty));

    const isStable = successRate >= policy.thresholds.minReliabilitySuccessRate && timeouts === 0 && runtimeErrors === 0;

    return {
      targetUrl,
      path,
      totalAttempts,
      successfulAttempts,
      failedAttempts,
      timeouts,
      runtimeErrors,
      successRate,
      averageDurationMs,
      minDurationMs,
      maxDurationMs,
      consistencyScore,
      isStable,
      repetitionDurations,
    };
  }
}
