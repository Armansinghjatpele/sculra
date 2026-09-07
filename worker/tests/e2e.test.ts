import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { JobExecutor } from '../src/executor';
import { createFixtureServer, FixtureServer } from './fixtures/app';

describe('Worker Live E2E Verification against Local Fixture Target', () => {
  let fixture: FixtureServer;

  beforeAll(async () => {
    fixture = await createFixtureServer();
  });

  afterAll(async () => {
    if (fixture) await fixture.close();
  });

  it('should execute live browser test run end-to-end, discover application structure, and persist evidence', async () => {
    const insertedEvidence: any[] = [];
    const runUpdates: any[] = [];

    const insertedIssues: any[] = [];
    const insertedOccurrences: any[] = [];

    // Mock Supabase client to inspect state transitions and persisted evidence
    const mockSupabase: any = {
      from: (table: string) => {
        if (table === 'test_runs') {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: {
                    id: 'run-e2e-live-1',
                    status: 'queued',
                    projects: {
                      id: 'proj-e2e-1',
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

    // Ensure allowLocalhost is active in test environment
    process.env.NODE_ENV = 'test';

    const executor = new JobExecutor({
      supabaseClient: mockSupabase,
    });

    const result = await executor.executeTestRun('run-e2e-live-1');

    // 1. Assert overall execution status
    expect(result.status).toBe('failed'); // Correctly marked failed due to deterministic broken controls in fixture

    // 2. Assert state transitions
    expect(runUpdates.length).toBeGreaterThanOrEqual(2);
    expect(runUpdates[0].status).toBe('running');
    expect(runUpdates[runUpdates.length - 1].status).toBe('failed');
    expect(typeof runUpdates[runUpdates.length - 1].overall_score).toBe('number');

    // 3. Assert evidence persisted
    expect(insertedEvidence.length).toBeGreaterThan(0);

    // Initial navigation evidence
    const navEvidence = insertedEvidence.find((e) => e.type === 'navigation');
    expect(navEvidence).toBeDefined();
    expect(navEvidence.metadata.pageTitle).toBe('Sculra Test Target Home');

    // Application map evidence
    const mapEvidence = insertedEvidence.find((e) => e.type === 'application_map');
    expect(mapEvidence).toBeDefined();
    expect(mapEvidence.metadata.applicationMap).toBeDefined();
    const appMap = mapEvidence.metadata.applicationMap;
    expect(appMap.totalPages).toBeGreaterThanOrEqual(4);
    expect(appMap.totalForms).toBeGreaterThanOrEqual(1);
    expect(appMap.totalButtons).toBeGreaterThanOrEqual(2);

    // Screenshots persisted
    const screenshots = insertedEvidence.filter((e) => e.type === 'screenshot');
    expect(screenshots.length).toBeGreaterThanOrEqual(1);

    // 4. Assert issues persisted
    expect(insertedIssues.length).toBeGreaterThan(0);
    expect(insertedOccurrences.length).toBeGreaterThan(0);
    const brokenControlIssue = insertedIssues.find((i) => i.title.toLowerCase().includes('broken control'));
    expect(brokenControlIssue).toBeDefined();
    expect(brokenControlIssue.severity).toBeDefined();
    expect(brokenControlIssue.fingerprint).toBeDefined();
  }, 45000);
});
