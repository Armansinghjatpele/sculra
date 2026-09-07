// ==============================================================================
// Sculra AI Release Analyzer Tests (worker/tests/release_analyzer.test.ts)
// ==============================================================================

import { describe, it, expect } from 'vitest';
import { ReleaseAnalyzer } from '../src/release/analyzer';
import { DeterministicReleaseScorer } from '../src/release/scorer';
import { MockAIQAProvider } from '../src/ai-qa/mock-provider';
import { validateAndNormalizeReleaseAnalysis } from '../src/release/schema';
import { AIQAProvider } from '../src/ai-qa/provider';

describe('ReleaseAnalyzer & AI Interpretation Layer', () => {
  const mockAssessment = DeterministicReleaseScorer.calculateAssessment({
    testRunId: 'run-ai-1',
    projectId: 'proj-1',
    targetUrl: 'http://127.0.0.1:3000',
    applicationMap: {
      startUrl: 'http://127.0.0.1:3000',
      discoveredAt: '',
      totalPages: 3,
      totalLinks: 4,
      totalButtons: 4,
      totalForms: 1,
      totalInputs: 2,
      pages: [],
    },
    journeyResults: [
      {
        journeyId: 'j-1',
        name: 'Navigation Test',
        category: 'navigation',
        status: 'PASSED',
        startedAt: '',
        finishedAt: '',
        durationMs: 500,
        viewport: { width: 1440, height: 900, name: 'desktop' },
        steps: [],
        observations: [],
        pagesVisited: ['http://127.0.0.1:3000'],
        actionsAttempted: 3,
        actionsPassed: 3,
        actionsFailed: 0,
        actionsSkipped: 0,
      },
    ],
  });

  it('1. generates valid AIReleaseAnalysis using MockAIQAProvider', async () => {
    const provider = new MockAIQAProvider();
    const analyzer = new ReleaseAnalyzer(provider);

    const analysis = await analyzer.analyze(mockAssessment, 'http://127.0.0.1:3000');

    expect(analysis).toBeDefined();
    expect(analysis?.summary).toContain('Release readiness evaluated');
    expect(analysis?.strengths.length).toBeGreaterThan(0);
    expect(analysis?.recommendedActions.length).toBeGreaterThan(0);
    expect(['high', 'medium', 'low']).toContain(analysis?.confidence);
  });

  it('2. validates and normalizes structured release analysis JSON strictly', () => {
    const raw = {
      summary: 'Executive summary text',
      keyRisks: ['Risk 1', 'Risk 2'],
      strengths: ['Strength 1'],
      evidenceGaps: ['Gap 1'],
      recommendedActions: ['Action 1'],
      releaseExplanation: 'Score is high.',
      confidence: 'high',
    };

    const normalized = validateAndNormalizeReleaseAnalysis(raw);
    expect(normalized.summary).toBe('Executive summary text');
    expect(normalized.keyRisks).toEqual(['Risk 1', 'Risk 2']);
    expect(normalized.confidence).toBe('high');
  });

  it('3. safely returns deterministic fallback analysis when provider throws an exception', async () => {
    const failingProvider: AIQAProvider = {
      metadata: { name: 'failing-provider', model: 'fail', isDeterministicMock: false },
      generatePlan: async () => ({} as any),
      analyzeRelease: async () => {
        throw new Error('Simulated OpenAI Rate Limit HTTP 429');
      },
    };

    const analyzer = new ReleaseAnalyzer(failingProvider);
    const analysis = await analyzer.analyze(mockAssessment, 'http://127.0.0.1:3000');

    // Does NOT throw; returns safe fallback analysis
    expect(analysis).toBeDefined();
    expect(analysis?.summary).toContain('Release readiness evaluated');
    expect(analysis?.recommendedActions.length).toBeGreaterThan(0);
  });

  it('4. safely returns deterministic fallback when provider returns malformed output', async () => {
    const malformedProvider: AIQAProvider = {
      metadata: { name: 'malformed-provider', model: 'malformed', isDeterministicMock: false },
      generatePlan: async () => ({} as any),
      analyzeRelease: async () => {
        return null as any;
      },
    };

    const analyzer = new ReleaseAnalyzer(malformedProvider);
    const analysis = await analyzer.analyze(mockAssessment, 'http://127.0.0.1:3000');

    expect(analysis).toBeDefined();
    expect(analysis?.summary).toBeDefined();
  });
});
