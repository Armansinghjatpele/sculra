// ==============================================================================
// Sculra Confidence Evaluator (worker/src/observability/confidence.ts)
// ==============================================================================

import { ConfidenceLevel } from './types';

export interface ConfidenceAssessment {
  level: ConfidenceLevel;
  reason: string;
}

export class ConfidenceEvaluator {
  /**
   * Evaluates confidence without generating fake percentages.
   */
  public static evaluate(factors: {
    isDeterministic?: boolean;
    reproductionCount?: number;
    historicalRunsChecked?: number;
    hasDirectEvidence?: boolean;
    evidenceCount?: number;
    isFlaky?: boolean;
  }): ConfidenceAssessment {
    const {
      isDeterministic = false,
      reproductionCount = 0,
      historicalRunsChecked = 0,
      hasDirectEvidence = false,
      evidenceCount = 0,
      isFlaky = false,
    } = factors;

    if (!hasDirectEvidence && evidenceCount === 0 && reproductionCount === 0) {
      return {
        level: 'INSUFFICIENT_EVIDENCE',
        reason: 'No direct empirical observations or runtime traces were captured.',
      };
    }

    if (isFlaky) {
      return {
        level: 'LOW',
        reason: 'Target or test has exhibited non-deterministic flakiness across historical runs.',
      };
    }

    if (isDeterministic && reproductionCount >= 2) {
      return {
        level: 'HIGH',
        reason: `Reproduced deterministically in ${reproductionCount} compatible runs with direct evidence.`,
      };
    }

    if (hasDirectEvidence && evidenceCount >= 3 && historicalRunsChecked > 0) {
      return {
        level: 'HIGH',
        reason: `Supported by ${evidenceCount} correlated evidence artifacts and historical validation.`,
      };
    }

    if (hasDirectEvidence || evidenceCount >= 1) {
      return {
        level: 'MEDIUM',
        reason: 'Directly witnessed in current execution, awaiting multi-run historical correlation.',
      };
    }

    return {
      level: 'LOW',
      reason: 'Empirical signals are limited or indirect.',
    };
  }
}
