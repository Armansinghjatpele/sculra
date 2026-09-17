// ==============================================================================
// Sculra Historical QA Memory Correlator (worker/src/remediation/history-context.ts)
// ==============================================================================

import { FailureObservation, HistoricalContext, HistoricalOccurrence } from './types';

export class HistoryContextCorrelator {
  /**
   * Correlates an observed failure with historical test runs and past findings.
   * Strictly labels past occurrences as HISTORICAL to prevent false current claims.
   */
  static correlate(
    observation: FailureObservation,
    historicalRuns: any[] = [],
    historicalFindings: any[] = []
  ): HistoricalContext {
    const fingerprint = observation.fingerprint;
    const previousOccurrences: HistoricalOccurrence[] = [];
    const similarFingerprints = new Set<string>();

    let isRecurring = false;
    let isRecentRegression = false;
    let consecutiveFailures = 0;
    let lastSeenRunId: string | undefined;

    // 1. Search in historical findings by fingerprint
    for (const finding of historicalFindings) {
      if (finding.fingerprint === fingerprint) {
        isRecurring = (finding.occurrenceCount || 1) > 1;
        consecutiveFailures = finding.consecutiveRunCount || 1;
        lastSeenRunId = finding.lastSeenRunId;

        if (finding.status === 'RECOVERED' || finding.type === 'NEW_REGRESSION') {
          isRecentRegression = true;
        }

        previousOccurrences.push({
          testRunId: finding.firstSeenRunId || 'historical-run',
          observedAt: finding.firstSeenAt || new Date().toISOString(),
          fingerprint: finding.fingerprint,
          url: finding.targetUrl,
          errorMessage: finding.errorSignature,
        });
      } else if (
        observation.url &&
        finding.targetUrl &&
        finding.targetUrl.toLowerCase() === observation.url.toLowerCase()
      ) {
        similarFingerprints.add(finding.fingerprint);
      }
    }

    // 2. Search in historical runs for matching errors or failures
    for (const run of historicalRuns) {
      if (!run || !run.findings) continue;
      for (const f of run.findings) {
        if (f.fingerprint === fingerprint) {
          if (!previousOccurrences.some((o) => o.testRunId === run.testRunId)) {
            previousOccurrences.push({
              testRunId: run.testRunId,
              observedAt: run.createdAt || run.completedAt || new Date().toISOString(),
              fingerprint: f.fingerprint,
              url: f.targetUrl,
              errorMessage: f.errorSignature || f.title,
            });
          }
        }
      }
    }

    if (previousOccurrences.length > 0) {
      isRecurring = true;
      if (!lastSeenRunId) {
        lastSeenRunId = previousOccurrences[previousOccurrences.length - 1].testRunId;
      }
    }

    const totalOccurrences = previousOccurrences.length + 1; // +1 for current failure

    return {
      isHistorical: true,
      isRecurring,
      isRecentRegression,
      totalOccurrences,
      consecutiveFailures,
      lastSeenRunId,
      stabilityState: isRecurring ? 'RECURRING' : isRecentRegression ? 'REGRESSION' : 'CURRENT_FAILURE',
      previousOccurrences,
      similarFingerprints: Array.from(similarFingerprints),
    };
  }
}
