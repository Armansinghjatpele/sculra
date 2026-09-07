// ==============================================================================
// Sculra Deterministic Adaptive Mock AI QA Provider (worker/src/ai-qa/mock-provider.ts)
// ==============================================================================
// Deterministic adaptive mock provider for verifying AI QA orchestration pipelines,
// safety policies, coverage-driven target selection, and multi-iteration feedback loops.

import { AIQAProvider } from './provider';
import {
  AIQAContext,
  AIQAPlan,
  AIQAAction,
  AIQAHypothesis,
  AIQAExpectation,
  AIQAStopCondition,
  AIQAProviderMetadata,
} from './types';
import { CancellationToken } from '../types';
import { getDeterministicFieldValue } from '../journeys/safety';

export class MockAIQAProvider implements AIQAProvider {
  readonly metadata: AIQAProviderMetadata = {
    name: 'mock-deterministic',
    model: 'deterministic-engine-v1',
    isDeterministicMock: true,
  };

  async generatePlan(
    context: AIQAContext,
    cancellationToken?: CancellationToken
  ): Promise<AIQAPlan> {
    if (cancellationToken?.isCancelled) {
      return this.createCancelledPlan(context);
    }

    const iteration = context.iteration;
    const planId = `ai-plan-iter-${iteration}-${Date.now()}`;
    const stateSummary = context.stateSummary;

    // 1. Adaptive Case: Failure-driven exploration
    // If the immediate previous iteration had failures, prioritize investigating the failed target
    if (stateSummary && stateSummary.recentFailures && stateSummary.recentFailures.length > 0) {
      const lastFailure = stateSummary.recentFailures[stateSummary.recentFailures.length - 1];
      const targetUrl = lastFailure.pageUrl.startsWith('http') ? lastFailure.pageUrl : context.targetUrl;

      return {
        version: '1.0',
        planId,
        iteration,
        reasoningSummary: `Adaptive Investigation (Iter ${iteration}): Follow-up investigation for previous failure on "${targetUrl}" (${lastFailure.error}).`,
        priority: 'high',
        hypotheses: [
          {
            id: `hyp-${iteration}-investigate`,
            description: `Investigating whether ${targetUrl} reproduces runtime failure under alternative validation.`,
            targetUrl,
            suspectedBugType: 'NAVIGATION_FAILURE',
            supportingEvidence: `Previous failure: ${lastFailure.error}`,
            confidence: 'high',
          },
        ],
        actions: [
          {
            id: `act-${iteration}-1`,
            type: 'NAVIGATE',
            targetDescription: `Re-navigate to investigate route: ${targetUrl}`,
            pageUrl: targetUrl,
            expected: {
              url: targetUrl,
            },
          },
          {
            id: `act-${iteration}-2`,
            type: 'ASSERT_VISIBLE',
            targetDescription: `Verify container visibility on ${targetUrl}`,
            pageUrl: targetUrl,
            selector: 'body',
          },
        ],
        expectedOutcomes: [
          {
            id: `exp-${iteration}-1`,
            description: `Route ${targetUrl} state is confirmed deterministically.`,
            pageUrl: targetUrl,
          },
        ],
        stopConditions: [],
      };
    }

    // 2. Adaptive Case: Uncovered High-Value Target Selection
    // If uncovered high-value targets are available, choose the top uncovered target
    let targetPage = context.discoveredPages[iteration - 1] || context.discoveredPages[0];
    let candidateDescription = '';

    if (stateSummary && stateSummary.uncoveredHighValueTargets && stateSummary.uncoveredHighValueTargets.length > 0) {
      const topTarget = stateSummary.uncoveredHighValueTargets[0];
      const matchingPage = context.discoveredPages.find((p) => p.url === topTarget.pageUrl);
      if (matchingPage) {
        targetPage = matchingPage;
        candidateDescription = topTarget.description;
      }
    }

    // 3. Termination Check: All high-value routes tested or beyond available targets
    if (!targetPage || (iteration > Math.max(context.discoveredPages.length, 2) && (!stateSummary?.uncoveredHighValueTargets?.length))) {
      return {
        version: '1.0',
        planId,
        iteration,
        reasoningSummary: 'Exploration complete: All discovered application routes and safe controls have been systematically tested.',
        priority: 'low',
        hypotheses: [],
        actions: [],
        expectedOutcomes: [],
        stopConditions: [
          {
            type: 'NO_USEFUL_ACTIONS',
            reason: 'Exploration coverage goal achieved across all discovered routes and controls.',
          },
        ],
      };
    }

    const actions: AIQAAction[] = [];
    const hypotheses: AIQAHypothesis[] = [];
    const expectedOutcomes: AIQAExpectation[] = [];
    const stopConditions: AIQAStopCondition[] = [];

    // Action 1: Navigate to target page
    actions.push({
      id: `act-${iteration}-1`,
      type: 'NAVIGATE',
      targetDescription: `Navigate to target: ${targetPage.url}`,
      pageUrl: targetPage.url,
      expected: {
        url: targetPage.url,
        title: targetPage.title,
      },
    });

    // Action 2: Assert main container rendered
    actions.push({
      id: `act-${iteration}-2`,
      type: 'ASSERT_VISIBLE',
      targetDescription: `Verify body DOM rendered on ${targetPage.url}`,
      pageUrl: targetPage.url,
      selector: 'body',
    });

    hypotheses.push({
      id: `hyp-${iteration}-1`,
      description: `Verifying route ${targetPage.url} responds cleanly without unhandled runtime exceptions or broken controls.`,
      targetUrl: targetPage.url,
      supportingEvidence: candidateDescription || `Discovered page with ${targetPage.sampleElements.length} elements`,
      confidence: 'high',
    });

    expectedOutcomes.push({
      id: `exp-${iteration}-1`,
      description: `Page ${targetPage.url} loads with status 200 and renders interactive DOM tree.`,
      pageUrl: targetPage.url,
    });

    // Action 3: Form usability or primary button click
    if (targetPage.sampleForms && targetPage.sampleForms.length > 0) {
      const form = targetPage.sampleForms[0];
      let fieldIndex = 0;
      for (const field of form.fields.slice(0, 3)) {
        fieldIndex++;
        const safeValue = getDeterministicFieldValue(field);
        actions.push({
          id: `act-${iteration}-${2 + fieldIndex}`,
          type: 'FILL',
          targetDescription: `Fill field [${field.name || field.type}] with safe test value`,
          pageUrl: targetPage.url,
          selector: field.selector,
          value: safeValue,
        });
      }
    } else if (targetPage.sampleElements && targetPage.sampleElements.length > 0) {
      const safeElement = targetPage.sampleElements.find(
        (el) => el.type === 'button' || el.isPrimaryCta
      );
      if (safeElement) {
        actions.push({
          id: `act-${iteration}-3`,
          type: 'CLICK',
          targetDescription: `Click safe interactive element: ${safeElement.text || safeElement.selector}`,
          pageUrl: targetPage.url,
          selector: safeElement.selector,
        });
      }
    }

    return {
      version: '1.0',
      planId,
      iteration,
      reasoningSummary: `Plan iteration ${iteration}: Target and validate route "${targetPage.url}" (${targetPage.sampleElements.length} elements, ${targetPage.sampleForms.length} forms). ${candidateDescription ? `Focus: ${candidateDescription}` : ''}`,
      priority: iteration === 1 ? 'high' : 'medium',
      hypotheses,
      actions,
      expectedOutcomes,
      stopConditions,
    };
  }

