// ==============================================================================
// Sculra Action Performance Tracker (worker/src/performance/actions.ts)
// ==============================================================================
// Measures the latency, UI transition, and network overhead of safe user journey interactions
// without recording sensitive input values or executing destructive actions.

import { Page } from 'playwright';
import { ActionPerformance, PerformancePolicyConfig } from './types';
import { DEFAULT_PERFORMANCE_POLICY } from './policy';

export class ActionPerformanceTracker {
  /**
   * Measures a safe action executed on a Playwright page.
   */
  static async measureAction(
    page: Page,
    actionType: string,
    targetDescription: string,
    selector: string | undefined,
    actionFn: () => Promise<void>,
    policy: PerformancePolicyConfig = DEFAULT_PERFORMANCE_POLICY
  ): Promise<ActionPerformance> {
    const startTime = Date.now();
    let networkRequestsTriggered = 0;
    const initialUrl = page.url();

    const requestCounter = () => {
      networkRequestsTriggered++;
    };

    page.on('request', requestCounter);

    let success = false;
    let timeout = false;
    let errorMessage: string | undefined;

    try {
      await Promise.race([
        actionFn(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Action execution timed out')), policy.requestTimeoutMs)
        ),
      ]);
      success = true;
    } catch (err: any) {
      success = false;
      errorMessage = err.message;
      if (err.message.toLowerCase().includes('time')) {
        timeout = true;
      }
    } finally {
      page.off('request', requestCounter);
    }

    const durationMs = Date.now() - startTime;
    const resultingUrl = page.url();
    const resultingNavigationUrl = resultingUrl !== initialUrl ? resultingUrl : undefined;

    return {
      actionType,
      targetDescription,
      selector,
      pageUrl: initialUrl,
      durationMs,
      resultingNavigationUrl,
      networkRequestsTriggered,
      success,
      timeout,
      errorMessage,
      timestamp: new Date().toISOString(),
    };
  }
}
