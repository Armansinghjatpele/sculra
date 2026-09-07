// ==============================================================================
// Sculra Adaptive AI QA State & Coverage Unit Tests (worker/tests/ai_qa_state.test.ts)
// ==============================================================================

import { describe, it, expect } from 'vitest';
import { AIQAStateManager } from '../src/ai-qa/state-manager';
import { AIQAState } from '../src/ai-qa/state';
import { ApplicationMap } from '../src/types';
import { AIQAPlan, AIQAValidationResult } from '../src/ai-qa/types';
import { JourneyResult } from '../src/journeys/types';

describe('AIQAStateManager', () => {
  const mockAppMap: ApplicationMap = {
    startUrl: 'http://127.0.0.1:3000',
    discoveredAt: new Date().toISOString(),
    totalPages: 3,
    totalLinks: 4,
    totalButtons: 5,
    totalForms: 2,
    totalInputs: 4,
    pages: [
      {
        url: 'http://127.0.0.1:3000',
        title: 'Home Page',
        depth: 0,
        elementsCount: 2,
        elements: [
          { type: 'button', role: 'button', text: 'Get Started', selector: '#get-started', isInteractive: true },
          { type: 'button', role: 'button', text: 'Learn More', selector: '#learn-more', isInteractive: true },
        ],
        forms: [],
        links: [
          { href: 'http://127.0.0.1:3000/pricing', text: 'Pricing', isInternal: true },
          { href: 'http://127.0.0.1:3000/signup', text: 'Sign Up', isInternal: true },
        ],
        consoleErrors: [],
        networkErrors: [],
        timestamp: new Date().toISOString(),
      },
      {
        url: 'http://127.0.0.1:3000/pricing',
        title: 'Pricing Page',
        depth: 1,
        elementsCount: 1,
        elements: [
          { type: 'button', role: 'button', text: 'Choose Pro', selector: '#pro-plan', isInteractive: true },
        ],
        forms: [],
        links: [
          { href: 'http://127.0.0.1:3000/signup', text: 'Sign Up', isInternal: true },
        ],
        consoleErrors: [],
        networkErrors: [],
        timestamp: new Date().toISOString(),
      },
      {
        url: 'http://127.0.0.1:3000/signup',
        title: 'Registration Page',
        depth: 1,
        elementsCount: 2,
        elements: [
          { type: 'button', role: 'button', text: 'Submit Registration', selector: '#submit-btn', isInteractive: true },
        ],
        forms: [
          {
            action: '/api/register',
            method: 'POST',
            fields: [
              { name: 'fullName', type: 'text', required: true, selector: 'input[name="fullName"]' },
              { name: 'email', type: 'email', required: true, selector: 'input[name="email"]' },
            ],
          },
        ],
        links: [],
        consoleErrors: [],
        networkErrors: [],
        timestamp: new Date().toISOString(),
      },
    ],
  };

  const initialBudget = {
    maxIterations: 3,
    currentIteration: 0,
    remainingIterations: 3,
    maxCalls: 5,
    callsMade: 0,
    maxTotalActions: 30,
    actionsExecuted: 0,
    maxAiTimeMs: 60000,
    elapsedTimeMs: 0,
    maxActionsPerJourney: 10,
  };

  it('initializes state correctly with deterministic coverage and uncovered targets', () => {
    const state = AIQAStateManager.initializeState({
      testRunId: 'test-run-123',
      targetUrl: 'http://127.0.0.1:3000',
      applicationMap: mockAppMap,
      budget: initialBudget,
    });

    expect(state.testRunId).toBe('test-run-123');
    expect(state.iteration).toBe(0);
    expect(state.coverageSummary.pages.discovered).toBe(3);
    expect(state.coverageSummary.pages.visited).toBe(0);
    expect(state.coverageSummary.forms.discovered).toBe(1);
    expect(state.coverageSummary.forms.exercised).toBe(0);
    expect(state.coverageSummary.buttons.discovered).toBe(4);
    expect(state.coverageSummary.buttons.exercised).toBe(0);

    expect(state.uncoveredAreas.unvisitedPages.length).toBe(3);
    expect(state.uncoveredAreas.unexercisedForms.length).toBe(1);
    expect(state.uncoveredAreas.unexercisedButtons.length).toBe(4);
  });

  it('generates compact state summary without historical token explosion', () => {
    const state = AIQAStateManager.initializeState({
      testRunId: 'test-run-123',
      targetUrl: 'http://127.0.0.1:3000',
      applicationMap: mockAppMap,
      budget: initialBudget,
    });

    const summary = AIQAStateManager.generateCompactStateSummary(state);
    expect(summary.iteration).toBe(0);
    expect(summary.coverage.pages.discovered).toBe(3);
    expect(summary.uncoveredHighValueTargets.length).toBeGreaterThan(0);
    expect(summary.remainingBudget.remainingIterations).toBe(3);
    expect(summary.remainingBudget.remainingActions).toBe(30);
  });

  it('updates state after an iteration and updates coverage and hypothesis outcomes', () => {
    let state = AIQAStateManager.initializeState({
      testRunId: 'test-run-123',
      targetUrl: 'http://127.0.0.1:3000',
      applicationMap: mockAppMap,
      budget: initialBudget,
    });

    const plan: AIQAPlan = {
      version: '1.0',
      planId: 'plan-1',
      iteration: 1,
      reasoningSummary: 'Test home page and CTA',
      priority: 'high',
      hypotheses: [
        {
          id: 'hyp-1',
          description: 'Home page button responds with valid transition',
          targetUrl: 'http://127.0.0.1:3000',
          confidence: 'high',
        },
      ],
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
          targetDescription: 'Click Get Started',
          pageUrl: 'http://127.0.0.1:3000',
          selector: '#get-started',
        },
      ],
      expectedOutcomes: [],
      stopConditions: [],
    };

    const validationResult: AIQAValidationResult = {
      approved: true,
      sanitizedPlan: plan,
      approvedActions: plan.actions,
      rejectedActions: [],
      validationErrors: [],
    };

    const journeyResult: JourneyResult = {
      journeyId: 'j-1',
      name: 'AI QA Journey (Iter 1)',
      category: 'interaction',
      status: 'PASSED',
      durationMs: 500,
      actionsAttempted: 2,
      actionsPassed: 2,
      actionsFailed: 0,
      actionsSkipped: 0,
      steps: [
        {
          stepIndex: 1,
          action: 'NAVIGATE',
          targetDescription: 'Navigate to Home',
          status: 'PASSED',
          beforeUrl: 'http://127.0.0.1:3000',
          afterUrl: 'http://127.0.0.1:3000',
          durationMs: 250,
          consoleErrors: [],
          networkErrors: [],
          observations: [],
        },
        {
          stepIndex: 2,
          action: 'CLICK',
          targetDescription: 'Click Get Started',
          status: 'PASSED',
          selector: '#get-started',
          beforeUrl: 'http://127.0.0.1:3000',
          afterUrl: 'http://127.0.0.1:3000/pricing',
          durationMs: 250,
          consoleErrors: [],
          networkErrors: [],
          observations: [],
        },
      ],
    };

    state = AIQAStateManager.updateAfterIteration(
      state,
      1,
      plan,
      validationResult,
      journeyResult,
      [],
      [],
      { ...initialBudget, currentIteration: 1, remainingIterations: 2, actionsExecuted: 2 },
      mockAppMap
    );

    expect(state.iteration).toBe(1);
    expect(state.coverageSummary.pages.visited).toBe(2); // visited home and navigated to pricing
    expect(state.coverageSummary.buttons.exercised).toBe(1);
    expect(state.coverageSummary.navigationPaths.exercised).toBe(1);

    const hyp = state.hypotheses.get('hyp-1');
    expect(hyp).toBeDefined();
    expect(hyp?.status).toBe('DISPROVEN'); // passed cleanly without failure
  });

  it('evaluates termination condition when model emits stop condition', () => {
    const state = AIQAStateManager.initializeState({
      testRunId: 'test-run-123',
      targetUrl: 'http://127.0.0.1:3000',
      applicationMap: mockAppMap,
      budget: initialBudget,
    });

    const plan: AIQAPlan = {
      version: '1.0',
      planId: 'plan-stop',
      iteration: 2,
      reasoningSummary: 'Completed testing',
      priority: 'low',
      hypotheses: [],
      actions: [],
      expectedOutcomes: [],
      stopConditions: [
        {
          type: 'NO_UNTESTED_HIGH_VALUE_PATHS',
          reason: 'All paths covered.',
        },
      ],
    };

    const term = AIQAStateManager.evaluateTerminationCondition(state, plan, undefined);
    expect(term.terminate).toBe(true);
    expect(term.reason).toBe('NO_UNTESTED_HIGH_VALUE_PATHS');
  });

  it('evaluates termination condition when all actions are rejected by safety validator', () => {
    const state = AIQAStateManager.initializeState({
      testRunId: 'test-run-123',
      targetUrl: 'http://127.0.0.1:3000',
      applicationMap: mockAppMap,
      budget: initialBudget,
    });

    const validationResult: AIQAValidationResult = {
      approved: false,
      sanitizedPlan: {} as any,
      approvedActions: [],
      rejectedActions: [
        {
          actionId: 'act-bad',
          actionType: 'CLICK',
          targetDescription: 'Delete DB',
          reason: 'Dangerous action',
          ruleViolated: 'DANGEROUS_ACTION',
        },
      ],
      validationErrors: ['Rejected dangerous action'],
    };

    const term = AIQAStateManager.evaluateTerminationCondition(state, undefined, validationResult);
    expect(term.terminate).toBe(true);
    expect(term.reason).toBe('ALL_ACTIONS_REJECTED');
  });
});
