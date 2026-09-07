// ==============================================================================
// Sculra AI Strategy Analyzer Unit Tests (worker/tests/strategy_analyzer.test.ts)
// ==============================================================================

import { describe, it, expect } from 'vitest';
import { StrategyAnalyzer } from '../src/strategy/analyzer';
import {
  validateAndNormalizeStrategyDecision,
  createFallbackRecommendation,
} from '../src/strategy/schema';
import { TestTarget, StrategyBudget } from '../src/strategy/types';
import { MockAIQAProvider } from '../src/ai-qa/mock-provider';

describe('AI Strategy Analyzer & Schema Validation', () => {
  const mockCandidates: TestTarget[] = [
    {
      id: 'target-page-home',
      targetType: 'PAGE',
      pageUrl: 'https://example.com/',
      priorityScore: 80,
      priorityLevel: 'high',
      riskLevel: 'low',
      coverageValue: 70,
      reasons: ['Unvisited home page'],
      dependencies: [],
      source: 'DISCOVERY',
      status: 'PENDING',
      estimatedCost: 1,
      evidenceCount: 0,
      attemptsCount: 0,
    },
    {
      id: 'target-form-contact',
      targetType: 'FORM',
      pageUrl: 'https://example.com/contact',
      priorityScore: 75,
      priorityLevel: 'high',
      riskLevel: 'medium',
      coverageValue: 80,
      reasons: ['Interactive form with 3 fields'],
      dependencies: ['target-page-home'],
      source: 'DISCOVERY',
      status: 'PENDING',
      estimatedCost: 3,
      evidenceCount: 0,
      attemptsCount: 0,
    },
  ];

  it('validates structured AI output and preserves valid candidate target IDs', () => {
    const rawOutput = {
      recommendedMode: 'BREADTH_FIRST',
      selectedTargetIds: ['target-page-home', 'target-form-contact'],
      investigationHypotheses: [
        {
          id: 'hyp-1',
          description: 'Testing home page navigation link connectivity',
          targetUrl: 'https://example.com/',
          confidence: 'high',
          supportingEvidence: 'Initial discovery',
        },
      ],
      strategyRationale: 'Broadening route coverage across primary entrypoints.',
      recommendedFocus: 'BREADTH',
      suggestedStop: false,
      stopReason: '',
    };

    const normalized = validateAndNormalizeStrategyDecision(rawOutput, mockCandidates, 'BREADTH_FIRST');

    expect(normalized.recommendedMode).toBe('BREADTH_FIRST');
    expect(normalized.selectedTargetIds).toEqual(['target-page-home', 'target-form-contact']);
    expect(normalized.investigationHypotheses.length).toBe(1);
    expect(normalized.suggestedStop).toBe(false);
  });

  it('CRITICAL SAFETY: Strips fake or invented target IDs not present in candidate list', () => {
    const rawOutput = {
      recommendedMode: 'DEPTH_FIRST',
      selectedTargetIds: ['fake-invented-target-999', 'target-page-home', 'arbitrary-selector-id'],
      investigationHypotheses: [],
      strategyRationale: 'Invented target test.',
      recommendedFocus: 'DEPTH',
      suggestedStop: false,
      stopReason: '',
    };

    const normalized = validateAndNormalizeStrategyDecision(rawOutput, mockCandidates, 'BREADTH_FIRST');

    // Only 'target-page-home' was in mockCandidates, the other two must be stripped!
    expect(normalized.selectedTargetIds).toEqual(['target-page-home']);
  });

  it('falls back to top deterministic candidate if AI selected 0 valid targets', () => {
    const rawOutput = {
      recommendedMode: 'FAILURE_DRIVEN',
      selectedTargetIds: ['non-existent-1', 'non-existent-2'],
      investigationHypotheses: [],
      strategyRationale: 'All fake IDs',
      recommendedFocus: 'FAILURE_INVESTIGATION',
      suggestedStop: false,
      stopReason: '',
    };

    const normalized = validateAndNormalizeStrategyDecision(rawOutput, mockCandidates, 'FAILURE_DRIVEN');

    expect(normalized.selectedTargetIds).toEqual(['target-page-home']);
  });

  it('produces safe deterministic fallback recommendation when createFallbackRecommendation is called', () => {
    const fallback = createFallbackRecommendation(mockCandidates, 'BREADTH_FIRST', 'API Timeout');

    expect(fallback.recommendedMode).toBe('BREADTH_FIRST');
    expect(fallback.selectedTargetIds).toEqual(['target-page-home', 'target-form-contact']);
    expect(fallback.strategyRationale.includes('Deterministic Fallback: API Timeout')).toBe(true);
    expect(fallback.suggestedStop).toBe(false);
  });

  it('runs analysis via MockAIQAProvider and returns structured recommendation', async () => {
    const provider = new MockAIQAProvider();
    const analyzer = new StrategyAnalyzer({ provider });

    const budget: StrategyBudget = {
      maxIterations: 5,
      currentIteration: 1,
      remainingIterations: 4,
      maxTargets: 20,
      targetsExecuted: 0,
      maxDeepInvestigationDepth: 3,
      maxRetries: 2,
      maxTargetsPerPage: 4,
      maxStrategyCalls: 5,
      strategyCallsMade: 1,
    };

    const result = await analyzer.analyze(
      'test-run-1',
      'https://example.com',
      'BREADTH_FIRST',
      1,
      budget,
      mockCandidates
    );

    expect(result.isFallback).toBe(false);
    expect(result.recommendation.recommendedMode).toBe('BREADTH_FIRST');
    expect(result.recommendation.selectedTargetIds.length).toBeGreaterThan(0);
  });

  it('gracefully degrades to deterministic fallback when provider throws an error', async () => {
    const faultyProvider: any = {
      metadata: { name: 'faulty', model: 'faulty-v1', isDeterministicMock: false },
      generatePlan: async () => { throw new Error('Faulty'); },
      analyzeTestStrategy: async () => {
        throw new Error('OpenAI rate limit exceeded');
      },
    };

    const analyzer = new StrategyAnalyzer({ provider: faultyProvider });
    const budget: StrategyBudget = {
      maxIterations: 5,
      currentIteration: 1,
      remainingIterations: 4,
      maxTargets: 20,
      targetsExecuted: 0,
      maxDeepInvestigationDepth: 3,
      maxRetries: 2,
      maxTargetsPerPage: 4,
      maxStrategyCalls: 5,
      strategyCallsMade: 1,
    };

    const result = await analyzer.analyze(
      'test-run-1',
      'https://example.com',
      'FAILURE_DRIVEN',
      1,
      budget,
      mockCandidates
    );

    expect(result.isFallback).toBe(true);
    expect(result.fallbackReason).toContain('OpenAI rate limit exceeded');
    expect(result.recommendation.selectedTargetIds).toContain('target-page-home');
  });
});
