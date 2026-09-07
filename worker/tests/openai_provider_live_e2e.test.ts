// ==============================================================================
// Sculra Real OpenAI Provider Live E2E Test (worker/tests/openai_provider_live_e2e.test.ts)
// ==============================================================================
// Guarded live E2E test. Only executes when SCULRA_RUN_LIVE_OPENAI_E2E=true and
// OPENAI_API_KEY is present in the environment. Offline CI/CD skips automatically.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { JobExecutor } from '../src/executor';
import { createFixtureServer, FixtureServer } from './fixtures/app';

const shouldRunLive =
  process.env.SCULRA_RUN_LIVE_OPENAI_E2E === 'true' &&
  !!process.env.OPENAI_API_KEY;

describe.runIf(shouldRunLive)(
  'Real OpenAI Provider Live Playwright E2E Verification',
  () => {
    let fixture: FixtureServer;

    beforeAll(async () => {
      fixture = await createFixtureServer();
    });

    afterAll(async () => {
      if (fixture) await fixture.close();
    });

    it('executes live browser QA test using real OpenAI provider against fixture application', async () => {
      const insertedEvidence: any[] = [];
      const runUpdates: any[] = [];

      const mockSupabase: any = {
        from: (table: string) => {
          if (table === 'test_runs') {
            return {
              select: () => ({
                eq: () => ({
                  single: async () => ({
                    data: {
                      id: 'run-openai-live-1',
                      status: 'queued',
                      projects: {
                        id: 'proj-openai-1',
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
                return { eq: async () => ({ data: null, error: null }) };
              },
            };
          }

          if (table === 'test_evidence') {
            return {
              insert: async (row: any) => {
                insertedEvidence.push(row);
                return { data: row, error: null };
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
              insert: (row: any) => ({
                select: () => ({
                  single: async () => ({ data: { id: 'issue-1', ...row }, error: null }),
                }),
              }),
              update: () => ({ eq: async () => ({ data: null, error: null }) }),
            };
          }

          if (table === 'issue_occurrences') {
            return {
              insert: async (row: any) => ({ data: row, error: null }),
            };
          }

          return {};
        },
      };

      process.env.NODE_ENV = 'test';
      process.env.SCULRA_AI_PROVIDER = 'openai';

      const executor = new JobExecutor({
        supabaseClient: mockSupabase,
      });

      const result = await executor.executeTestRun('run-openai-live-1');
      expect(result.status).toBeDefined();

      const aiPlans = insertedEvidence.filter((e) => e.type === 'ai_qa_plan');
      const aiResults = insertedEvidence.filter((e) => e.type === 'ai_qa_result');

      expect(aiPlans.length).toBeGreaterThan(0);
      expect(aiResults.length).toBeGreaterThan(0);

      const firstPlan = aiPlans[0].metadata?.plan;
      expect(firstPlan.version).toBe('1.0');
      expect(firstPlan.actions.length).toBeGreaterThan(0);
    }, 60000);
  }
);

// Informational test when live OpenAI testing is skipped
describe.skipIf(shouldRunLive)('Real OpenAI Provider Live Playwright E2E (Skipped)', () => {
  it('skips live OpenAI call when SCULRA_RUN_LIVE_OPENAI_E2E is not set', () => {
    expect(true).toBe(true);
  });
});
