// ==============================================================================
// Sculra Deterministic Strategy Prioritizer (worker/src/strategy/prioritizer.ts)
// ==============================================================================
// Calculates bounded, explainable deterministic priority scores (0 - 100)
// based on coverage value, risk, failure history, novelty, cost, dependencies, and mode.

import { TestTarget, StrategyMode, DeterministicTargetRanking, TestTargetStatus } from './types';
import { AIQAState } from '../ai-qa/state';

export interface PrioritizationContext {
  mode: StrategyMode;
  state?: AIQAState;
  completedTargetIds?: Set<string>;
  cooldownTargetIds?: Map<string, number>; // targetId -> cooldown until iteration
  currentIteration?: number;
}

export class DeterministicPrioritizer {
  /**
   * Prioritizes and ranks candidate TestTargets deterministically.
   * Returns a sorted copy of targets (highest priority first) with detailed explanations.
   */
  static prioritize(
    candidates: TestTarget[],
    context: PrioritizationContext
  ): { rankedTargets: TestTarget[]; rankings: DeterministicTargetRanking[] } {
    const mode = context.mode;
    const completed = context.completedTargetIds || new Set<string>();
    const cooldown = context.cooldownTargetIds || new Map<string, number>();
    const currentIter = context.currentIteration || 1;

    const scoredTargets: Array<{ target: TestTarget; score: number; reasons: string[] }> = [];

    for (const candidate of candidates) {
      const reasons: string[] = [];
      let baseScore = 50;

      // 1. Target Type & Base Intrinsic Value
      switch (candidate.targetType) {
        case 'PREVIOUS_FAILURE':
          baseScore = 75;
          reasons.push('High intrinsic priority: investigates prior defect or runtime crash');
          break;
        case 'SUSPECTED_ISSUE':
          baseScore = 70;
          reasons.push('Target represents an active hypothesis requiring empirical verification');
          break;
        case 'FORM':
          baseScore = 65;
          reasons.push('Interactive form with input validation and state submission risks');
          break;
        case 'PAGE':
          baseScore = 60;
          reasons.push('Structural route exploration establishing baseline page coverage');
          break;
        case 'BUTTON':
          baseScore = candidate.metadata?.button?.isPrimaryCta ? 58 : 50;
          reasons.push(candidate.metadata?.button?.isPrimaryCta ? 'Primary call-to-action button' : 'Interactive UI control');
          break;
        case 'RESPONSIVE_VIEW':
          baseScore = 55;
          reasons.push(`Cross-device responsive layout check (${candidate.viewportName?.toUpperCase() || 'MOBILE'})`);
          break;
        case 'NAVIGATION_PATH':
          baseScore = 48;
          reasons.push('Internal route transition path');
          break;
        default:
          baseScore = 45;
          break;
      }

      // 2. Mode-Specific Weight Adjustments
      if (mode === 'FAILURE_DRIVEN') {
        if (candidate.source === 'FAILURE_INVESTIGATION' || candidate.targetType === 'PREVIOUS_FAILURE') {
          baseScore += 25;
          reasons.push('[Mode: FAILURE_DRIVEN] +25 pts: Direct defect follow-up');
        } else if (candidate.targetType === 'SUSPECTED_ISSUE') {
          baseScore += 15;
          reasons.push('[Mode: FAILURE_DRIVEN] +15 pts: Suspected issue testing');
        } else {
          baseScore -= 10;
          reasons.push('[Mode: FAILURE_DRIVEN] -10 pts: Deprioritizing unrelated new exploration');
        }
      } else if (mode === 'DEPTH_FIRST') {
        if (candidate.targetType === 'SUSPECTED_ISSUE' || candidate.source === 'HYPOTHESIS') {
          baseScore += 25;
          reasons.push('[Mode: DEPTH_FIRST] +25 pts: Active hypothesis deep exploration');
        } else if (candidate.targetType === 'FORM' || candidate.targetType === 'PREVIOUS_FAILURE') {
          baseScore += 15;
          reasons.push('[Mode: DEPTH_FIRST] +15 pts: Deep multi-step interaction target');
        }
      } else if (mode === 'BREADTH_FIRST') {
        if (candidate.targetType === 'PAGE' && candidate.status === 'PENDING') {
          baseScore += 25;
          reasons.push('[Mode: BREADTH_FIRST] +25 pts: Unvisited route breadth coverage');
        } else if (candidate.targetType === 'NAVIGATION_PATH' && candidate.status === 'PENDING') {
          baseScore += 15;
          reasons.push('[Mode: BREADTH_FIRST] +15 pts: Unexercised navigation link');
        }
      } else if (mode === 'RELEASE_GAP') {
        if (candidate.targetType === 'RESPONSIVE_VIEW') {
          baseScore += 30;
          reasons.push('[Mode: RELEASE_GAP] +30 pts: Missing target viewport coverage');
        } else if (candidate.targetType === 'FORM' && candidate.status === 'PENDING') {
          baseScore += 20;
          reasons.push('[Mode: RELEASE_GAP] +20 pts: Untested form functional flow');
        }
      } else if (mode === 'REGRESSION_FOCUSED') {
        if (candidate.source === 'REGRESSION') {
          baseScore += 30;
          reasons.push('[Mode: REGRESSION_FOCUSED] +30 pts: Historical defect re-verification');
        }
      }

      // 3. Risk Modifiers
      if (candidate.riskLevel === 'critical') {
        baseScore += 15;
        reasons.push('Risk modifier: Critical severity impact');
      } else if (candidate.riskLevel === 'high') {
        baseScore += 10;
        reasons.push('Risk modifier: High severity risk');
      }

      // 4. Status, Attempts & Redundancy Cooldown
      if (completed.has(candidate.id) || candidate.status === 'EXECUTED') {
        baseScore -= 40;
        reasons.push('Redundancy penalty: Target previously executed in this test run');
      }

      const cooldownUntil = cooldown.get(candidate.id);
      if (cooldownUntil && cooldownUntil >= currentIter) {
        baseScore -= 30;
        reasons.push(`Cooldown penalty: Under active cooldown until iteration ${cooldownUntil}`);
      }

      if (candidate.attemptsCount > 0) {
        const attemptPenalty = Math.min(25, candidate.attemptsCount * 10);
        baseScore -= attemptPenalty;
        reasons.push(`Retry penalty: Attempted ${candidate.attemptsCount} time(s) (-${attemptPenalty} pts)`);
      }

      // 5. Cost Adjustments
      if (candidate.estimatedCost >= 4) {
        baseScore -= 10;
        reasons.push('Cost adjustment: High execution overhead');
      }

      // 6. Check Dependencies
      // If candidate has unmet dependencies, lower score slightly so prerequisites execute first
      let hasUnmetDependency = false;
      for (const depId of candidate.dependencies) {
        if (!completed.has(depId)) {
          hasUnmetDependency = true;
          break;
        }
      }
      if (hasUnmetDependency && candidate.targetType !== 'PAGE') {
        baseScore -= 15;
        reasons.push('Dependency notice: Prerequisite route visit required prior to deep action');
      }

      // Bound score cleanly between 0 and 100
      const finalScore = Math.max(0, Math.min(100, Math.round(baseScore)));

      // Update target object
      const updatedTarget: TestTarget = {
        ...candidate,
        priorityScore: finalScore,
        priorityLevel:
          finalScore >= 85 ? 'critical' : finalScore >= 70 ? 'high' : finalScore >= 45 ? 'medium' : 'low',
        reasons: [...candidate.reasons, ...reasons],
      };

      scoredTargets.push({
        target: updatedTarget,
        score: finalScore,
        reasons,
      });
    }

    // Sort descending by priority score
    scoredTargets.sort((a, b) => b.score - a.score);

    const rankedTargets = scoredTargets.map((s) => s.target);
    const rankings: DeterministicTargetRanking[] = scoredTargets.map((s) => ({
      targetId: s.target.id,
      score: s.score,
      reasons: s.reasons,
    }));

    return {
      rankedTargets,
      rankings,
    };
  }
}
