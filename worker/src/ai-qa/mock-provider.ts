// ==============================================================================
// Sculra Deterministic Mock AI QA Provider (worker/src/ai-qa/mock-provider.ts)
// ==============================================================================
// Deterministic mock provider for verifying AI QA orchestration pipelines,
// safety policies, and multi-iteration feedback loops without external LLM calls.

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

    // Collect URLs already tested in previous plans
    const plannedUrls = new Set<string>();
    for (const prevPlan of context.previousPlans) {
      // track that this iteration is subsequent
    }

    // 1. Look for undiscovered or unvisited pages
    const visitedUrls = new Set<string>();
    for (const j of context.previousJourneys) {
      // In a real test, journey results track pages visited
    }

    // Find candidate page to explore
    const candidatePage = context.discoveredPages[iteration - 1] || context.discoveredPages[0];

    // If no discovered pages exist or iteration is beyond discovered pages and has previous results:
    if (!candidatePage || iteration > Math.max(context.discoveredPages.length, 2)) {
      return {
        version: '1.0',
        planId,
        iteration,
        reasoningSummary: 'All discovered application routes and safe controls have been systematically tested.',
        priority: 'low',
        hypotheses: [],
        actions: [],
        expectedOutcomes: [],
        stopConditions: [
          {
            type: 'NO_USEFUL_ACTIONS',
            reason: 'Exploration coverage goal achieved across all discovered routes.',
          },
        ],
      };
    }

    const actions: AIQAAction[] = [];
    const hypotheses: AIQAHypothesis[] = [];
    const expectedOutcomes: AIQAExpectation[] = [];
    const stopConditions: AIQAStopCondition[] = [];

    // Action 1: Navigate to candidate page
    actions.push({
      id: `act-${iteration}-1`,
      type: 'NAVIGATE',
      targetDescription: `Navigate to page: ${candidatePage.url}`,
      pageUrl: candidatePage.url,
      expected: {
        url: candidatePage.url,
        title: candidatePage.title,
      },
    });

    // Action 2: Assert main container or title is visible
    actions.push({
      id: `act-${iteration}-2`,
      type: 'ASSERT_VISIBLE',
      targetDescription: `Verify body/main content is rendered on ${candidatePage.url}`,
      pageUrl: candidatePage.url,
      selector: 'body',
    });

    hypotheses.push({
      id: `hyp-${iteration}-1`,
      description: `Verifying route ${candidatePage.url} responds cleanly without unhandled runtime exceptions.`,
      targetUrl: candidatePage.url,
      confidence: 'high',
    });

    expectedOutcomes.push({
      id: `exp-${iteration}-1`,
      description: `Page ${candidatePage.url} loads with status 200 and renders interactive DOM tree.`,
      pageUrl: candidatePage.url,
    });

    // Action 3: If candidate page has forms, fill non-sensitive inputs with safe values
    if (candidatePage.sampleForms && candidatePage.sampleForms.length > 0) {
      const form = candidatePage.sampleForms[0];
      let fieldIndex = 0;
      for (const field of form.fields.slice(0, 3)) {
        fieldIndex++;
        const safeValue = getDeterministicFieldValue(field);
        actions.push({
          id: `act-${iteration}-${2 + fieldIndex}`,
          type: 'FILL',
          targetDescription: `Fill field [${field.name || field.type}] with safe test value`,
          pageUrl: candidatePage.url,
          selector: field.selector,
          value: safeValue,
        });
      }
    } else if (candidatePage.sampleElements && candidatePage.sampleElements.length > 0) {
      // Action 3 alt: Click a safe interactive element if available
      const safeElement = candidatePage.sampleElements.find(
        (el) => el.type === 'button' || el.isPrimaryCta
      );
      if (safeElement) {
        actions.push({
          id: `act-${iteration}-3`,
          type: 'CLICK',
          targetDescription: `Click safe interactive element: ${safeElement.text || safeElement.selector}`,
          pageUrl: candidatePage.url,
          selector: safeElement.selector,
        });
      }
    }

    return {
      version: '1.0',
      planId,
      iteration,
      reasoningSummary: `Plan iteration ${iteration}: Target and validate route "${candidatePage.url}" (${candidatePage.sampleElements.length} elements, ${candidatePage.sampleForms.length} forms).`,
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
