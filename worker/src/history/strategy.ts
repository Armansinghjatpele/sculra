// ==============================================================================
// Sculra Historical Strategy Integration Engine (worker/src/history/strategy.ts)
// ==============================================================================

import { TestTarget } from '../strategy/types';
import { QASignalRecord, StabilitySignal, RegressionEvent } from './types';

export interface HistoricalStrategyModifier {
  targetId: string;
  priorityBonus: number;
  reasons: string[];
}

export class HistoricalStrategyEngine {
  /**
   * Evaluates historical memory signals to compute deterministic prioritization boosts.
   */
  static computeHistoricalBoosts(
    targets: TestTarget[],
    signals: QASignalRecord[],
    stabilitySignals: StabilitySignal[],
    recentRegressions: RegressionEvent[]
  ): Map<string, HistoricalStrategyModifier> {
    const modifiers = new Map<string, HistoricalStrategyModifier>();

    // Build fast lookup index for regressions by targetUrl or selector
    const regressedTargets = new Set<string>();
    for (const reg of recentRegressions) {
      if (reg.targetUrl) regressedTargets.add(reg.targetUrl.toLowerCase());
      if (reg.selector) regressedTargets.add(reg.selector.toLowerCase());
    }

    // Build stability lookup by targetIdentifier
    const stabilityMap = new Map<string, StabilitySignal>();
    for (const stab of stabilitySignals) {
      stabilityMap.set(stab.targetIdentifier.toLowerCase(), stab);
    }

    // Build signals lookup
    const signalMap = new Map<string, QASignalRecord[]>();
    for (const sig of signals) {
      const key = sig.targetIdentifier.toLowerCase();
      const existing = signalMap.get(key) || [];
      existing.push(sig);
      signalMap.set(key, existing);
    }

    for (const target of targets) {
      const reasons: string[] = [];
      let totalBonus = 0;

      const targetUrl = (target.pageUrl || (target as any).url || '').toLowerCase();
      const targetSelector = (target.selector || '').toLowerCase();
      const targetIdentifier = targetSelector || targetUrl || target.id;

      // 1. Recent Regression Boost (+25 pts)
      if (regressedTargets.has(targetUrl) || (targetSelector && regressedTargets.has(targetSelector))) {
        totalBonus += 25;
        reasons.push('Priority +25: Target regressed in previous comparable test run');
      }

      // 2. Stability / Flakiness Signals
      const stab = stabilityMap.get(targetIdentifier) || stabilityMap.get(targetUrl);
      if (stab) {
        if (stab.stability === 'INTERMITTENT') {
          totalBonus += 15;
          reasons.push(`Priority +15: Intermittent/unstable target (${(stab.flakeRate * 100).toFixed(0)}% transition rate across ${stab.totalEvaluations} runs)`);
        } else if (stab.stability === 'STABLE_FAILURE' || stab.stability === 'RECURRING') {
          totalBonus += 20;
          reasons.push(`Priority +20: Failed in ${stab.failCount} of last ${stab.totalEvaluations} compatible runs`);
        }
      }

      // 3. Specific QA Signal Boosts
      const sigs = signalMap.get(targetIdentifier) || signalMap.get(targetUrl) || [];
      for (const sig of sigs) {
        if (sig.signalType === 'SECURITY_REGRESSION' && sig.severity === 'critical') {
          totalBonus += 25;
          reasons.push('Priority +25: Recurring critical security defect detected on target');
          break;
        } else if (sig.signalType === 'ACCESSIBILITY_REGRESSION' && (sig.severity === 'critical' || sig.severity === 'high')) {
          totalBonus += 20;
          reasons.push('Priority +20: Persistent high-severity accessibility barrier on workflow');
          break;
        } else if (sig.signalType === 'UNTESTED_CRITICAL_WORKFLOW') {
          totalBonus += 30;
          reasons.push('Priority +30: Business-critical workflow was untested in recent run');
          break;
        }
      }

      // Cap maximum historical bonus to +40 pts to preserve baseline fairness
      const finalBonus = Math.min(40, totalBonus);

      if (finalBonus > 0) {
        modifiers.set(target.id, {
          targetId: target.id,
          priorityBonus: finalBonus,
          reasons,
        });
      }
    }

    return modifiers;
  }
}
