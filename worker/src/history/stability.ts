// ==============================================================================
// Sculra Target Stability & Intermittent Flake Engine (worker/src/history/stability.ts)
// ==============================================================================

import { StabilitySignal, StabilityState } from './types';

export interface TargetObservationHistory {
  targetId: string;
  targetType: string;
  targetIdentifier: string;
  outcomes: Array<'PASS' | 'FAIL'>; // Chronological order: oldest to newest
}

export class StabilityAnalyzer {
  /**
   * Evaluates the stability state of test targets across historical runs.
   */
  static analyzeStability(histories: TargetObservationHistory[]): StabilitySignal[] {
    const signals: StabilitySignal[] = [];

    for (const h of histories) {
      const outcomes = h.outcomes;
      if (!outcomes || outcomes.length === 0) continue;

      const totalEvaluations = outcomes.length;
      let passCount = 0;
      let failCount = 0;
      let flipCount = 0;

      for (let i = 0; i < outcomes.length; i++) {
        if (outcomes[i] === 'PASS') passCount++;
        else failCount++;

        if (i > 0 && outcomes[i] !== outcomes[i - 1]) {
          flipCount++;
        }
      }

      const flakeRate = totalEvaluations > 1 ? flipCount / (totalEvaluations - 1) : 0;
      const lastOutcome = outcomes[outcomes.length - 1];

      // Consecutive counts from the latest backwards
      let consecutivePassCount = 0;
      let consecutiveFailCount = 0;
      for (let i = outcomes.length - 1; i >= 0; i--) {
        if (outcomes[i] === 'PASS') {
          if (consecutiveFailCount > 0) break;
          consecutivePassCount++;
        } else {
          if (consecutivePassCount > 0) break;
          consecutiveFailCount++;
        }
      }

      let stability: StabilityState = 'INSUFFICIENT_HISTORY';
      const reasons: string[] = [];

      if (totalEvaluations < 2) {
        stability = 'INSUFFICIENT_HISTORY';
        reasons.push('Only 1 historical evaluation observed (baseline establishment).');
      } else if (flakeRate >= 0.35 && totalEvaluations >= 3) {
        stability = 'INTERMITTENT';
        reasons.push(`Target exhibited ${flipCount} outcome transitions across ${totalEvaluations} runs (flakiness rate ${(flakeRate * 100).toFixed(0)}%).`);
      } else if (consecutiveFailCount >= 3) {
        stability = 'STABLE_FAILURE';
        reasons.push(`Target failed consecutively in the last ${consecutiveFailCount} compatible runs.`);
      } else if (consecutivePassCount >= 3) {
        stability = 'STABLE_PASS';
        reasons.push(`Target passed consistently in the last ${consecutivePassCount} compatible runs.`);
      } else if (lastOutcome === 'PASS' && failCount > 0 && consecutivePassCount >= 1) {
        stability = 'RECOVERED';
        reasons.push(`Target recovered from prior failures and passed cleanly in run.`);
      } else if (lastOutcome === 'FAIL' && failCount >= 2) {
        stability = 'RECURRING';
        reasons.push(`Target has recurring failures (${failCount}/${totalEvaluations} runs failed).`);
      } else {
        stability = lastOutcome === 'PASS' ? 'STABLE_PASS' : 'STABLE_FAILURE';
        reasons.push(`Target outcome is currently ${lastOutcome}.`);
      }

      signals.push({
        targetId: h.targetId,
        targetType: h.targetType,
        targetIdentifier: h.targetIdentifier,
        stability,
        passCount,
        failCount,
        totalEvaluations,
        flakeRate: parseFloat(flakeRate.toFixed(2)),
        consecutivePassCount,
        consecutiveFailCount,
        lastOutcome,
        description: reasons.join(' '),
        reasons,
      });
    }

    return signals;
  }
}
