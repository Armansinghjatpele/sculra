// ==============================================================================
// Sculra Autonomous Strategy Engine (worker/src/strategy/engine.ts)
// ==============================================================================
// Coordinates iterative candidate target discovery, deterministic mode selection,
// deterministic scoring, AI strategy reasoning, redundancy cooldown, and budget tracking.

import {
  TestTarget,
  StrategyMode,
  StrategyBudget,
  StrategyDecision,
  StrategyStopReason,
  StrategyEngineOptions,
  DeterministicTargetRanking,
} from './types';
import { ApplicationMap, CancellationToken } from '../types';
import { AIQAState } from '../ai-qa/state';
import { BugObservation } from '../issues/types';
import { JourneyResult } from '../journeys/types';
import { AIQAProvider } from '../ai-qa/provider';
import { WorkerLogger } from '../logger';
import { CandidateGenerator } from './candidate-generator';
import { StrategyModeEvaluator } from './modes';
import { DeterministicPrioritizer } from './prioritizer';
import { StrategyAnalyzer } from './analyzer';

export interface StrategyIterationResult {
  decision: StrategyDecision;
  selectedTargets: TestTarget[];
  shouldStop: boolean;
  stopReason?: StrategyStopReason;
}

export class AutonomousStrategyEngine {
  private targetUrl: string;
  private provider?: AIQAProvider;
  private logger?: WorkerLogger;
  private options: StrategyEngineOptions;

  private budget: StrategyBudget;
  private targetRegistry: Map<string, TestTarget> = new Map();
  private completedTargetIds: Set<string> = new Set();
  private failedTargetIds: Set<string> = new Set();
  private cooldownTargetIds: Map<string, number> = new Map(); // targetId -> cooldown iteration
  private decisions: StrategyDecision[] = [];

  constructor(
    targetUrl: string,
    options: StrategyEngineOptions = {},
    provider?: AIQAProvider,
    logger?: WorkerLogger
  ) {
    this.targetUrl = targetUrl;
    this.options = options;
    this.provider = provider;
    this.logger = logger;

    const maxIterations = options.maxIterations || 5;
    const maxTargets = options.maxTargets || 20;
    const maxStrategyCalls = options.maxStrategyCalls || 5;

    this.budget = {
      maxIterations,
      currentIteration: 0,
      remainingIterations: maxIterations,
      maxTargets,
      targetsExecuted: 0,
      maxDeepInvestigationDepth: 3,
      maxRetries: options.maxRetries || 2,
      maxTargetsPerPage: options.maxTargetsPerPage || 4,
      maxStrategyCalls,
      strategyCallsMade: 0,
    };
  }

  getBudget(): StrategyBudget {
    return { ...this.budget };
  }

  getDecisions(): StrategyDecision[] {
    return [...this.decisions];
  }

  getTargetRegistry(): TestTarget[] {
    return Array.from(this.targetRegistry.values());
  }

