// ==============================================================================
// Sculra Deterministic Confidence Calculator (worker/src/remediation/confidence.ts)
// ==============================================================================

import {
  DiagnosisConfidence,
  FailureObservation,
  RootCauseHypothesis,
  CodeContext,
  ChangeContext,
  HistoricalContext,
} from './types';

export interface ConfidenceEvaluation {
  score: number;
  level: DiagnosisConfidence;
  positiveFactors: string[];
  negativeFactors: string[];
}

export class ConfidenceCalculator {
  /**
   * Deterministically calculates diagnostic confidence based on empirical evidence strength
   * and negative uncertainty penalties.
   */
  static evaluate(
    observation: FailureObservation,
    hypothesis: RootCauseHypothesis | undefined,
    codeContext: CodeContext,
    changeContext: ChangeContext,
    historyContext: HistoricalContext
  ): ConfidenceEvaluation {
    let score = 20; // Base baseline
    const positiveFactors: string[] = [];
    const negativeFactors: string[] = [];

    // 1. Direct runtime error evidence
    if (observation.errorMessage || observation.statusCode || observation.consoleError) {
      score += 25;
      positiveFactors.push('Direct runtime error observation available');
    }

    // 2. Matching stack trace with resolved source line
    if (observation.stackTrace && codeContext.files.some((f) => f.source === 'STACK_TRACE')) {
      score += 25;
      positiveFactors.push('Matching runtime stack trace pinned to source file');
    } else if (!observation.stackTrace) {
      score -= 10;
      negativeFactors.push('No runtime stack trace available');
    }

    // 3. Exact changed symbol or file
    if (changeContext.hasRelevantCodeChange) {
      score += 25;
      positiveFactors.push('Failure directly correlates with recently modified code');
    }

    // 4. Matching network evidence (status code, endpoint)
    if (observation.statusCode && observation.statusCode >= 400 && observation.apiEndpoint) {
      score += 20;
      positiveFactors.push('Exact HTTP status code and API endpoint verified');
    }

    // 5. Historical recurrence verification
    if (historyContext.isRecurring) {
      score += 15;
      positiveFactors.push(`Verified historical recurrence across ${historyContext.totalOccurrences} runs`);
    }

    // Negative Penalties:
    // 6. Contradictory evidence
    if (hypothesis && hypothesis.contradictingEvidenceIds.length > 0) {
      score -= 40;
      negativeFactors.push('One or more evidence items contradict the hypothesis');
    }

    // 7. Missing source code context
    if (codeContext.files.length === 0) {
      score -= 20;
      negativeFactors.push('No source files could be retrieved for context');
    }

    // 8. Partial code context
    if (codeContext.isPartial) {
      score -= 15;
      negativeFactors.push(`Partial code context: ${codeContext.partialReason || 'limits reached'}`);
    }

    // Clamp score between 5 and 95 (never 100% false certainty)
    const clampedScore = Math.max(5, Math.min(95, score));

    let level: DiagnosisConfidence = 'LOW';
    if (clampedScore >= 80) {
      level = 'VERY_HIGH';
    } else if (clampedScore >= 60) {
      level = 'HIGH';
    } else if (clampedScore >= 40) {
      level = 'MEDIUM';
    } else if (clampedScore >= 20) {
      level = 'LOW';
    } else {
      level = 'VERY_LOW';
    }

    return {
      score: clampedScore,
      level,
      positiveFactors,
      negativeFactors,
    };
  }
}
