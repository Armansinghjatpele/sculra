// ==============================================================================
// Sculra Recurring Defect & Persistent Flake Tracker (worker/src/history/recurrence.ts)
// ==============================================================================

import { HistoricalFinding, RecurrenceEvent } from './types';

export class RecurrenceTracker {
  /**
   * Identifies recurring defects across compatible runs.
   */
  static trackRecurrences(
    matchedPairs: Array<{ current: HistoricalFinding; previous: HistoricalFinding }>,
    totalCompatibleRunsCount: number
  ): RecurrenceEvent[] {
    const recurrences: RecurrenceEvent[] = [];

    for (const pair of matchedPairs) {
      const cur = pair.current;
      const prev = pair.previous;

      const occurrenceCount = (prev.occurrenceCount || 1) + 1;
      const consecutiveRunCount = (prev.consecutiveRunCount || 1) + 1;
      const totalRuns = Math.max(1, totalCompatibleRunsCount);
      const recurrenceRate = Math.min(1.0, occurrenceCount / totalRuns);

      let stabilityState: 'RECURRING' | 'STABLE_FAILURE' | 'INTERMITTENT' = 'RECURRING';
      if (consecutiveRunCount >= 3) {
        stabilityState = 'STABLE_FAILURE';
      } else if (occurrenceCount >= 2 && recurrenceRate < 0.7) {
        stabilityState = 'INTERMITTENT';
      }

      const envs = new Set<string>();
      if (prev.metadata?.environment) envs.add(prev.metadata.environment);
      if (cur.metadata?.environment) envs.add(cur.metadata.environment);

      const viewports = new Set<string>();
      if (prev.viewport) viewports.add(prev.viewport);
      if (cur.viewport) viewports.add(cur.viewport);

      const roles = new Set<string>();
      if (prev.role) roles.add(prev.role);
      if (cur.role) roles.add(cur.role);

      recurrences.push({
        id: `rec-evt-${cur.fingerprint.slice(0, 12)}-${Date.now()}`,
        fingerprint: cur.fingerprint,
        findingType: cur.type,
        title: cur.title,
        severity: cur.severity,
        category: cur.category,
        targetUrl: cur.targetUrl,
        selector: cur.selector,
        occurrenceCount,
        consecutiveRunCount,
        totalCompatibleRuns: totalRuns,
        recurrenceRate: parseFloat(recurrenceRate.toFixed(2)),
        firstSeenAt: prev.firstSeenAt || cur.firstSeenAt,
        lastSeenAt: cur.lastSeenAt || new Date().toISOString(),
        stabilityState,
        environments: Array.from(envs),
        viewports: Array.from(viewports),
        roles: Array.from(roles),
      });
    }

    return recurrences;
  }
}
