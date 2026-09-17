// ==============================================================================
// Sculra Historical QA Memory Impact Cross-Referencer
// (worker/src/change-intelligence/historical-impact.ts)
// ==============================================================================

import { AffectedRoute, AffectedApi, ChangedFile, ImpactConfidence } from './types';
import { QASignalRecord, StabilitySignal, RegressionEvent } from '../history/types';

export interface HistoricalImpactInput {
  changedFiles: ChangedFile[];
  affectedRoutes: AffectedRoute[];
  affectedApis: AffectedApi[];
  historicalSignals?: QASignalRecord[];
  stabilitySignals?: StabilitySignal[];
  recentRegressions?: RegressionEvent[];
}

export interface HistoricalAssociation {
  targetIdentifier: string;
  signalType: string;
  reason: string;
  confidence: ImpactConfidence;
  priorityBonus: number;
  recommendedDomain?: string;
}

/**
 * Cross-references changed application areas with Historical QA Memory signals.
 * Invariant: Never asserts that current change caused past defects; strictly tags historical association.
 */
export function identifyHistoricalImpact(input: HistoricalImpactInput): HistoricalAssociation[] {
  const {
    changedFiles,
    affectedRoutes,
    affectedApis,
    historicalSignals = [],
    stabilitySignals = [],
    recentRegressions = [],
  } = input;

  const associations: HistoricalAssociation[] = [];
  const seenTargets = new Set<string>();

  const changedPaths = new Set<string>();
  for (const r of affectedRoutes) changedPaths.add(r.route.toLowerCase());
  for (const a of affectedApis) changedPaths.add(a.path.toLowerCase());

  // 1. Check Recent Regressions on Changed Routes / APIs
  for (const reg of recentRegressions) {
    const regUrl = (reg.targetUrl || '').toLowerCase();
    const matches = Array.from(changedPaths).some((cp) => cp === regUrl || regUrl.endsWith(cp) || cp.endsWith(regUrl));

    if (matches && !seenTargets.has(reg.targetUrl)) {
      seenTargets.add(reg.targetUrl);
      associations.push({
        targetIdentifier: reg.targetUrl,
        signalType: 'NEW_REGRESSION',
        reason: `Target is historically associated with a recent regression in previous test runs`,
        confidence: 'HIGH',
        priorityBonus: 20,
        recommendedDomain: reg.category ? reg.category.toUpperCase() : undefined,
      });
    }
  }

  // 2. Check Stability & Flakiness on Changed Areas
  for (const stab of stabilitySignals) {
    const stabTarget = stab.targetIdentifier.toLowerCase();
    const matches = Array.from(changedPaths).some((cp) => stabTarget.includes(cp) || cp.includes(stabTarget));

    if (matches && !seenTargets.has(stab.targetIdentifier)) {
      seenTargets.add(stab.targetIdentifier);
      if (stab.stability === 'STABLE_FAILURE' || stab.stability === 'RECURRING') {
        associations.push({
          targetIdentifier: stab.targetIdentifier,
          signalType: 'RECURRING_DEFECT',
          reason: `Target historically failed in ${stab.failCount} of last ${stab.totalEvaluations} compatible runs`,
          confidence: 'HIGH',
          priorityBonus: 15,
        });
      } else if (stab.stability === 'INTERMITTENT') {
        associations.push({
          targetIdentifier: stab.targetIdentifier,
          signalType: 'INTERMITTENT_TARGET',
          reason: `Target is historically unstable/flaky (${(stab.flakeRate * 100).toFixed(0)}% transition rate)`,
          confidence: 'MEDIUM',
          priorityBonus: 10,
        });
      }
    }
  }

  // 3. Domain Specific Historical Signals
  for (const sig of historicalSignals) {
    const sigTarget = sig.targetIdentifier.toLowerCase();
    const matches = Array.from(changedPaths).some((cp) => sigTarget.includes(cp) || cp.includes(sigTarget));

    if (matches && !seenTargets.has(`${sig.targetIdentifier}:${sig.signalType}`)) {
      seenTargets.add(`${sig.targetIdentifier}:${sig.signalType}`);
      let domain: string | undefined;
      let bonus = 10;

      if (sig.signalType === 'VISUAL_REGRESSION') {
        domain = 'VISUAL';
        bonus = 15;
      } else if (sig.signalType === 'ACCESSIBILITY_REGRESSION') {
        domain = 'ACCESSIBILITY';
        bonus = 15;
      } else if (sig.signalType === 'SECURITY_REGRESSION') {
        domain = 'SECURITY';
        bonus = 20;
      } else if (sig.signalType === 'PERFORMANCE_REGRESSION') {
        domain = 'PERFORMANCE';
        bonus = 15;
      }

      associations.push({
        targetIdentifier: sig.targetIdentifier,
        signalType: sig.signalType,
        reason: `Target was previously associated with ${sig.signalType.toLowerCase().replace(/_/g, ' ')}`,
        confidence: 'HIGH',
        priorityBonus: bonus,
        recommendedDomain: domain,
      });
    }
  }

  return associations;
}
