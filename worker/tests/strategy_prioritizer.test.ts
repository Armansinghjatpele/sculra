// ==============================================================================
// Sculra Deterministic Strategy Prioritizer Unit Tests (worker/tests/strategy_prioritizer.test.ts)
// ==============================================================================

import { describe, it, expect } from 'vitest';
import { DeterministicPrioritizer } from '../src/strategy/prioritizer';
import { TestTarget } from '../src/strategy/types';

describe('Deterministic Strategy Prioritizer', () => {
  const createMockTarget = (overrides: Partial<TestTarget>): TestTarget => ({
    id: 'target-1',
    targetType: 'PAGE',
    pageUrl: 'https://example.com/page1',
    priorityScore: 50,
    priorityLevel: 'medium',
    riskLevel: 'low',
    coverageValue: 50,
    reasons: [],
    dependencies: [],
    source: 'DISCOVERY',
    status: 'PENDING',
    estimatedCost: 1,
    evidenceCount: 0,
    attemptsCount: 0,
    ...overrides,
  });

  it('ranks unvisited pages higher than already executed pages in BREADTH_FIRST mode', () => {
    const unvisitedPage = createMockTarget({
      id: 'target-page-unvisited',
      targetType: 'PAGE',
      pageUrl: 'https://example.com/unvisited',
      status: 'PENDING',
    });

    const visitedPage = createMockTarget({
      id: 'target-page-visited',
      targetType: 'PAGE',
      pageUrl: 'https://example.com/visited',
      status: 'EXECUTED',
    });

    const { rankedTargets } = DeterministicPrioritizer.prioritize([visitedPage, unvisitedPage], {
      mode: 'BREADTH_FIRST',
      completedTargetIds: new Set(['target-page-visited']),
    });

    expect(rankedTargets[0].id).toBe('target-page-unvisited');
    expect(rankedTargets[0].priorityScore).toBeGreaterThan(rankedTargets[1].priorityScore);
    expect(rankedTargets[0].reasons.some((r) => r.includes('Unvisited route breadth coverage'))).toBe(true);
  });

  it('substantially boosts failure investigation targets in FAILURE_DRIVEN mode', () => {
    const regularPage = createMockTarget({
      id: 'target-page-about',
      targetType: 'PAGE',
      pageUrl: 'https://example.com/about',
    });

    const failureTarget = createMockTarget({
      id: 'target-fail-500',
      targetType: 'PREVIOUS_FAILURE',
      source: 'FAILURE_INVESTIGATION',
      pageUrl: 'https://example.com/checkout',
      riskLevel: 'critical',
    });

    const { rankedTargets } = DeterministicPrioritizer.prioritize([regularPage, failureTarget], {
      mode: 'FAILURE_DRIVEN',
    });

    expect(rankedTargets[0].id).toBe('target-fail-500');
    expect(rankedTargets[0].priorityScore).toBeGreaterThanOrEqual(95);
    expect(rankedTargets[0].reasons.some((r) => r.includes('FAILURE_DRIVEN'))).toBe(true);
  });

  it('boosts active hypotheses in DEPTH_FIRST mode', () => {
    const hypothesisTarget = createMockTarget({
      id: 'target-hyp-1',
      targetType: 'SUSPECTED_ISSUE',
      source: 'HYPOTHESIS',
      pageUrl: 'https://example.com/form',
      riskLevel: 'high',
    });

    const standardButton = createMockTarget({
      id: 'target-btn-normal',
      targetType: 'BUTTON',
      pageUrl: 'https://example.com/home',
    });

    const { rankedTargets } = DeterministicPrioritizer.prioritize([standardButton, hypothesisTarget], {
      mode: 'DEPTH_FIRST',
    });

    expect(rankedTargets[0].id).toBe('target-hyp-1');
    expect(rankedTargets[0].priorityScore).toBeGreaterThan(rankedTargets[1].priorityScore);
  });

  it('prioritizes responsive viewports in RELEASE_GAP mode', () => {
    const responsiveTarget = createMockTarget({
      id: 'target-resp-mobile',
      targetType: 'RESPONSIVE_VIEW',
      viewportName: 'mobile',
      source: 'RESPONSIVE',
      pageUrl: 'https://example.com/features',
    });

    const linkTarget = createMockTarget({
      id: 'target-nav-link',
      targetType: 'NAVIGATION_PATH',
      pageUrl: 'https://example.com/contact',
    });

    const { rankedTargets } = DeterministicPrioritizer.prioritize([linkTarget, responsiveTarget], {
      mode: 'RELEASE_GAP',
    });

    expect(rankedTargets[0].id).toBe('target-resp-mobile');
    expect(rankedTargets[0].reasons.some((r) => r.includes('RELEASE_GAP'))).toBe(true);
  });

  it('penalizes targets in active cooldown and high-cost targets', () => {
    const normalTarget = createMockTarget({
      id: 'target-normal',
      targetType: 'BUTTON',
      pageUrl: 'https://example.com/action',
    });

    const cooldownTarget = createMockTarget({
      id: 'target-cooldown',
      targetType: 'BUTTON',
      pageUrl: 'https://example.com/action-failed',
      attemptsCount: 2,
    });

    const cooldownMap = new Map([['target-cooldown', 3]]);

    const { rankedTargets } = DeterministicPrioritizer.prioritize([cooldownTarget, normalTarget], {
      mode: 'BREADTH_FIRST',
      cooldownTargetIds: cooldownMap,
      currentIteration: 2,
    });

    expect(rankedTargets[0].id).toBe('target-normal');
    expect(rankedTargets[1].reasons.some((r) => r.includes('Cooldown penalty'))).toBe(true);
    expect(rankedTargets[1].reasons.some((r) => r.includes('Retry penalty'))).toBe(true);
  });

  it('applies dependency penalty when prerequisite route visit is uncompleted', () => {
    const formTarget = createMockTarget({
      id: 'target-form-contact',
      targetType: 'FORM',
      pageUrl: 'https://example.com/contact',
      dependencies: ['target-page-contact'],
    });

    const { rankedTargets } = DeterministicPrioritizer.prioritize([formTarget], {
      mode: 'BREADTH_FIRST',
      completedTargetIds: new Set(), // target-page-contact is not completed
    });

    expect(rankedTargets[0].reasons.some((r) => r.includes('Dependency notice'))).toBe(true);
  });
});
