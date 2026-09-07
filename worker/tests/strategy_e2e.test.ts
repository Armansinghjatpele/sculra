// ==============================================================================
// Sculra AI QA Prioritization & Strategy Engine Live E2E Verification (worker/tests/strategy_e2e.test.ts)
// ==============================================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { JobExecutor } from '../src/executor';
import { createFixtureServer, FixtureServer } from './fixtures/app';

describe('AI QA Prioritization & Strategy Engine Live E2E Verification', () => {
  let fixture: FixtureServer;

  beforeAll(async () => {
    fixture = await createFixtureServer();
  }, 30000);

  afterAll(async () => {
    if (fixture) await fixture.close();
  }, 30000);

  it('should execute live browser test run with autonomous strategy prioritization and persist strategy decisions', async () => {
    const insertedEvidence: any[] = [];
    const insertedIssues: any[] = [];
    const insertedOccurrences: any[] = [];
    const insertedReleaseScores: any[] = [];
    const runUpdates: any[] = [];

    const mockSupabase: any = {
      from: (table: string) => {
        if (table === 'test_runs') {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: {
                    id: 'run-strat-live-1',
                    status: 'queued',
                    projects: {
                      id: 'proj-strat-1',
                      name: 'Sculra Strategy Target',
                      source_type: 'website',
                      source_url: fixture.url,
                    },
                  },
                  error: null,
                }),
              }),
            }),
            update: (fields: any) => {
              runUpdates.push(fields);
              return {
                eq: async () => ({ data: null, error: null }),
              };
            },
          };
        }

        if (table === 'release_scores') {
          return {
            select: () => {
              const chain: any = {
                eq: () => chain,
                order: () => chain,
                limit: () => chain,
                maybeSingle: async () => ({ data: null, error: null }),
              };
              return chain;
            },
            insert: async (scoreRow: any) => {
              insertedReleaseScores.push(scoreRow);
              return { data: scoreRow, error: null };
            },
          };
        }

        if (table === 'test_evidence') {
          return {
            insert: async (evidenceRow: any) => {
              insertedEvidence.push(evidenceRow);
              return { data: evidenceRow, error: null };
            },
          };
        }

        if (table === 'issues') {
          return {
            select: () => {
              const chain: any = {
                eq: () => chain,
                limit: async () => ({ data: [], error: null }),
                single: async () => ({ data: null, error: null }),
                maybeSingle: async () => ({ data: null, error: null }),
              };
              return chain;
            },
            insert: (issueRow: any) => ({
              select: () => ({
                single: async () => {
                  const saved = { id: `mock-issue-${insertedIssues.length + 1}`, ...issueRow };
                  insertedIssues.push(saved);
                  return { data: saved, error: null };
                },
              }),
            }),
            update: () => ({
              eq: async () => ({ data: null, error: null }),
            }),
          };
        }

        if (table === 'issue_occurrences') {
          return {
            insert: async (occRow: any) => {
              insertedOccurrences.push(occRow);
              return { data: occRow, error: null };
            },
          };
        }

        return {};
      },
    };

    process.env.NODE_ENV = 'test';

    const executor = new JobExecutor({
      supabaseClient: mockSupabase,
    });

    const result = await executor.executeTestRun('run-strat-live-1');

    // 1. Assert execution completion
    expect(result.status).toBeDefined();

    // 2. Assert Strategy Decisions Persisted to Evidence
    const strategyDecisions = insertedEvidence.filter((e) => e.type === 'strategy_decision');
    expect(strategyDecisions.length).toBeGreaterThan(0);

    const firstDecisionEvidence = strategyDecisions[0];
    expect(firstDecisionEvidence.title).toContain('AI Test Strategy');
    expect(firstDecisionEvidence.metadata?.decision).toBeDefined();

    const decision = firstDecisionEvidence.metadata.decision;
    expect(decision.iteration).toBe(1);
    expect(decision.mode).toBeDefined();
    expect(decision.selectedTargets.length).toBeGreaterThan(0);
    expect(decision.deterministicRankings.length).toBeGreaterThan(0);

    // 3. Assert Selected Target has deterministic priority score and reasons
    const topTarget = decision.selectedTargets[0];
    expect(topTarget.id).toBeDefined();
    expect(typeof topTarget.priorityScore).toBe('number');
    expect(topTarget.priorityScore).toBeGreaterThanOrEqual(0);
    expect(topTarget.priorityScore).toBeLessThanOrEqual(100);
    expect(topTarget.reasons.length).toBeGreaterThan(0);

    // 4. Assert Adaptive State Summary Evidence Persisted
    const stateSummaryEvidence = insertedEvidence.find((e) => e.type === 'ai_qa_state_summary');
    expect(stateSummaryEvidence).toBeDefined();
    expect(stateSummaryEvidence.metadata?.stateSummary).toBeDefined();

    // 5. Assert Release Report Evidence Persisted
    const releaseReportEvidence = insertedEvidence.find((e) => e.type === 'release_report');
    expect(releaseReportEvidence).toBeDefined();
  }, 45000);

  it('executes live OpenAI strategy analysis when credentials and flag are configured', async () => {
    const runLive = process.env.SCULRA_RUN_LIVE_OPENAI_E2E === 'true' && Boolean(process.env.OPENAI_API_KEY);

    if (!runLive) {
      console.log('Skipping live OpenAI strategy analysis E2E (SCULRA_RUN_LIVE_OPENAI_E2E not true or key missing)');
      return;
    }

    const { OpenAIQAProvider } = await import('../src/ai-qa/openai-provider');
    const { StrategyAnalyzer } = await import('../src/strategy/analyzer');

    const provider = new OpenAIQAProvider();
    const analyzer = new StrategyAnalyzer({ provider });

    const result = await analyzer.analyze(
      'run-live-openai-strat-1',
      fixture.url,
      'FAILURE_DRIVEN',
      1,
      {
        maxIterations: 3,
        currentIteration: 1,
        remainingIterations: 2,
        maxTargets: 15,
        targetsExecuted: 2,
        maxDeepInvestigationDepth: 3,
        maxRetries: 2,
        maxTargetsPerPage: 4,
        maxStrategyCalls: 3,
        strategyCallsMade: 1,
      },
      [
        {
          id: 'target-page-home',
          targetType: 'PAGE',
          pageUrl: fixture.url,
          priorityScore: 85,
          priorityLevel: 'high',
          riskLevel: 'high',
          coverageValue: 70,
          reasons: ['Initial entry point'],
          dependencies: [],
          source: 'DISCOVERY',
          status: 'PENDING',
          estimatedCost: 1,
          evidenceCount: 0,
          attemptsCount: 0,
        },
      ]
    );

    expect(result.isFallback).toBe(false);
    expect(result.recommendation.recommendedMode).toBeDefined();
    expect(result.recommendation.selectedTargetIds.length).toBeGreaterThan(0);
  }, 30000);
});
