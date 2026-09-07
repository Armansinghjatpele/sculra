// ==============================================================================
// Sculra AI QA Live E2E Verification Test (worker/tests/ai_qa_e2e.test.ts)
// ==============================================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { JobExecutor } from '../src/executor';
import { createFixtureServer, FixtureServer } from './fixtures/app';

describe('AI QA Orchestration Live E2E Verification', () => {
  let fixture: FixtureServer;

  beforeAll(async () => {
    fixture = await createFixtureServer();
  });

  afterAll(async () => {
    if (fixture) await fixture.close();
  });

  it('should execute live browser test run with AI QA orchestration loop against local fixture', async () => {
    const insertedEvidence: any[] = [];
    const insertedIssues: any[] = [];
    const insertedOccurrences: any[] = [];
    const runUpdates: any[] = [];

    const mockSupabase: any = {
      from: (table: string) => {
        if (table === 'test_runs') {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: {
                    id: 'run-ai-qa-live-1',
                    status: 'queued',
                    projects: {
                      id: 'proj-ai-qa-1',
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

        if (table === 'release_scores') {
          return {
            select: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => ({ data: null, error: null }),
                }),
              }),
            }),
            insert: async (scoreRow: any) => {
              return { data: scoreRow, error: null };
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

    const result = await executor.executeTestRun('run-ai-qa-live-1');

    // 1. Assert overall execution status
    expect(result.status).toBeDefined();

    // 2. Assert AI QA Plans & Results Persisted to Evidence
    const aiPlans = insertedEvidence.filter((e) => e.type === 'ai_qa_plan');
    const aiResults = insertedEvidence.filter((e) => e.type === 'ai_qa_result');

    expect(aiPlans.length).toBeGreaterThan(0);
    expect(aiResults.length).toBeGreaterThan(0);

    const firstPlan = aiPlans[0].metadata?.plan;
    expect(firstPlan).toBeDefined();
    expect(firstPlan.version).toBe('1.0');
    expect(firstPlan.actions.length).toBeGreaterThan(0);

    const firstResult = aiResults[0].metadata?.result;
    expect(firstResult).toBeDefined();
    expect(firstResult.provider).toBe('mock-deterministic');
    expect(firstResult.approvedActions.length).toBeGreaterThan(0);

    // 3. Assert no secrets or auth tokens leaked into evidence
    for (const ev of insertedEvidence) {
      const serialized = JSON.stringify(ev);
      expect(serialized).not.toContain('eyJhbGci');
      expect(serialized).not.toContain('sk_live_');
      expect(serialized).not.toContain('sbp_');
    }
  }, 45000);
});
