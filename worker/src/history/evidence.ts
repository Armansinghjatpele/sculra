// ==============================================================================
// Sculra Historical Evidence Formatter (worker/src/history/evidence.ts)
// ==============================================================================

import { RunComparison } from './types';

export interface FormattedEvidenceItem {
  type: string;
  title: string;
  url?: string;
  message: string;
  metadata: Record<string, any>;
}

export class HistoricalEvidenceFormatter {
  /**
   * Formats a complete RunComparison into structured test_evidence items.
   */
  static formatComparisonEvidence(
    comparison: RunComparison,
    testRunId: string,
    projectId: string,
    targetUrl: string
  ): FormattedEvidenceItem[] {
    const items: FormattedEvidenceItem[] = [];

    // 1. Primary Historical Summary
    const sum = comparison.summary;
    const prevRunId = comparison.previousComparableRun?.testRunId || 'None';
    items.push({
      type: 'historical_summary',
      title: `Cross-Run Intelligence: ${sum.newRegressionsCount} regression(s), ${sum.recoveredFindingsCount} recovered, ${sum.recurringFindingsCount} recurring`,
      url: targetUrl,
      message: `Compared against run ${prevRunId} (${comparison.summary.comparisonStatus}). Score delta: ${sum.scoreDelta !== undefined ? (sum.scoreDelta > 0 ? `+${sum.scoreDelta}` : `${sum.scoreDelta}`) : 'N/A'} pts. Release trend: ${sum.releaseTrend}.`,
      metadata: {
        summary: sum,
        currentRunId: testRunId,
        previousRunId: comparison.previousComparableRun?.testRunId,
        comparisonStatus: sum.comparisonStatus,
        scoreDelta: sum.scoreDelta,
        releaseTrend: sum.releaseTrend,
        newRegressionsCount: sum.newRegressionsCount,
        recoveredFindingsCount: sum.recoveredFindingsCount,
        recurringFindingsCount: sum.recurringFindingsCount,
        notRetestedCount: sum.notRetestedCount,
        unstableTargetsCount: sum.unstableTargetsCount,
        aiInterpretation: comparison.aiInterpretation,
      },
    });

    // 2. Individual Regression Events
    for (const reg of comparison.regressions) {
      items.push({
        type: 'regression_event',
        title: `[REGRESSION] [${reg.severity.toUpperCase()}] ${reg.title}`,
        url: reg.targetUrl || targetUrl,
        message: `${reg.reason} Target: ${reg.targetUrl}${reg.selector ? ` | ${reg.selector}` : ''}`,
        metadata: {
          regression: reg,
          fingerprint: reg.fingerprint,
          category: reg.category,
          findingType: reg.findingType,
          severity: reg.severity,
          workflowId: reg.workflowId,
          businessCriticality: reg.businessCriticality,
        },
      });
    }

    // 3. Individual Recovery Events
    for (const rec of comparison.recoveries) {
      items.push({
        type: 'recovery_event',
        title: `[RECOVERED] [${rec.severity.toUpperCase()}] ${rec.title}`,
        url: rec.targetUrl || targetUrl,
        message: `${rec.reason}`,
        metadata: {
          recovery: rec,
          fingerprint: rec.fingerprint,
          category: rec.category,
          findingType: rec.findingType,
        },
      });
    }

    // 4. Individual Recurrence Events
    for (const recur of comparison.recurrences) {
      items.push({
        type: 'recurrence_event',
        title: `[RECURRING] [${recur.severity.toUpperCase()}] ${recur.title} (${recur.occurrenceCount}x)`,
        url: recur.targetUrl || targetUrl,
        message: `Persistent defect observed across ${recur.consecutiveRunCount} consecutive runs (recurrence rate ${(recur.recurrenceRate * 100).toFixed(0)}%).`,
        metadata: {
          recurrence: recur,
          fingerprint: recur.fingerprint,
          occurrenceCount: recur.occurrenceCount,
          consecutiveRunCount: recur.consecutiveRunCount,
          stabilityState: recur.stabilityState,
        },
      });
    }

    // 5. Stability Signal Summary
    if (comparison.stabilitySignals.length > 0) {
      const unstable = comparison.stabilitySignals.filter((s) => s.stability === 'INTERMITTENT');
      items.push({
        type: 'stability_signal',
        title: `Target Stability Analysis: ${comparison.stabilitySignals.length} targets monitored (${unstable.length} intermittent)`,
        url: targetUrl,
        message: `Evaluated target outcome histories. Identified ${unstable.length} intermittent/flaky targets and ${comparison.stabilitySignals.filter((s) => s.stability === 'STABLE_PASS').length} consistently stable passes.`,
        metadata: {
          signals: comparison.stabilitySignals,
          intermittentCount: unstable.length,
        },
      });
    }

    // 6. Trend Snapshot
    if (comparison.metricDeltas.length > 0 || comparison.coverageTrends.length > 0) {
      items.push({
        type: 'trend_snapshot',
        title: `QA Metric & Coverage Trends (${comparison.summary.releaseTrend})`,
        url: targetUrl,
        message: `Release score trend is ${comparison.summary.releaseTrend} with ${comparison.metricDeltas.length} category deltas and ${comparison.coverageTrends.length} coverage trends evaluated.`,
        metadata: {
          releaseTrend: comparison.summary.releaseTrend,
          metricDeltas: comparison.metricDeltas,
          coverageTrends: comparison.coverageTrends,
        },
      });
    }

    return items;
  }

  /**
   * Convenience alias to format historical comparison into test evidence items.
   */
  static formatHistoricalEvidence(comparison: RunComparison, targetUrl: string): FormattedEvidenceItem[] {
    return this.formatComparisonEvidence(
      comparison,
      comparison.currentRun.testRunId,
      comparison.currentRun.projectId,
      targetUrl
    );
  }
}
