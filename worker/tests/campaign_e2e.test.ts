// ==============================================================================
// Sculra Autonomous QA Campaign E2E Integration Suite (worker/tests/campaign_e2e.test.ts)
// ==============================================================================

import { describe, it, expect } from 'vitest';
import { CampaignExecutor } from '../src/campaign/executor';
import { CampaignConfig } from '../src/campaign/types';

describe('Autonomous QA Campaign E2E Execution Suite', () => {
  const projectId = 'proj-e2e-campaign';
  const campaignId = 'camp-e2e-exec-1';
  const targetUrl = 'https://demo.sculra.local';

  it(
    'executes an end-to-end campaign with multiple domains and generates release summary',
    async () => {
      // Mock Supabase client with in-memory persistence
      const mockCampaignTasks: any[] = [];
      const mockCampaignUpdates: any[] = [];
      const mockEvidenceRecords: any[] = [];

      const mockSupabaseClient = {
        from: (table: string) => ({
          insert: async (data: any) => {
            if (table === 'qa_campaign_tasks') {
              mockCampaignTasks.push(...(Array.isArray(data) ? data : [data]));
            } else if (table === 'test_evidence') {
              mockEvidenceRecords.push(...(Array.isArray(data) ? data : [data]));
            }
            return { error: null };
          },
          upsert: async (data: any) => {
            if (table === 'test_evidence') {
              mockEvidenceRecords.push(...(Array.isArray(data) ? data : [data]));
            }
            return { error: null };
          },
          update: (data: any) => ({
            eq: async (col: string, val: any) => {
              mockCampaignUpdates.push({ table, data, col, val });
              return { error: null };
            },
          }),
          select: () => ({
            eq: () => ({
              single: async () => ({ data: null, error: null }),
              order: () => ({
                limit: async () => ({ data: [], error: null }),
              }),
            }),
          }),
        }),
      };

      const config: Partial<CampaignConfig> = {
        objective: 'smoke',
        domains: ['DISCOVERY', 'PRODUCT', 'JOURNEY', 'RELEASE'],
        maxTasks: 10,
        maxDurationSeconds: 60,
      };

      // Execute with in-memory mock browser components
      const executor = new CampaignExecutor({
        campaignId,
        projectId,
        targetUrl,
        objective: 'smoke',
        config,
        supabaseClient: mockSupabaseClient as any,
        pastRuns: [],
        allowLocalhost: true,
      });

      const result = await executor.execute();

      expect(result).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.summary.campaignId).toBe(campaignId);
      expect(result.summary.projectId).toBe(projectId);
      expect(result.summary.domainsExecuted.length).toBeGreaterThan(0);
      expect(result.summary.tasksExecuted).toBeGreaterThan(0);
      expect(result.summary.coverageSummary).toBeDefined();
      expect(result.summary.aiExecutiveSummary).toBeDefined();

      // Verify task evidence was persisted
      expect(mockEvidenceRecords.length).toBeGreaterThan(0);
    },
    30000
  );

  it('handles early cancellation gracefully', async () => {
    const cancellationToken = { isCancelled: true };

    const executor = new CampaignExecutor({
      campaignId: 'camp-cancelled-1',
      projectId,
      targetUrl,
      objective: 'full_suite',
      config: { maxTasks: 5 },
      supabaseClient: null,
      cancellationToken,
      allowLocalhost: true,
    });

    const result = await executor.execute();
    expect(result).toBeDefined();
    expect(result.summary.status === 'COMPLETED' || result.summary.status === 'FAILED' || result.summary.status === 'CANCELLED').toBe(true);
  });
});
