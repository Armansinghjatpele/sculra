// ==============================================================================
// Sculra AI Product Understanding & Workflow Discovery Live E2E Verification
// (worker/tests/product_e2e.test.ts)
// ==============================================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { JobExecutor } from '../src/executor';
import { createFixtureServer, FixtureServer } from './fixtures/app';

describe('AI Product Understanding & Workflow Discovery Live E2E Verification', () => {
  let fixture: FixtureServer;

  beforeAll(async () => {
    fixture = await createFixtureServer();
  }, 30000);

  afterAll(async () => {
    if (fixture) await fixture.close();
  }, 30000);

  it('should execute live browser test run, discover product model, trace workflows, and persist product evidence', async () => {
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
                    id: 'run-product-live-1',
                    status: 'queued',
                    projects: {
                      id: 'proj-product-1',
                      name: 'Sculra Product Target',
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
            select: () => ({
              eq: () => ({
                in: async () => ({ data: [], error: null }),
                order: () => ({
                  limit: async () => ({ data: [], error: null }),
                }),
              }),
            }),
            insert: async (issueRow: any) => {
              const created = {
                id: `iss-prod-${insertedIssues.length + 1}`,
                ...issueRow,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };
              insertedIssues.push(created);
              return { data: [created], error: null };
            },
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

        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: null, error: null }),
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
          insert: async () => ({ data: null, error: null }),
          update: () => ({ eq: async () => ({ data: null, error: null }) }),
        };
      },
      storage: {
        from: () => ({
          upload: async () => ({ data: { path: 'screenshots/mock.png' }, error: null }),
          getPublicUrl: () => ({ data: { publicUrl: 'https://storage.sculra.com/mock.png' } }),
        }),
      },
    };

    const executor = new JobExecutor({
      supabaseClient: mockSupabase,
      runnerOptions: {
        headless: true,
        allowLocalhost: true,
        enableDiscovery: true,
        enableJourneys: true,
        enableVisual: true,
        enableAiQa: true,
        aiQaConfig: {
          maxIterations: 3,
          maxActionsPerJourney: 5,
        },
      },
    });

    const executionSummary = await executor.executeTestRun('run-product-live-1');

    expect(executionSummary).toBeDefined();

    // 1. Verify Product Model was created and persisted
    const productModelEvidence = insertedEvidence.find((e) => e.type === 'product_model');
    expect(productModelEvidence).toBeDefined();
    expect(productModelEvidence.metadata?.productModel).toBeDefined();

    const pm = productModelEvidence.metadata.productModel;
    expect(pm.applicationProfile).toBeDefined();
    expect(pm.features.length).toBeGreaterThan(0);
    expect(pm.workflows.length).toBeGreaterThan(0);
    expect(pm.roles.length).toBeGreaterThan(0);
    expect(pm.coverage).toBeDefined();
    expect(pm.coverage.workflowCoverageRatio).toBeGreaterThanOrEqual(0);

    // 2. Verify individual workflow evidence persisted
    const workflowEvidenceItems = insertedEvidence.filter((e) => e.type === 'product_workflow');
    expect(workflowEvidenceItems.length).toBeGreaterThan(0);

    for (const wfe of workflowEvidenceItems) {
      expect(wfe.metadata?.workflow?.id).toBeDefined();
      expect(wfe.metadata?.workflow?.steps?.length).toBeGreaterThan(0);
      expect(wfe.metadata?.criticality?.score).toBeGreaterThanOrEqual(0);
    }

    // 3. Verify that strategy decisions also ran
    const strategyDecisions = insertedEvidence.filter((e) => e.type === 'strategy_decision');
    expect(strategyDecisions.length).toBeGreaterThan(0);

    // 4. Verify release assessment was calculated
    expect(insertedReleaseScores.length).toBe(1);
    const score = insertedReleaseScores[0];
    expect(score.overall_score).toBeGreaterThan(0);
    expect(score.recommendation).toBeDefined();
  }, 60000);
});
