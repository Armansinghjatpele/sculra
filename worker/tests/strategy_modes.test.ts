// ==============================================================================
// Sculra Strategy Modes Evaluator Unit Tests (worker/tests/strategy_modes.test.ts)
// ==============================================================================

import { describe, it, expect } from 'vitest';
import { StrategyModeEvaluator } from '../src/strategy/modes';
import { BugObservation } from '../issues/types';
import { AIQAState } from '../ai-qa/state';

describe('Strategy Mode Evaluator', () => {
  it('selects FAILURE_DRIVEN mode when critical or high severity bugs are present', () => {
    const criticalBug: BugObservation = {
      fingerprint: 'fp-1',
      type: 'BROKEN_CONTROL',
      severity: 'critical',
      title: 'Checkout button crashes page',
      url: 'https://example.com/cart',
      selector: 'button#checkout',
      confidence: 'CONFIRMED',
      timestamp: new Date().toISOString(),
    };

    const result = StrategyModeEvaluator.evaluateMode({
      bugObservations: [criticalBug],
      iteration: 1,
    });

    expect(result.mode).toBe('FAILURE_DRIVEN');
    expect(result.contributingFactors.some((f) => f.includes('critical/high severity bug'))).toBe(true);
  });

  it('selects FAILURE_DRIVEN mode when HTTP 500 server errors are detected', () => {
    const result = StrategyModeEvaluator.evaluateMode({
      networkErrors: [{ url: 'https://example.com/api/submit', status: 500 }],
      iteration: 1,
    });

    expect(result.mode).toBe('FAILURE_DRIVEN');
    expect(result.contributingFactors.some((f) => f.includes('HTTP 5xx server error'))).toBe(true);
  });

  it('selects FAILURE_DRIVEN mode when unhandled runtime console exceptions exist', () => {
    const result = StrategyModeEvaluator.evaluateMode({
      consoleErrors: [{ message: 'Uncaught TypeError: Cannot read properties of undefined', url: 'https://example.com/dashboard' }],
      iteration: 1,
    });

    expect(result.mode).toBe('FAILURE_DRIVEN');
    expect(result.contributingFactors.some((f) => f.includes('runtime exceptions'))).toBe(true);
  });

  it('selects DEPTH_FIRST mode when active hypotheses require experimental verification', () => {
    const mockState: Partial<AIQAState> = {
      hypotheses: new Map([
        [
          'hyp-1',
          {
            id: 'hyp-1',
            description: 'Form submission with empty required fields causes silent failure',
            targetUrl: 'https://example.com/form',
            priority: 'high',
            status: 'TESTING',
            confidence: 'high',
            iterationFormulated: 1,
          },
        ],
      ]),
      testedPages: new Map([['https://example.com', { url: 'https://example.com', firstTestedIteration: 1, lastTestedIteration: 1, timesTested: 1, status: 'PASSED' }]]),
      testedForms: [],
      testedInteractions: [],
      testedNavigationPaths: [],
      testedViewports: ['desktop'],
      discoveredIssues: [],
      confirmedIssues: [],
      suspectedIssues: [],
      failedJourneys: [],
      highRiskAreas: new Map(),
      coverageSummary: {
        pages: { discovered: 3, visited: 1 },
        forms: { discovered: 1, exercised: 0 },
        buttons: { discovered: 4, exercised: 0 },
        links: { discovered: 5, exercised: 0 },
        navigationPaths: { discovered: 3, exercised: 0 },
        hypotheses: { formulated: 1, tested: 1, confirmed: 0, disproven: 0, inconclusive: 0 },
      },
    };

    const result = StrategyModeEvaluator.evaluateMode({
      state: mockState as AIQAState,
      iteration: 2,
    });

    expect(result.mode).toBe('DEPTH_FIRST');
    expect(result.contributingFactors.some((f) => f.includes('active hypothesis'))).toBe(true);
  });

  it('selects RELEASE_GAP mode when responsive viewports (mobile/tablet) are untested after initial iteration', () => {
    const mockState: Partial<AIQAState> = {
      hypotheses: new Map(),
      testedPages: new Map([
        ['https://example.com', { url: 'https://example.com', firstTestedIteration: 1, lastTestedIteration: 1, timesTested: 1, status: 'PASSED' }],
      ]),
      testedForms: [],
      testedInteractions: [],
      testedNavigationPaths: [],
      testedViewports: ['desktop'],
      discoveredIssues: [],
      confirmedIssues: [],
      suspectedIssues: [],
      failedJourneys: [],
      highRiskAreas: new Map(),
      coverageSummary: {
        pages: { discovered: 2, visited: 1 },
        forms: { discovered: 0, exercised: 0 },
        buttons: { discovered: 2, exercised: 0 },
        links: { discovered: 2, exercised: 0 },
        navigationPaths: { discovered: 1, exercised: 0 },
        hypotheses: { formulated: 0, tested: 0, confirmed: 0, disproven: 0, inconclusive: 0 },
      },
    };

    const result = StrategyModeEvaluator.evaluateMode({
      state: mockState as AIQAState,
      testedViewports: ['desktop'], // Missing mobile and tablet
      iteration: 2,
    });

    expect(result.mode).toBe('RELEASE_GAP');
    expect(result.contributingFactors.some((f) => f.includes('responsive viewports'))).toBe(true);
  });

  it('selects REGRESSION_FOCUSED mode when historical issues exist on iteration >= 3', () => {
    const mockState: Partial<AIQAState> = {
      hypotheses: new Map(),
      testedPages: new Map([
        ['https://example.com', { url: 'https://example.com', firstTestedIteration: 1, lastTestedIteration: 1, timesTested: 1, status: 'PASSED' }],
        ['https://example.com/second', { url: 'https://example.com/second', firstTestedIteration: 2, lastTestedIteration: 2, timesTested: 1, status: 'PASSED' }],
      ]),
      testedForms: [],
      testedInteractions: [],
      testedNavigationPaths: [],
      testedViewports: ['desktop', 'mobile', 'tablet'],
      discoveredIssues: [],
      confirmedIssues: [],
      suspectedIssues: [],
      failedJourneys: [],
      highRiskAreas: new Map(),
      coverageSummary: {
        pages: { discovered: 2, visited: 2 },
        forms: { discovered: 0, exercised: 0 },
        buttons: { discovered: 2, exercised: 2 },
        links: { discovered: 2, exercised: 2 },
        navigationPaths: { discovered: 1, exercised: 1 },
        hypotheses: { formulated: 0, tested: 0, confirmed: 0, disproven: 0, inconclusive: 0 },
      },
    };

    const result = StrategyModeEvaluator.evaluateMode({
      state: mockState as AIQAState,
      testedViewports: ['desktop', 'mobile', 'tablet'],
      historicalIssuesCount: 2,
      iteration: 3,
    });

    expect(result.mode).toBe('REGRESSION_FOCUSED');
    expect(result.contributingFactors.some((f) => f.includes('historical issue(s)'))).toBe(true);
  });

  it('defaults to BREADTH_FIRST mode for initial exploration', () => {
    const result = StrategyModeEvaluator.evaluateMode({
      iteration: 1,
    });

    expect(result.mode).toBe('BREADTH_FIRST');
    expect(result.reason.includes('breadth-first')).toBe(true);
  });
});
