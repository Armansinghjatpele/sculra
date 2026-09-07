import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { JobExecutor } from '../src/executor';
import { createFixtureServer, FixtureServer } from './fixtures/app';

describe('Deterministic Visual & Responsive QA Live E2E Verification', () => {
  let fixture: FixtureServer;

  beforeAll(async () => {
    fixture = await createFixtureServer();
  });

  afterAll(async () => {
    if (fixture) await fixture.close();
  });

  it('should execute live browser test run across desktop, tablet, and mobile viewports with visual QA analysis', async () => {
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
                    id: 'run-visual-live-1',
                    status: 'queued',
                    projects: {
                      id: 'proj-visual-1',
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

        return {};
      },
    };

    process.env.NODE_ENV = 'test';

    const executor = new JobExecutor({
      supabaseClient: mockSupabase,
    });

    const result = await executor.executeTestRun('run-visual-live-1');

    // 1. Assert overall execution status
    expect(result.status).toBe('failed'); // Correctly marked failed due to deterministic broken controls and issues in fixture

    // 2. Assert state transitions
    expect(runUpdates.length).toBeGreaterThanOrEqual(2);
    expect(runUpdates[0].status).toBe('running');
    expect(runUpdates[runUpdates.length - 1].status).toBe('failed');
    expect(runUpdates[runUpdates.length - 1].overall_score).toBeNull();

    // 3. Assert Visual & Responsive Evidence Persisted
    const visualComparisons = insertedEvidence.filter((e) => e.type === 'visual_comparison');
    expect(visualComparisons.length).toBeGreaterThanOrEqual(3); // Desktop, tablet, and mobile comparisons recorded

    // Check baseline missing status for new pages
    const baselineMissing = visualComparisons.find((c) => c.metadata?.comparison?.status === 'BASELINE_MISSING');
    expect(baselineMissing).toBeDefined();

    // Responsive screenshots captured across viewports
    const screenshots = insertedEvidence.filter((e) => e.type === 'screenshot');
    expect(screenshots.length).toBeGreaterThanOrEqual(3);

    // 4. Assert Issues and Occurrences Persisted
    expect(insertedIssues.length).toBeGreaterThan(0);
    expect(insertedOccurrences.length).toBeGreaterThan(0);

    for (const issue of insertedIssues) {
      expect(issue.fingerprint).toBeDefined();
      expect(issue.severity).toBeDefined();
    }
  }, 45000);
});
