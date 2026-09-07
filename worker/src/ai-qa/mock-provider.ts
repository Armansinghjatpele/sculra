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
