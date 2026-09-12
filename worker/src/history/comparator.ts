// ==============================================================================
// Sculra Comparable Run Selector & Compatibility Engine
// (worker/src/history/comparator.ts)
// ==============================================================================

import { HistoricalRun, ComparableRun } from './types';

export class RunComparator {
  /**
   * Evaluates the compatibility between a current run and candidate historical runs.
   * Ranks candidates by compatibility score and recency, returning the best comparable run.
   */
  static selectBestComparableRun(
    currentRun: HistoricalRun,
    historicalRuns: HistoricalRun[]
  ): {
    bestMatch?: ComparableRun;
    compatibleRuns: ComparableRun[];
    status: 'COMPARABLE' | 'BASELINE_MISSING' | 'NO_COMPARABLE_RUN' | 'INSUFFICIENT_DATA';
    reason: string;
  } {
    if (!historicalRuns || historicalRuns.length === 0) {
      return {
        compatibleRuns: [],
        status: 'BASELINE_MISSING',
        reason: 'No prior historical runs exist for this project (initial baseline run).',
      };
    }

    const assessed: ComparableRun[] = [];

    for (const histRun of historicalRuns) {
      // Exclude current run itself
      if (histRun.testRunId === currentRun.testRunId) continue;

      // Exclude in-progress or queued runs
      if (histRun.status === 'queued' || histRun.status === 'running') continue;

      const evalResult = this.evaluateCompatibility(currentRun, histRun);
      assessed.push(evalResult);
    }

    // Filter to compatible candidates
    const compatible = assessed
      .filter((c) => c.isCompatible)
      .sort((a, b) => {
        // Highest compatibility score first
        if (b.compatibilityScore !== a.compatibilityScore) {
          return b.compatibilityScore - a.compatibilityScore;
        }
        // Most recent createdAt next
        return new Date(b.run.createdAt).getTime() - new Date(a.run.createdAt).getTime();
      });

    if (compatible.length === 0) {
      const topIncompatible = assessed[0];
      const detailReason = topIncompatible
        ? `Previous runs exist but are incompatible: ${topIncompatible.incompatibilityReasons.join('; ')}`
        : 'No compatible previous run matching project, environment, and configuration was found.';

      return {
        compatibleRuns: [],
        status: 'NO_COMPARABLE_RUN',
        reason: detailReason,
      };
    }

    const best = compatible[0];
    return {
      bestMatch: best,
      compatibleRuns: compatible,
      status: 'COMPARABLE',
      reason: `Selected previous comparable run (${best.run.testRunId}) with compatibility score ${best.compatibilityScore}/100.`,
    };
  }

  /**
   * Deterministically calculates compatibility between two runs.
   */
  static evaluateCompatibility(current: HistoricalRun, previous: HistoricalRun): ComparableRun {
    const reasons: string[] = [];
    const incompatibilityReasons: string[] = [];
    let score = 100;

    // 1. Project Identity (Strict Mandatory)
    if (current.projectId !== previous.projectId) {
      incompatibilityReasons.push(`Different project ID (${current.projectId} vs ${previous.projectId})`);
      return {
        run: previous,
        compatibilityScore: 0,
        isCompatible: false,
        reasons: [],
        incompatibilityReasons,
      };
    }
    reasons.push('Same project');

    // 2. Target Host / Origin (Strict Mandatory)
    try {
      const curOrigin = new URL(current.targetUrl).origin;
      const prevOrigin = new URL(previous.targetUrl).origin;
      if (curOrigin !== prevOrigin) {
        incompatibilityReasons.push(`Different target host (${curOrigin} vs ${prevOrigin})`);
        return {
          run: previous,
          compatibilityScore: 0,
          isCompatible: false,
          reasons,
          incompatibilityReasons,
        };
      }
      reasons.push('Same target origin');
    } catch {
      // Fallback string match
      if (current.targetUrl.split('/')[2] !== previous.targetUrl.split('/')[2]) {
        incompatibilityReasons.push('Different target host');
        return {
          run: previous,
          compatibilityScore: 0,
          isCompatible: false,
          reasons,
          incompatibilityReasons,
        };
      }
    }

    // 3. Environment Compatibility
    if (current.environment !== previous.environment) {
      score -= 30;
      incompatibilityReasons.push(`Environment mismatch: ${current.environment} vs ${previous.environment}`);
    } else {
      reasons.push(`Matching environment: ${current.environment}`);
    }

    // 4. Authentication Role Context
    if (current.role || previous.role) {
      if (current.role !== previous.role) {
        score -= 20;
        incompatibilityReasons.push(`Different authentication role: ${current.role || 'anonymous'} vs ${previous.role || 'anonymous'}`);
      } else {
        reasons.push(`Matching auth role: ${current.role}`);
      }
    }

    // 5. Viewport Dimension Match
    if (current.viewport && previous.viewport) {
      const curVp = typeof current.viewport === 'string' ? current.viewport : `${current.viewport.width}x${current.viewport.height}`;
      const prevVp = typeof previous.viewport === 'string' ? previous.viewport : `${previous.viewport.width}x${previous.viewport.height}`;
      if (curVp !== prevVp) {
        score -= 15;
        incompatibilityReasons.push(`Different viewport: ${curVp} vs ${prevVp}`);
      } else {
        reasons.push('Matching viewport dimensions');
      }
    }

    // 6. Branch / Commit proximity bonus
    if (current.branch && previous.branch && current.branch === previous.branch) {
      reasons.push(`Same Git branch: ${current.branch}`);
    }

    // A run is considered compatible if score >= 60 and no fatal project/origin mismatch occurred
    const isCompatible = score >= 60;

    return {
      run: previous,
      compatibilityScore: Math.max(0, score),
      isCompatible,
      reasons,
      incompatibilityReasons,
    };
  }
}