  async analyzeRelease(
    context: import('../release/analyzer').ReleaseAnalysisContext,
    cancellationToken?: CancellationToken
  ): Promise<import('../release/types').AIReleaseAnalysis> {
    const isReady = context.overallScore >= 85 && context.blockers.length === 0;
    const isCaution = context.overallScore >= 70 && context.blockers.filter((b) => b.severity === 'critical').length === 0;

    const keyRisks: string[] = [];
    for (const b of context.blockers) {
      keyRisks.push(`[${b.severity.toUpperCase()}] ${b.title}: ${b.reason}`);
    }
    for (const iss of context.topIssues) {
      if (iss.severity === 'high' || iss.severity === 'critical') {
        keyRisks.push(`[${iss.severity.toUpperCase()}] ${iss.title}`);
      }
    }

    const strengths: string[] = [];
    if (context.categoryScores.functional >= 90) strengths.push('Core functional test journeys and API interactions passed reliably.');
    if (context.categoryScores.visual >= 90) strengths.push('Visual presentation maintained high alignment across tested views.');
    if (context.categoryScores.responsive >= 90) strengths.push('Multi-viewport responsive scaling exhibited zero horizontal clipping.');
    if (context.categoryScores.coverage >= 80) strengths.push('Broad structural coverage achieved across discovered pages and interactive controls.');

    const evidenceGaps: string[] = [];
    if (context.coverageSummary.pagesVisited < context.coverageSummary.pagesDiscovered) {
      evidenceGaps.push(`${context.coverageSummary.pagesDiscovered - context.coverageSummary.pagesVisited} discovered page(s) were not visited during testing.`);
    }

    const recommendedActions: string[] = [];
    if (context.blockers.length > 0) {
      recommendedActions.push(`Resolve ${context.blockers.length} active release blocker(s) prior to production deployment.`);
    }
    if (keyRisks.length > 0) {
      recommendedActions.push('Perform targeted QA verification on routes exhibiting responsive overflow or step failures.');
    }
    recommendedActions.push('Establish automated regression test runs in CI/CD pipeline.');

    let releaseExplanation = '';
    if (context.confidenceLevel === 'INSUFFICIENT') {
      releaseExplanation = 'Insufficient test evidence captured to provide an authoritative release endorsement.';
    } else if (isReady) {
      releaseExplanation = `Application achieved a high stability score (${context.overallScore}/100) with zero active blockers and strong multi-viewport health.`;
    } else if (isCaution) {
      releaseExplanation = `Application scored ${context.overallScore}/100 with moderate non-critical risks. Deployment permitted with stakeholder review.`;
    } else {
      releaseExplanation = `Application scored ${context.overallScore}/100 and possesses ${context.blockers.length} active release blocker(s). Production release is NOT recommended.`;
    }

    return {
      summary: `Release readiness evaluated at ${context.overallScore}/100 (${context.recommendation.replace(/_/g, ' ')}).`,
      keyRisks: keyRisks.length > 0 ? keyRisks : ['No severe blockers identified in tested workflows.'],
      strengths: strengths.length > 0 ? strengths : ['Basic page navigation established successfully.'],
      evidenceGaps: evidenceGaps.length > 0 ? evidenceGaps : ['All discovered routes and viewports evaluated.'],
      recommendedActions,
      releaseExplanation,
      confidence: context.confidenceLevel === 'HIGH' ? 'high' : context.confidenceLevel === 'MEDIUM' ? 'medium' : 'low',
    };
  }

