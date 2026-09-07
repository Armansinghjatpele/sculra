// ==============================================================================
// Sculra Strategy Modes Evaluator (worker/src/strategy/modes.ts)
// ==============================================================================
// Deterministic state machine that chooses the optimal StrategyMode based on
// telemetry facts, bug severity, hypothesis state, coverage gaps, and release risks.

import { StrategyMode } from './types';
import { AIQAState } from '../ai-qa/state';
import { BugObservation } from '../issues/types';
import { JourneyResult } from '../journeys/types';

export interface ModeEvaluationContext {
  state?: AIQAState;
  bugObservations?: BugObservation[];
  journeyResults?: JourneyResult[];
  consoleErrors?: Array<{ message: string; url?: string }>;
  networkErrors?: Array<{ url: string; status: number }>;
  historicalIssuesCount?: number;
  testedViewports?: string[];
  iteration?: number;
}

export interface ModeEvaluationResult {
  mode: StrategyMode;
  reason: string;
  contributingFactors: string[];
}

export class StrategyModeEvaluator {
  /**
   * Deterministically decides the strategy mode for the current iteration.
   * AI can recommend a mode, but this deterministic evaluation is authoritative.
   */
  static evaluateMode(context: ModeEvaluationContext): ModeEvaluationResult {
    const factors: string[] = [];
    const bugs = context.bugObservations || [];
    const consoleErrs = context.consoleErrors || [];
    const networkErrs = context.networkErrors || [];
    const journeys = context.journeyResults || [];
    const state = context.state;
    const viewports = context.testedViewports || ['desktop'];

    // 1. Check for FAILURE_DRIVEN triggers (Critical / High severity issues, 5xx, runtime crashes)
    const criticalOrHighBugs = bugs.filter((b) => b.severity === 'critical' || b.severity === 'high');
    const server5xxErrors = networkErrs.filter((n) => n.status >= 500);
    const hasConsoleCrashes = consoleErrs.some((e) =>
      /uncaught|typeerror|referenceerror|fatal|unhandled/i.test(e.message)
    );
    const failedJourneys = journeys.filter((j) => j.status === 'FAILED');

    if (criticalOrHighBugs.length > 0 || server5xxErrors.length > 0 || hasConsoleCrashes || failedJourneys.length > 0) {
      if (criticalOrHighBugs.length > 0) {
        factors.push(`${criticalOrHighBugs.length} critical/high severity bug(s) detected`);
      }
      if (server5xxErrors.length > 0) {
        factors.push(`${server5xxErrors.length} HTTP 5xx server error(s) detected`);
      }
      if (hasConsoleCrashes) {
        factors.push('Unhandled runtime exceptions detected in browser console');
      }
      if (failedJourneys.length > 0) {
        factors.push(`${failedJourneys.length} user journey(s) failed`);
      }

      return {
        mode: 'FAILURE_DRIVEN',
        reason: 'Focusing on failure-driven investigation to isolate root causes and test reproducibility of detected defects.',
        contributingFactors: factors,
      };
    }

    // 2. Check for DEPTH_FIRST triggers (Active hypothesis under test, suspected issues, form validation)
    if (state) {
      const activeHypotheses = Array.from(state.hypotheses?.values() || []).filter(
        (h) => h.status === 'TESTING' || (h.status === 'PENDING' && h.confidence === 'high')
      );
      if (activeHypotheses.length > 0) {
        factors.push(`${activeHypotheses.length} active hypothesis/hypotheses require targeted deep verification`);
        return {
          mode: 'DEPTH_FIRST',
          reason: 'Pursuing depth-first investigation to experimentally confirm or disprove active test hypotheses.',
          contributingFactors: factors,
        };
      }

      if (state.suspectedIssues && state.suspectedIssues.length > 0) {
        factors.push(`${state.suspectedIssues.length} suspected issue(s) require deeper multi-step interaction`);
        return {
          mode: 'DEPTH_FIRST',
          reason: 'Investigating suspected defects through focused control manipulation.',
          contributingFactors: factors,
        };
      }
    }

    // 3. Check for RELEASE_GAP triggers (Missing viewports, untested forms on visited pages, low confidence)
    const hasUntestedViewports = !viewports.includes('mobile') || !viewports.includes('tablet');
    const hasUnexercisedForms = state && state.testedForms.length === 0 && (state.applicationMapSummary?.totalForms || 0) > 0;
    
    if (hasUntestedViewports && (context.iteration || 0) >= 2) {
      factors.push('Cross-device responsive viewports (mobile/tablet) have not been evaluated');
      return {
        mode: 'RELEASE_GAP',
        reason: 'Targeting release readiness gaps: missing responsive cross-device layout evaluation.',
        contributingFactors: factors,
      };
    }

    if (hasUnexercisedForms && (context.iteration || 0) >= 2) {
      factors.push('Discovered interactive forms remain unexercised');
      return {
        mode: 'RELEASE_GAP',
        reason: 'Targeting release readiness gaps: untested form usability and validation workflows.',
        contributingFactors: factors,
      };
    }

    // 4. Check for REGRESSION_FOCUSED triggers (Historical issues from prior test runs)
    if ((context.historicalIssuesCount || 0) > 0 && (context.iteration || 0) >= 3) {
      factors.push(`${context.historicalIssuesCount} known historical issue(s) from prior test runs on this project`);
      return {
        mode: 'REGRESSION_FOCUSED',
        reason: 'Re-verifying areas associated with historical defects to prevent regression.',
        contributingFactors: factors,
      };
    }

    // 5. Default to BREADTH_FIRST (Initial application coverage exploration)
    const visitedCount = state?.testedPages?.size || 0;
    const totalDiscovered = state?.applicationMapSummary?.totalPages || 1;
    factors.push(`Coverage status: ${visitedCount}/${totalDiscovered} discovered pages visited`);

    return {
      mode: 'BREADTH_FIRST',
      reason: 'Executing breadth-first exploration to maximize discovery and baseline coverage across routes.',
      contributingFactors: factors,
    };
  }
}
