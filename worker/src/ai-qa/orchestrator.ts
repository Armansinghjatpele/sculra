// ==============================================================================
// Sculra Adaptive AI QA Orchestrator (worker/src/ai-qa/orchestrator.ts)
// ==============================================================================
// Orchestrates multi-iteration, bounded, adaptive AI QA test loops.
// THE AI NEVER DIRECTLY CONTROLS THE BROWSER. The AI generates structured plans,
// which pass through the strict Safety Validator before execution by the
// existing deterministic JourneyExecutor.

import { Browser } from 'playwright';
import {
  AIQAContext,
  AIQAPlan,
  AIQAResult,
  AIQAPlanSummary,
  AIQAResultSummary,
  AIQAIssueAssessment,
  AIQAConfig,
  AIQAStopReason,
  DEFAULT_AI_QA_CONFIG,
} from './types';
import { AIQAState, AIQAStateSummary } from './state';
import { AIQAStateManager } from './state-manager';
import { AIQAProvider } from './provider';
import { createAIQAProvider } from './factory';
import { AIQAContextBuilder } from './context';
import { AIQASafetyValidator } from './validator';
import { AIQABudgetTracker } from './budget';
import { JourneyExecutor, Journey, JourneyResult, JourneyObservation } from '../journeys';
import { ApplicationMap, CancellationToken } from '../types';
import { BugObservation } from '../issues/types';
import { WorkerLogger } from '../logger';

export interface AIQAOrchestratorOptions {
  provider?: AIQAProvider;
  config?: AIQAConfig;
  logger?: WorkerLogger;
  allowLocalhost?: boolean;
}

export interface AIQAOrchestratorExecutionResult {
  plans: AIQAPlan[];
  results: AIQAResult[];
  executedJourneys: JourneyResult[];
  discoveredObservations: JourneyObservation[];
  issuesIdentified: AIQAIssueAssessment[];
  finalStopReason: AIQAStopReason;
  iterationsCount: number;
  finalState?: AIQAState;
  stateSummary?: AIQAStateSummary;
}

export class AIQAOrchestrator {
  private browser: Browser;
  private targetUrl: string;
  private scopeOrigin: string;
  private provider: AIQAProvider;
  private config: Required<AIQAConfig>;
  private logger?: WorkerLogger;
  private allowLocalhost: boolean;

  constructor(browser: Browser, targetUrl: string, options: AIQAOrchestratorOptions = {}) {
    this.browser = browser;
    this.targetUrl = targetUrl;
    try {
      this.scopeOrigin = new URL(targetUrl).origin;
    } catch {
      this.scopeOrigin = targetUrl;
    }

    this.config = {
      ...DEFAULT_AI_QA_CONFIG,
      ...(options.config || {}),
    };
    this.provider = options.provider || createAIQAProvider(this.config);
    this.logger = options.logger;
    this.allowLocalhost = options.allowLocalhost ?? false;
  }

