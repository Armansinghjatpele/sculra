// ==============================================================================
// Sculra Autonomous Strategy Engine Unit Tests (worker/tests/strategy_engine.test.ts)
// ==============================================================================

import { describe, it, expect } from 'vitest';
import { AutonomousStrategyEngine } from '../src/strategy/engine';
import { ApplicationMap } from '../src/types';
import { MockAIQAProvider } from '../src/ai-qa/mock-provider';

describe('Autonomous Strategy Engine', () => {
  const createMockAppMap = (): ApplicationMap => ({
    startUrl: 'https://example.com/',
    discoveredAt: new Date().toISOString(),
    totalPages: 3,
    totalLinks: 2,
    totalButtons: 2,
    totalForms: 1,
    totalInputs: 2,
    pages: [
      {
        url: 'https://example.com/',
        title: 'Home',
        depth: 0,
        elementsCount: 2,
        elements: [],
        forms: [],
        links: [{ text: 'About', href: 'https://example.com/about', isInternal: true, sourcePage: 'https://example.com/' }],
        buttons: [{ selector: 'button#cta', text: 'Get Started', isPrimaryCta: true, sourcePage: 'https://example.com/' }],
        consoleErrors: [],
        networkErrors: [],
        timestamp: new Date().toISOString(),
      },
      {
        url: 'https://example.com/about',
        title: 'About Us',
        depth: 1,
        elementsCount: 1,
        elements: [],
        forms: [],
        links: [],
        buttons: [],
        consoleErrors: [],
        networkErrors: [],
        timestamp: new Date().toISOString(),
      },
      {
        url: 'https://example.com/contact',
        title: 'Contact Form',
        depth: 1,
        elementsCount: 3,
        elements: [],
        forms: [
          {
            action: '/api/contact',
            method: 'POST',
            fields: [
              { name: 'name', type: 'text', required: true, selector: 'input#name' },
              { name: 'email', type: 'email', required: true, selector: 'input#email' },
            ],
            sourcePage: 'https://example.com/contact',
          },
        ],
        links: [],
        buttons: [],
        consoleErrors: [],
        networkErrors: [],
        timestamp: new Date().toISOString(),
      },
    ],
  });

  it('initializes strategy engine with bounded budget and plans iteration 1', async () => {
    const provider = new MockAIQAProvider();
    const engine = new AutonomousStrategyEngine(
      'https://example.com/',
      { maxIterations: 3, maxTargets: 10 },
      provider
    );

    const appMap = createMockAppMap();
    const result = await engine.planIteration('test-run-1', appMap);

    expect(result.shouldStop).toBe(false);
    expect(result.decision.iteration).toBe(1);
    expect(result.decision.mode).toBeDefined();
    expect(result.selectedTargets.length).toBeGreaterThan(0);
    expect(result.decision.deterministicRankings.length).toBeGreaterThan(0);

    const budget = engine.getBudget();
    expect(budget.currentIteration).toBe(1);
    expect(budget.remainingIterations).toBe(2);
  });

  it('records target outcome and prevents immediate redundant re-selection', async () => {
    const engine = new AutonomousStrategyEngine('https://example.com/', { maxIterations: 3 });
    const appMap = createMockAppMap();

    const iter1 = await engine.planIteration('test-run-1', appMap);
    const selectedTarget = iter1.selectedTargets[0];
    expect(selectedTarget).toBeDefined();

    // Record PASSED outcome
    engine.recordTargetOutcome(selectedTarget.id, 'PASSED');

    // Plan Iteration 2
    const iter2 = await engine.planIteration('test-run-1', appMap);
    // Previously passed target should not be re-selected as top target
    expect(iter2.selectedTargets[0].id).not.toBe(selectedTarget.id);
  });

  it('applies cooldown to failed targets to prevent infinite tight loops', async () => {
    const engine = new AutonomousStrategyEngine('https://example.com/', { maxIterations: 3 });
    const appMap = createMockAppMap();

    const iter1 = await engine.planIteration('test-run-1', appMap);
    const failedTarget = iter1.selectedTargets[0];

    // Record FAILED outcome
    engine.recordTargetOutcome(failedTarget.id, 'FAILED');

    // Plan Iteration 2
    const iter2 = await engine.planIteration('test-run-1', appMap);
    // In iteration 2, the failed target is cooling down and should not be selected
    const selectedIds = iter2.selectedTargets.map((t) => t.id);
    expect(selectedIds).not.toContain(failedTarget.id);
  });

  it('terminates with STRATEGY_BUDGET_EXHAUSTED when max iterations is reached', async () => {
    const engine = new AutonomousStrategyEngine('https://example.com/', { maxIterations: 2, maxTargets: 5 });
    const appMap = createMockAppMap();

    await engine.planIteration('test-run-1', appMap);
    await engine.planIteration('test-run-1', appMap);

    // Iteration 3 exceeds maxIterations (2)
    const iter3 = await engine.planIteration('test-run-1', appMap);
    expect(iter3.shouldStop).toBe(true);
    expect(iter3.stopReason).toBe('STRATEGY_BUDGET_EXHAUSTED');
  });

  it('terminates cleanly upon user cancellation', async () => {
    const engine = new AutonomousStrategyEngine('https://example.com/', { maxIterations: 3 });
    const appMap = createMockAppMap();

    const result = await engine.planIteration(
      'test-run-1',
      appMap,
      undefined,
      [],
      [],
      [],
      [],
      ['desktop'],
      { isCancelled: true }
    );

    expect(result.shouldStop).toBe(true);
    expect(result.stopReason).toBe('CANCELLED');
  });
});