  async analyzeTestStrategy(
    context: import('../strategy/types').StrategyAnalysisContext,
    cancellationToken?: CancellationToken
  ): Promise<import('../strategy/types').AIStrategyRecommendation> {
    if (cancellationToken?.isCancelled) {
      return {
        recommendedMode: context.currentMode,
        selectedTargetIds: [],
        investigationHypotheses: [],
        strategyRationale: 'Execution cancelled prior to strategy analysis.',
        recommendedFocus: 'BREADTH',
        suggestedStop: true,
        stopReason: 'Cancelled',
      };
    }

    const mode = context.currentMode;
    const candidates = context.candidates || [];
    const selectedTargetIds = candidates.slice(0, 3).map((c) => c.id);

    const hypotheses: import('../strategy/types').AIStrategyHypothesis[] = [];
    if (mode === 'FAILURE_DRIVEN') {
      const topFail = candidates.find((c) => c.targetType === 'PREVIOUS_FAILURE');
      if (topFail) {
        hypotheses.push({
          id: `hyp-strat-${context.iteration}-failure`,
          description: `Investigating whether ${topFail.pageUrl} failure reproduces upon re-test.`,
          targetUrl: topFail.pageUrl,
          confidence: 'high',
          supportingEvidence: topFail.reasons[0] || 'Prior defect detected on route',
        });
      }
    } else if (mode === 'DEPTH_FIRST') {
      const topForm = candidates.find((c) => c.targetType === 'FORM' || c.targetType === 'SUSPECTED_ISSUE');
      if (topForm) {
        hypotheses.push({
          id: `hyp-strat-${context.iteration}-form`,
          description: `Evaluating input boundary constraints on ${topForm.pageUrl}.`,
          targetUrl: topForm.pageUrl,
          confidence: 'medium',
          supportingEvidence: 'Discovered interactive form requires boundary validation',
        });
      }
    }

    return {
      recommendedMode: mode,
      selectedTargetIds,
      investigationHypotheses: hypotheses,
      strategyRationale: `Deterministic Mock Strategy (Iter ${context.iteration}): Prioritized top ${selectedTargetIds.length} candidate(s) under ${mode} mode.`,
      recommendedFocus: mode === 'FAILURE_DRIVEN' ? 'FAILURE_INVESTIGATION' : mode === 'DEPTH_FIRST' ? 'DEPTH' : 'BREADTH',
      suggestedStop: candidates.length === 0,
      stopReason: candidates.length === 0 ? 'All viable candidate targets evaluated.' : undefined,
    };
  }

  private createCancelledPlan(context: AIQAContext): AIQAPlan {
    return {
      version: '1.0',
      planId: `ai-plan-cancelled-${Date.now()}`,
      iteration: context.iteration,
      reasoningSummary: 'Execution cancelled prior to plan generation.',
      priority: 'low',
      hypotheses: [],
      actions: [],
      expectedOutcomes: [],
      stopConditions: [
        {
          type: 'BUDGET_LIMIT',
          reason: 'Test run was cancelled by user.',
        },
      ],
    };
  }
}
