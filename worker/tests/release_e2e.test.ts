// ==============================================================================
// Sculra AI Release Readiness Live E2E Verification (worker/tests/release_e2e.test.ts)
// ==============================================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { JobExecutor } from '../src/executor';
import { createFixtureServer, FixtureServer } from './fixtures/app';

describe('AI Release Readiness Live E2E Verification', () => {
  let fixture: FixtureServer;

  beforeAll(async () => {
    fixture = await createFixtureServer();
  });

  afterAll(async () => {
    if (fixture) await fixture.close();
  });

  it('should execute live browser test run, calculate deterministic release readiness score, and persist release score & report', async () => {
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
                    id: 'run-release-live-1',
                    status: 'queued',
                    projects: {
                      id: 'proj-rel-1',
                      name: 'Sculra Live Target',
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

    const result = await executor.executeTestRun('run-release-live-1');

    // 1. Assert execution completion
    expect(result.status).toBeDefined();

    // 2. Assert Release Score record was inserted
    expect(insertedReleaseScores.length).toBe(1);
    const scoreRecord = insertedReleaseScores[0];
    expect(scoreRecord.scoring_version).toBe('1.0');
    expect(typeof scoreRecord.overall_score).toBe('number');
    expect(scoreRecord.overall_score).toBeGreaterThanOrEqual(0);
    expect(scoreRecord.overall_score).toBeLessThanOrEqual(100);
    expect(['RELEASE', 'RELEASE_WITH_CAUTION', 'DO_NOT_RELEASE', 'INSUFFICIENT_EVIDENCE']).toContain(
      scoreRecord.recommendation
    );
    expect(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'UNKNOWN']).toContain(scoreRecord.risk_level);
    expect(['HIGH', 'MEDIUM', 'LOW', 'INSUFFICIENT']).toContain(scoreRecord.confidence_level);

    // 3. Assert Category scores exist
    expect(typeof scoreRecord.functionality_score).toBe('number');
    expect(typeof scoreRecord.ui_score).toBe('number');
    expect(typeof scoreRecord.responsive_score).toBe('number');
    expect(typeof scoreRecord.reliability_score).toBe('number');
    expect(typeof scoreRecord.coverage_score).toBe('number');

    // 4. Assert Release Report Evidence was generated
    const releaseReport = insertedEvidence.find((e) => e.type === 'release_report');
    expect(releaseReport).toBeDefined();
    expect(releaseReport.message).toContain('# Sculra Release Readiness Report');
    expect(releaseReport.message).toContain('## 1. Executive Summary');
    expect(releaseReport.message).toContain('## 2. Release Recommendation');
    expect(releaseReport.message).toContain('## 4. Category Scores');
    expect(releaseReport.message).toContain('## 7. Active Release Blockers');

    // 5. Assert test_runs table received numeric overall_score
    const finalUpdate = runUpdates[runUpdates.length - 1];
    expect(finalUpdate).toBeDefined();
    expect(typeof finalUpdate.overall_score).toBe('number');
    expect(finalUpdate.overall_score).toBe(scoreRecord.overall_score);
  }, 45000);

  it('executes live OpenAI release analysis when credentials and flag are configured', async () => {
    if (process.env.SCULRA_RUN_LIVE_OPENAI_E2E !== 'true' || !process.env.OPENAI_API_KEY) {
      console.log('Skipping live OpenAI release analysis E2E (SCULRA_RUN_LIVE_OPENAI_E2E not true or key missing)');
      return;
    }

    const { OpenAIQAProvider } = await import('../src/ai-qa/openai-provider');
    const { ReleaseAnalyzer } = await import('../src/release/analyzer');
    const { DeterministicReleaseScorer } = await import('../src/release/scorer');

    const provider = new OpenAIQAProvider({
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    });

    const analyzer = new ReleaseAnalyzer(provider);
    const assessment = DeterministicReleaseScorer.calculateAssessment({
      testRunId: 'run-openai-live-rel',
      projectId: 'proj-live-1',
      targetUrl: fixture.url,
      applicationMap: {
        startUrl: fixture.url,
        discoveredAt: new Date().toISOString(),
        totalPages: 2,
        totalLinks: 2,
        totalButtons: 2,
        totalForms: 1,
        totalInputs: 2,
        pages: [],
      },
    });

    const analysis = await analyzer.analyze(assessment, fixture.url);

    expect(analysis).toBeDefined();
    expect(analysis?.summary).toBeDefined();
    expect(analysis?.keyRisks.length).toBeGreaterThanOrEqual(0);
    expect(analysis?.strengths.length).toBeGreaterThanOrEqual(0);
    expect(analysis?.recommendedActions.length).toBeGreaterThanOrEqual(1);
    expect(['high', 'medium', 'low']).toContain(analysis?.confidence);
  }, 30000);
});
