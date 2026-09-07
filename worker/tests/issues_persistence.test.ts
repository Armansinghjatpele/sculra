// ==============================================================================
// Sculra Issue Persistence & Deduplication Integration Tests (worker/tests/issues_persistence.test.ts)
// ==============================================================================

import { describe, it, expect, vi } from 'vitest';
import { IssueManager, BugObservation } from '../src/issues';

describe('IssueManager Persistence & Deduplication', () => {
  const sampleBug: BugObservation = {
    id: 'bug-123456',
    testRunId: 'run-1',
    journeyId: 'journey-1',
    stepId: 'step-1',
    projectId: 'proj-1',
    type: 'BROKEN_CONTROL',
    severity: 'high',
    confidence: 'high',
    status: 'open',
    title: 'Broken control: Get Started Now',
    summary: 'Element clicked but triggered zero state or DOM mutations',
    description: 'Detailed description of the broken button interaction.',
    url: 'http://localhost:3000',
    action: 'CLICK',
    selector: '#cta-broken-btn',
    errorSignature: 'click_no_op',
    reproductionSteps: [
      {
        stepNumber: 1,
        action: 'CLICK',
        target: 'Get Started Now',
        url: 'http://localhost:3000',
        expectedBehavior: 'State change',
        observedBehavior: 'No-op',
      },
    ],
    fingerprint: 'sha256_mock_fingerprint_abc123',
    timestamp: '2026-09-07T12:00:00Z',
  };

  it('inserts new issue and occurrence when issue does not exist in database', async () => {
    const insertedIssues: any[] = [];
    const insertedOccurrences: any[] = [];

    const mockSupabase: any = {
      from: (table: string) => {
        if (table === 'issues') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  limit: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            }),
            insert: (payload: any) => {
              insertedIssues.push(payload);
              return {
                select: () => ({
                  single: vi.fn().mockResolvedValue({ data: { id: 'db-issue-1' }, error: null }),
                }),
              };
            },
          };
        }
        if (table === 'issue_occurrences') {
          return {
            insert: vi.fn().mockImplementation((payload) => {
              insertedOccurrences.push(payload);
              return Promise.resolve({ error: null });
            }),
          };
        }
        return {};
      },
    };

    const manager = new IssueManager();
    const result = await manager.persistBugs(mockSupabase, [sampleBug], 'run-1', 'proj-1');

    expect(result.persistedCount).toBe(1);
    expect(result.newIssuesCount).toBe(1);
    expect(result.updatedIssuesCount).toBe(0);
    expect(result.occurrencesCount).toBe(1);
    expect(insertedIssues.length).toBe(1);
    expect(insertedIssues[0].fingerprint).toBe('sha256_mock_fingerprint_abc123');
    expect(insertedOccurrences.length).toBe(1);
    expect(insertedOccurrences[0].issue_id).toBe('db-issue-1');
  });

  it('deduplicates and increments occurrence count when issue already exists in open state', async () => {
    let updatedPayload: any = null;
    const insertedOccurrences: any[] = [];

    const mockSupabase: any = {
      from: (table: string) => {
        if (table === 'issues') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  limit: vi.fn().mockResolvedValue({
                    data: [{ id: 'existing-issue-99', status: 'open', occurrence_count: 3 }],
                    error: null,
                  }),
                }),
              }),
            }),
            update: (payload: any) => {
              updatedPayload = payload;
              return {
                eq: vi.fn().mockResolvedValue({ error: null }),
              };
            },
          };
        }
        if (table === 'issue_occurrences') {
          return {
            insert: vi.fn().mockImplementation((payload) => {
              insertedOccurrences.push(payload);
              return Promise.resolve({ error: null });
            }),
          };
        }
        return {};
      },
    };

    const manager = new IssueManager();
    const result = await manager.persistBugs(mockSupabase, [sampleBug], 'run-2', 'proj-1');

    expect(result.persistedCount).toBe(1);
    expect(result.newIssuesCount).toBe(0);
    expect(result.updatedIssuesCount).toBe(1);
    expect(result.occurrencesCount).toBe(1);
    expect(updatedPayload).toBeDefined();
    expect(updatedPayload.occurrence_count).toBe(4);
    expect(insertedOccurrences[0].issue_id).toBe('existing-issue-99');
  });

  it('preserves resolved status on existing resolved issue without reopening', async () => {
    let updatedPayload: any = null;

    const mockSupabase: any = {
      from: (table: string) => {
        if (table === 'issues') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  limit: vi.fn().mockResolvedValue({
                    data: [{ id: 'resolved-issue-7', status: 'resolved', occurrence_count: 1 }],
                    error: null,
                  }),
                }),
              }),
            }),
            update: (payload: any) => {
              updatedPayload = payload;
              return {
                eq: vi.fn().mockResolvedValue({ error: null }),
              };
            },
          };
        }
        if (table === 'issue_occurrences') {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        return {};
      },
    };

    const manager = new IssueManager();
    const result = await manager.persistBugs(mockSupabase, [sampleBug], 'run-3', 'proj-1');

    expect(result.updatedIssuesCount).toBe(1);
    expect(updatedPayload.status).toBeUndefined(); // Did not change status to open!
    expect(updatedPayload.occurrence_count).toBe(2);
  });
});
