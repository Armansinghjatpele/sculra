// ==============================================================================
// Sculra Recovery & Retest Verification Engine (worker/src/history/recovery.ts)
// ==============================================================================

import { HistoricalFinding, RecoveryEvent } from './types';

export interface RetestedTargetCoverage {
  visitedUrls: Set<string>;
  testedSelectors: Set<string>;
  testedApiEndpoints: Set<string>;
  executedSecurityChecks: boolean;
  executedPerformanceChecks: boolean;
  executedAccessibilityChecks: boolean;
  testedWorkflows: Set<string>;
}

export class RecoveryDetector {
  /**
   * Evaluates unmatched previous findings to distinguish genuine recoveries from un-retested defects.
   * STRICT GUARANTEE: A defect is ONLY marked RECOVERED if the target was actually retested cleanly.
   */
  static evaluateRecoveries(
    unmatchedPreviousFindings: HistoricalFinding[],
    coverage: RetestedTargetCoverage,
    currentRunId: string
  ): {
    recoveries: RecoveryEvent[];
    notRetested: HistoricalFinding[];
  } {
    const recoveries: RecoveryEvent[] = [];
    const notRetested: HistoricalFinding[] = [];

    for (const prev of unmatchedPreviousFindings) {
      const wasRetested = this.wasTargetRetested(prev, coverage);

      if (wasRetested) {
        recoveries.push({
          id: `rec-${prev.fingerprint.slice(0, 12)}-${Date.now()}`,
          fingerprint: prev.fingerprint,
          findingType: prev.type,
          title: prev.title,
          severity: prev.severity,
          category: prev.category,
          targetUrl: prev.targetUrl,
          selector: prev.selector,
          method: prev.method,
          role: prev.role,
          viewport: prev.viewport,
          previousRunState: 'FAILED',
          currentRunState: 'PASSED_RETESTED',
          reason: `Target (${prev.targetUrl}${prev.selector ? ` ${prev.selector}` : ''}) was actively retested in run ${currentRunId} and verified clean with zero defects.`,
          recoveredAt: new Date().toISOString(),
          consecutiveCleanRunsCount: 1,
        });
      } else {
        notRetested.push({
          ...prev,
          historicalStatus: 'NOT_RETESTED',
        });
      }
    }

    return {
      recoveries,
      notRetested,
    };
  }

  /**
   * Checks if the specific target and domain were exercised in the current test run.
   */
  private static wasTargetRetested(
    finding: HistoricalFinding,
    coverage: RetestedTargetCoverage
  ): boolean {
    const targetUrl = (finding.targetUrl || '').toLowerCase();
    const cat = (finding.category || '').toLowerCase();
    const typ = (finding.type || '').toUpperCase();

    // 1. API Findings
    if (cat === 'api' || typ.startsWith('API_') || finding.method) {
      const apiEndpointKey = `${finding.method || 'GET'}:${targetUrl}`;
      return coverage.testedApiEndpoints.has(apiEndpointKey) || coverage.visitedUrls.has(targetUrl);
    }

    // 2. Security Findings
    if (cat === 'security' || typ.startsWith('SECURITY_') || typ.startsWith('AUTH_')) {
      if (!coverage.executedSecurityChecks) return false;
      return coverage.visitedUrls.has(targetUrl);
    }

    // 3. Performance Findings
    if (cat === 'performance' || typ.startsWith('PERFORMANCE_') || typ.includes('LATENCY')) {
      if (!coverage.executedPerformanceChecks) return false;
      return coverage.visitedUrls.has(targetUrl);
    }

    // 4. Accessibility Findings
    if (cat === 'accessibility' || typ.startsWith('ACCESSIBILITY_') || typ.includes('WCAG')) {
      if (!coverage.executedAccessibilityChecks) return false;
      return coverage.visitedUrls.has(targetUrl);
    }

    // 5. Element-specific UI/Functional checks
    if (finding.selector) {
      const hasVisitedPage = coverage.visitedUrls.has(targetUrl);
      const hasTestedSelector = coverage.testedSelectors.has(finding.selector);
      // Retested if either selector explicitly interacted with or page fully traversed
      return hasTestedSelector || hasVisitedPage;
    }

    // 6. General Page-level findings
    return coverage.visitedUrls.has(targetUrl);
  }
}