  /**
   * Executes the bounded adaptive AI QA feedback loop.
   */
  async execute(
    testRunId: string,
    projectId: string,
    organizationId?: string,
    applicationMap?: ApplicationMap,
    initialJourneys: JourneyResult[] = [],
    initialIssues: BugObservation[] = [],
    cancellationToken?: CancellationToken
  ): Promise<AIQAOrchestratorExecutionResult> {
    const startTime = Date.now();
    this.logger?.log('ai_qa_orchestration_started', {
      provider: this.provider.metadata.name,
      model: this.provider.metadata.model,
      maxIterations: this.config.maxIterations,
    });

    const budgetTracker = new AIQABudgetTracker(this.config);
    const plans: AIQAPlan[] = [];
    const results: AIQAResult[] = [];
    const executedJourneys: JourneyResult[] = [];
    const discoveredObservations: JourneyObservation[] = [];
    const issuesIdentified: AIQAIssueAssessment[] = [];

    const previousPlans: AIQAPlanSummary[] = [];
    const previousResults: AIQAResultSummary[] = [];
    const accumulatedJourneys = [...initialJourneys];
    const accumulatedObservations: JourneyObservation[] = [];

    // Initialize Adaptive QA State
    let state = AIQAStateManager.initializeState({
      testRunId,
      targetUrl: this.targetUrl,
      applicationMap,
      initialIssues,
      initialJourneys,
      initialObservations: accumulatedObservations,
      budget: budgetTracker.getBudgetState(),
    });

    let finalStopReason: AIQAStopReason = 'GOAL_ACHIEVED';

    // Multi-iteration Bounded Adaptive AI QA Loop
    while (true) {
      // 1. Check Cancellation
      if (cancellationToken?.isCancelled) {
        finalStopReason = 'CANCELLED';
        state.terminationReason = 'CANCELLED';
        this.logger?.log('ai_qa_loop_cancelled');
        break;
      }

      // 2. Check Budget
      const budgetCheck = budgetTracker.canStartNextIteration();
      if (!budgetCheck.allowed) {
        finalStopReason = budgetCheck.reason || 'BUDGET_EXHAUSTED';
        state.terminationReason = finalStopReason;
        this.logger?.log('ai_qa_budget_exhausted', { reason: budgetCheck.message });
        break;
      }

      const iteration = budgetTracker.incrementIteration();
      const iterStartTime = Date.now();
      this.logger?.log('ai_qa_iteration_started', { iteration });

      // 3. Generate Compact State Summary & Build Sanitized Context
      const stateSummary = AIQAStateManager.generateCompactStateSummary(state);
      const context: AIQAContext = AIQAContextBuilder.build({
        testRunId,
        projectId,
        organizationId,
        targetUrl: this.targetUrl,
        applicationMap,
        existingIssues: initialIssues,
        previousJourneys: accumulatedJourneys,
        recentObservations: accumulatedObservations,
        previousPlans,
        previousResults,
        stateSummary,
        iteration,
        budget: budgetTracker.getBudgetState(),
      });

      // 4. Request Structured Plan from Provider
      budgetTracker.recordCall();
      let rawPlan: AIQAPlan;
      try {
        rawPlan = await this.provider.generatePlan(context, cancellationToken);
      } catch (providerErr: any) {
        this.logger?.error('ai_qa_provider_error', providerErr.message);
        finalStopReason = 'PROVIDER_FAILURE';
        state.terminationReason = 'PROVIDER_FAILURE';
        break;
      }

      if (cancellationToken?.isCancelled) {
        finalStopReason = 'CANCELLED';
        state.terminationReason = 'CANCELLED';
        break;
      }

      plans.push(rawPlan);

      // 5. Strict Safety Validation
      const validator = new AIQASafetyValidator({
        scopeOrigin: this.scopeOrigin,
        allowLocalhost: this.allowLocalhost,
        maxActionsPerJourney: this.config.maxActionsPerJourney,
      });

      const validationResult = validator.validatePlan(rawPlan);
      this.logger?.log('ai_qa_plan_validated', {
        approvedActions: validationResult.approvedActions.length,
        rejectedActions: validationResult.rejectedActions.length,
        validationErrors: validationResult.validationErrors,
      });

      // 6. Check Termination Conditions Prior to Browser Actuation
      const terminationCheck = AIQAStateManager.evaluateTerminationCondition(state, rawPlan, validationResult);
      if (terminationCheck.terminate || validationResult.approvedActions.length === 0) {
        const stopReason: AIQAStopReason = terminationCheck.reason || (
          validationResult.rejectedActions.length > 0 ? 'ALL_ACTIONS_REJECTED' : 'NO_FURTHER_ACTIONS'
        );

        const result: AIQAResult = {
          testRunId,
          projectId,
          iteration,
          planId: rawPlan.planId,
          provider: this.provider.metadata.name,
          model: this.provider.metadata.model,
          approvedActions: [],
          rejectedActions: validationResult.rejectedActions,
          discoveredObservations: [],
          evidenceIds: [],
          issuesIdentified: [],
          stopReason,
          durationMs: Date.now() - iterStartTime,
          createdAt: new Date().toISOString(),
        };

        results.push(result);
        finalStopReason = stopReason;
        state.terminationReason = stopReason;

        // Update state with rejected plan
        state = AIQAStateManager.updateAfterIteration(
          state,
          iteration,
          rawPlan,
          validationResult,
          undefined,
          [],
          [],
          budgetTracker.getBudgetState(),
          applicationMap
        );
        break;
      }

      // 7. Convert Approved Actions to Deterministic Journey
      const journey: Journey = {
        id: `ai-qa-journey-${iteration}-${rawPlan.planId}`,
        name: `AI QA Journey (Iter ${iteration})`,
        description: rawPlan.reasoningSummary,
        category: 'interaction',
        startUrl: validationResult.approvedActions[0]?.pageUrl || this.targetUrl,
        steps: validationResult.approvedActions.map((action, idx) => ({
          id: action.id || `step-${idx + 1}`,
          pageUrl: action.pageUrl,
          action: action.type,
          targetDescription: action.targetDescription,
          selector: action.selector,
          value: action.value,
          expected: action.expected,
          timeoutMs: action.timeoutMs || 10000,
        })),
      };

      // 8. Actuate Exclusively via Deterministic JourneyExecutor
      this.logger?.log('ai_qa_executing_journey', {
        journeyId: journey.id,
        stepsCount: journey.steps.length,
      });

      const journeyExecutor = new JourneyExecutor(this.browser, {
        allowLocalhost: this.allowLocalhost,
        cancellationToken,
        logger: this.logger,
      });

      const [journeyResult] = await journeyExecutor.executeJourneys([journey]);
      budgetTracker.recordActions(journeyResult.steps.length);
      executedJourneys.push(journeyResult);
      accumulatedJourneys.push(journeyResult);

      const iterObservations = journeyResult.observations || [];
      discoveredObservations.push(...iterObservations);
      accumulatedObservations.push(...iterObservations);

      // 9. Formulate Issue Intelligence (CONFIRMED vs SUSPECTED)
      const iterIssues: AIQAIssueAssessment[] = [];
      for (const step of journeyResult.steps) {
        if (step.status === 'FAILED') {
          iterIssues.push({
            type: 'UNKNOWN_FUNCTIONAL_FAILURE',
            title: `Step Failure: ${step.targetDescription}`,
            confidence: 'CONFIRMED',
            pageUrl: step.afterUrl || step.beforeUrl,
            selector: step.selector,
            details: step.error || 'Step execution encountered a fatal failure.',
            observationReference: step.observations[0]?.message,
          });
        }
      }

      for (const obs of iterObservations) {
        if (obs.severity === 'error' || obs.type === 'CLICK_NO_OP') {
          iterIssues.push({
            type: obs.type === 'CLICK_NO_OP' ? 'BROKEN_CONTROL' : 'RUNTIME_EXCEPTION',
            title: `Observed ${obs.type}: ${obs.message.substring(0, 80)}`,
            confidence: 'CONFIRMED',
            pageUrl: obs.pageUrl,
            selector: obs.selector,
            details: obs.message,
          });
        }
      }

      issuesIdentified.push(...iterIssues);

      // 10. Update Adaptive State
      state = AIQAStateManager.updateAfterIteration(
        state,
        iteration,
        rawPlan,
        validationResult,
        journeyResult,
        iterObservations,
        iterIssues,
        budgetTracker.getBudgetState(),
        applicationMap
      );

      // 11. Record Iteration Result
      const iterResult: AIQAResult = {
        testRunId,
        projectId,
        iteration,
        planId: rawPlan.planId,
        provider: this.provider.metadata.name,
        model: this.provider.metadata.model,
        approvedActions: validationResult.approvedActions,
        rejectedActions: validationResult.rejectedActions,
        executedJourney: journeyResult,
        discoveredObservations: iterObservations,
        evidenceIds: [],
        issuesIdentified: iterIssues,
        stopReason: 'GOAL_ACHIEVED',
        durationMs: Date.now() - iterStartTime,
        createdAt: new Date().toISOString(),
      };

      results.push(iterResult);

      // Update summaries for subsequent iterations
      previousPlans.push({
        planId: rawPlan.planId,
        iteration,
        reasoningSummary: rawPlan.reasoningSummary,
        priority: rawPlan.priority,
        actionsCount: rawPlan.actions.length,
        hypothesesCount: rawPlan.hypotheses.length,
      });

      previousResults.push({
        iteration,
        planId: rawPlan.planId,
        status: journeyResult.status,
        approvedActionsCount: validationResult.approvedActions.length,
        rejectedActionsCount: validationResult.rejectedActions.length,
        observationsCount: iterObservations.length,
      });

      // Check for critical defect threshold early stop
      const postIterTermination = AIQAStateManager.evaluateTerminationCondition(state, undefined, undefined);
      if (postIterTermination.terminate) {
        finalStopReason = postIterTermination.reason || 'GOAL_ACHIEVED';
        state.terminationReason = finalStopReason;
        break;
      }
    }

    this.logger?.log('ai_qa_orchestration_completed', {
      totalPlans: plans.length,
      totalResults: results.length,
      finalStopReason,
      durationMs: Date.now() - startTime,
    });

    const finalStateSummary = AIQAStateManager.generateCompactStateSummary(state);

    return {
      plans,
      results,
      executedJourneys,
      discoveredObservations,
      issuesIdentified,
      finalStopReason,
      iterationsCount: plans.length,
      finalState: state,
      stateSummary: finalStateSummary,
    };
  }
}