  /**
   * Plans the next strategy iteration.
   */
  async planIteration(
    testRunId: string,
    applicationMap?: ApplicationMap,
    state?: AIQAState,
    bugObservations: BugObservation[] = [],
    journeyResults: JourneyResult[] = [],
    consoleErrors: Array<{ message: string; url?: string }> = [],
    networkErrors: Array<{ url: string; status: number }> = [],
    testedViewports: string[] = ['desktop'],
    cancellationToken?: CancellationToken
  ): Promise<StrategyIterationResult> {
    // 1. Check Cancellation
    if (cancellationToken?.isCancelled) {
      return this.createStopResult('CANCELLED', 'Test execution was cancelled by user.');
    }

    // 2. Check Budget
    if (this.budget.remainingIterations <= 0 || this.budget.targetsExecuted >= this.budget.maxTargets) {
      return this.createStopResult(
        'STRATEGY_BUDGET_EXHAUSTED',
        `Strategy budget reached limit (Iterations: ${this.budget.currentIteration}/${this.budget.maxIterations}, Targets: ${this.budget.targetsExecuted}/${this.budget.maxTargets}).`
      );
    }

    this.budget.currentIteration++;
    this.budget.remainingIterations = Math.max(0, this.budget.maxIterations - this.budget.currentIteration);
    const iteration = this.budget.currentIteration;

    this.logger?.log('strategy_iteration_started', {
      iteration,
      remainingIterations: this.budget.remainingIterations,
      targetsExecuted: this.budget.targetsExecuted,
    });

    // 3. Generate Candidate Targets
    const rawCandidates = CandidateGenerator.generateCandidates({
      targetUrl: this.targetUrl,
      applicationMap,
      state,
      bugObservations,
      journeyResults,
      consoleErrors,
      networkErrors,
      testedViewports,
    });

    // Merge into target registry
    for (const candidate of rawCandidates) {
      if (!this.targetRegistry.has(candidate.id)) {
        this.targetRegistry.set(candidate.id, candidate);
      } else {
        // Update candidate metadata if existing
        const existing = this.targetRegistry.get(candidate.id)!;
        existing.reasons = Array.from(new Set([...existing.reasons, ...candidate.reasons]));
        if (candidate.metadata) {
          existing.metadata = { ...existing.metadata, ...candidate.metadata };
        }
      }
    }

    const allCandidates = Array.from(this.targetRegistry.values());

    // 4. Deterministically Evaluate Strategy Mode
    const modeResult = StrategyModeEvaluator.evaluateMode({
      state,
      bugObservations,
      journeyResults,
      consoleErrors,
      networkErrors,
      testedViewports,
      iteration,
    });
    const currentMode: StrategyMode = modeResult.mode;

    this.logger?.log('strategy_mode_selected', {
      iteration,
      mode: currentMode,
      reason: modeResult.reason,
      contributingFactors: modeResult.contributingFactors,
    });

    // 5. Deterministic Prioritization
    const { rankedTargets, rankings } = DeterministicPrioritizer.prioritize(allCandidates, {
      mode: currentMode,
      state,
      completedTargetIds: this.completedTargetIds,
      cooldownTargetIds: this.cooldownTargetIds,
      currentIteration: iteration,
    });

    // Update target registry with scored versions
    for (const target of rankedTargets) {
      this.targetRegistry.set(target.id, target);
    }

    // Filter viable targets that are not already executed or in active cooldown
    const viableCandidates = rankedTargets.filter((t) => {
      if (this.completedTargetIds.has(t.id)) return false;
      const cd = this.cooldownTargetIds.get(t.id);
      if (cd && cd >= iteration) return false;
      return true;
    });

    if (viableCandidates.length === 0) {
      return this.createStopResult(
        'ALL_TARGETS_COVERED',
        'All discovered candidates and high-value paths have been exercised.'
      );
    }

    // 6. AI Strategy Reasoning Layer (if provider is available and budget allows)
    let aiRecommendation = undefined;
    let isFallback = true;
    let fallbackReason: string | undefined = 'Provider not configured';

    if (this.provider && this.budget.strategyCallsMade < this.budget.maxStrategyCalls) {
      this.budget.strategyCallsMade++;
      const analyzer = new StrategyAnalyzer({
        provider: this.provider,
        logger: this.logger,
      });

      const analysisResult = await analyzer.analyze(
        testRunId,
        this.targetUrl,
        currentMode,
        iteration,
        this.budget,
        viableCandidates,
        state,
        cancellationToken
      );

      aiRecommendation = analysisResult.recommendation;
      isFallback = analysisResult.isFallback;
      fallbackReason = analysisResult.fallbackReason || (isFallback ? 'AI fallback' : undefined);
    }

    // 7. Select Target(s) for Execution
    let selectedTargetIds: string[] = [];
    if (aiRecommendation && aiRecommendation.selectedTargetIds.length > 0) {
      selectedTargetIds = aiRecommendation.selectedTargetIds;
    } else {
      selectedTargetIds = viableCandidates.slice(0, 2).map((t) => t.id);
    }

    // Resolve target objects
    const selectedTargets: TestTarget[] = [];
    for (const id of selectedTargetIds) {
      const target = this.targetRegistry.get(id);
      if (target) {
        target.status = 'SELECTED';
        target.lastAttemptedIteration = iteration;
        target.attemptsCount++;
        selectedTargets.push(target);
      }
    }

    // Ensure at least 1 target is selected
    if (selectedTargets.length === 0 && viableCandidates.length > 0) {
      const topTarget = viableCandidates[0];
      topTarget.status = 'SELECTED';
      topTarget.lastAttemptedIteration = iteration;
      topTarget.attemptsCount++;
      selectedTargets.push(topTarget);
    }

    // 8. Record Strategy Decision
    const decision: StrategyDecision = {
      iteration,
      mode: aiRecommendation?.recommendedMode || currentMode,
      selectedTargets,
      deterministicRankings: rankings.slice(0, 10),
      aiRecommendation,
      budgetRemaining: {
        iterations: this.budget.remainingIterations,
        targets: Math.max(0, this.budget.maxTargets - this.budget.targetsExecuted),
        calls: Math.max(0, this.budget.maxStrategyCalls - this.budget.strategyCallsMade),
      },
      isFallback,
      fallbackReason,
      evaluatedAt: new Date().toISOString(),
    };

    this.decisions.push(decision);

    this.logger?.log('strategy_decision_recorded', {
      iteration,
      mode: decision.mode,
      selectedCount: selectedTargets.length,
      topTargetId: selectedTargets[0]?.id,
      isFallback,
    });

    // Check if AI suggested stop and sufficient coverage exists
    if (aiRecommendation?.suggestedStop && this.budget.targetsExecuted >= 5) {
      return {
        decision,
        selectedTargets,
        shouldStop: true,
        stopReason: 'GOAL_ACHIEVED',
      };
    }

    return {
      decision,
      selectedTargets,
      shouldStop: false,
    };
  }

  /**
   * Records the outcome of a target execution.
   */
  recordTargetOutcome(targetId: string, status: 'PASSED' | 'FAILED' | 'SKIPPED') {
    const target = this.targetRegistry.get(targetId);
    if (!target) return;

    this.budget.targetsExecuted++;

    if (status === 'PASSED') {
      target.status = 'EXECUTED';
      this.completedTargetIds.add(targetId);
      this.failedTargetIds.delete(targetId);
    } else if (status === 'FAILED') {
      target.status = 'FAILED';
      this.failedTargetIds.add(targetId);
      // Put in cooldown for 1 iteration to prevent immediate infinite retry
      this.cooldownTargetIds.set(targetId, this.budget.currentIteration + 1);
    } else {
      target.status = 'SKIPPED';
    }
  }

  private createStopResult(reason: StrategyStopReason, message: string): StrategyIterationResult {
    const decision: StrategyDecision = {
      iteration: this.budget.currentIteration,
      mode: 'BREADTH_FIRST',
      selectedTargets: [],
      deterministicRankings: [],
      budgetRemaining: {
        iterations: this.budget.remainingIterations,
        targets: Math.max(0, this.budget.maxTargets - this.budget.targetsExecuted),
        calls: Math.max(0, this.budget.maxStrategyCalls - this.budget.strategyCallsMade),
      },
      isFallback: true,
      fallbackReason: message,
      evaluatedAt: new Date().toISOString(),
    };

    return {
      decision,
      selectedTargets: [],
      shouldStop: true,
      stopReason: reason,
    };
  }
}
