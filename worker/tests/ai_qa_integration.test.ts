// ==============================================================================
// Sculra AI QA Integration Test Suite (worker/tests/ai_qa_integration.test.ts)
// ==============================================================================

import { describe, it, expect } from 'vitest';
import {
  AIQAContextBuilder,
  MockAIQAProvider,
  AIQASafetyValidator,
  AIQABudgetTracker,
  AIQAPlan,
} from '../src/ai-qa';
import { ApplicationMap } from '../src/types';
import { JourneyResult, JourneyObservation } from '../journeys/types';

describe('Sculra AI QA Orchestration Integration Tests', () => {
  const mockTargetUrl = 'http://127.0.0.1:3000';
  const mockScopeOrigin = 'http://127.0.0.1:3000';

  const mockAppMap: ApplicationMap = {
    startUrl: mockTargetUrl,
    discoveredAt: new Date().toISOString(),
    totalPages: 3,
    totalLinks: 3,
    totalButtons: 3,
    totalForms: 1,
    totalInputs: 2,
    pages: [
      {
        url: 'http://127.0.0.1:3000',
        title: 'Home Page',
        depth: 0,
        elementsCount: 2,
        elements: [
          {
            type: 'button',
            text: 'Explore Features',
            tagName: 'button',
            selector: '#explore-btn',
            sourcePage: 'http://127.0.0.1:3000',
          },
        ],
        forms: [],
        links: [
          {
            text: 'Features',
            href: 'http://127.0.0.1:3000/features',
            isInternal: true,
            sourcePage: 'http://127.0.0.1:3000',
          },
        ],
        consoleErrors: [],
        networkErrors: [],
        timestamp: new Date().toISOString(),
      },
      {
        url: 'http://127.0.0.1:3000/features',
        title: 'Features List',
        depth: 1,
        elementsCount: 2,
        elements: [],
        forms: [
          {
            method: 'POST',
            fields: [
              {
                name: 'search',
                type: 'search',
                label: 'Search Features',
                required: false,
                selector: 'input#search',
              },
            ],
            sourcePage: 'http://127.0.0.1:3000/features',
          },
        ],
        links: [],
        consoleErrors: [],
        networkErrors: [],
        timestamp: new Date().toISOString(),
      },
    ],
  };

  it('validates plan, rejects dangerous actions, and sanitizes plan for journey conversion', async () => {
    const tracker = new AIQABudgetTracker();
    const context = AIQAContextBuilder.build({
      testRunId: 'test-run-int-1',
      projectId: 'proj-1',
      targetUrl: mockTargetUrl,
      applicationMap: mockAppMap,
      iteration: 1,
      budget: tracker.getBudgetState(),
    });

    const validator = new AIQASafetyValidator({
      scopeOrigin: mockScopeOrigin,
      allowLocalhost: true,
    });

    // Custom mixed plan containing safe and unsafe actions
    const mixedPlan: AIQAPlan = {
      version: '1.0',
      planId: 'plan-mixed-1',
      iteration: 1,
      reasoningSummary: 'Test mixed safe and unsafe actions',
      priority: 'high',
      hypotheses: [],
      actions: [
        {
          id: 'act-1',
          type: 'NAVIGATE',
          targetDescription: 'Navigate to Home',
          pageUrl: 'http://127.0.0.1:3000',
        },
        {
          id: 'act-2',
          type: 'CLICK',
          targetDescription: 'Click Delete All Data button',
          pageUrl: 'http://127.0.0.1:3000',
          selector: 'button#delete-all',
        },
        {
          id: 'act-3',
          type: 'CLICK',
          targetDescription: 'Click Explore Features',
          pageUrl: 'http://127.0.0.1:3000',
          selector: '#explore-btn',
        },
      ],
      expectedOutcomes: [],
      stopConditions: [],
    };

    const valResult = validator.validatePlan(mixedPlan);

    expect(valResult.approved).toBe(true);
    expect(valResult.approvedActions.length).toBe(2);
    expect(valResult.rejectedActions.length).toBe(1);
    expect(valResult.rejectedActions[0].ruleViolated).toBe('DANGEROUS_ACTION');
    expect(valResult.sanitizedPlan.actions.length).toBe(2);
  });

  it('feeds observations from previous iteration into next iteration context', async () => {
    const tracker = new AIQABudgetTracker();

    const previousObs: JourneyObservation[] = [
      {
        type: 'CLICK_NO_OP',
        message: 'Click on button#explore-btn produced no navigation or state change',
        severity: 'warning',
        pageUrl: 'http://127.0.0.1:3000',
        selector: '#explore-btn',
        timestamp: new Date().toISOString(),
      },
    ];

    const previousJourney: JourneyResult = {
      journeyId: 'j-iter-1',
      name: 'AI QA Journey (Iter 1)',
      category: 'interaction',
      status: 'PASSED',
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs: 450,
      viewport: { width: 1280, height: 720, name: 'desktop' },
      steps: [],
      observations: previousObs,
      pagesVisited: ['http://127.0.0.1:3000'],
      actionsAttempted: 2,
      actionsPassed: 2,
      actionsFailed: 0,
      actionsSkipped: 0,
    };

    const context = AIQAContextBuilder.build({
      testRunId: 'test-run-int-2',
      projectId: 'proj-1',
      targetUrl: mockTargetUrl,
      applicationMap: mockAppMap,
      previousJourneys: [previousJourney],
      recentObservations: previousObs,
      iteration: 2,
      budget: tracker.getBudgetState(),
    });

    expect(context.iteration).toBe(2);
    expect(context.recentObservations.length).toBe(1);
    expect(context.recentObservations[0].type).toBe('CLICK_NO_OP');
    expect(context.previousJourneys.length).toBe(1);
    expect(context.previousJourneys[0].observationsCount).toBe(1);
  });
});
