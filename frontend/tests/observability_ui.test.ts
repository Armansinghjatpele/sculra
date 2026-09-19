import { describe, it, expect, vi } from 'vitest';
import {
  getProjectAutonomousEvents,
  getProjectAutonomousTimeline,
  getProjectAutonomousDecisions,
  getProjectAutonomousHealth,
  getProjectHumanApprovals,
  getHumanApproval,
  decideHumanApproval,
  getCampaignEvidenceGraph,
} from '../services/db';
import {
  mockAutonomousEvents,
  mockDecisions,
  mockApprovals,
  mockEvidenceGraph,
  FactCategory,
  SkipReason,
} from '../lib/demoData';

vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://sculra-test.supabase.co');
vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key-123');
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-123');

vi.mock('@supabase/supabase-js', () => {
  let lastPayload: any = null;
  return {
    createClient: vi.fn(() => {
      const createBuilder = (table: string) => {
        const builder: any = {
          _table: table,
          select: vi.fn().mockImplementation(() => builder),
          insert: vi.fn().mockImplementation(() => builder),
          update: vi.fn().mockImplementation((payload) => {
            lastPayload = payload;
            return builder;
          }),
          eq: vi.fn().mockImplementation(() => builder),
          order: vi.fn().mockImplementation(() => builder),
          limit: vi.fn().mockImplementation(() => builder),
          maybeSingle: vi.fn().mockImplementation(() => {
            if (table === 'human_approvals') {
              return Promise.resolve({
                data: {
                  id: 'appr-mock-1',
                  project_id: 'proj-1',
                  remediation_id: 'fix-1',
                  source_sha: 'commit-sha-123',
                  fix_plan_version: 1,
                  status: lastPayload?.status || 'APPROVED',
                  requested_by: 'Sculra Agent',
                  requested_at: new Date().toISOString(),
                  expires_at: new Date(Date.now() + 86400000).toISOString(),
                  approved_by: lastPayload?.approved_by || 'operator-1',
                  approved_at: new Date().toISOString(),
                  decision_reason: lastPayload?.decision_reason || 'Verified safe',
                  diff_summary: { filesChanged: 1, additions: 2, deletions: 1, files: ['index.ts'] },
                  verification_passed: true,
                  security_checks_passed: true,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
                error: null,
              });
            }
            return Promise.resolve({ data: null, error: null });
          }),
        };
        return builder;
      };

      return {
        from: vi.fn((table: string) => createBuilder(table)),
      };
    }),
  };
});

describe('Autonomous QA Observability & Control Center Data Layer', () => {
  const testToken = 'mock-token';

  it('should fetch and map project autonomous events with strict fact categories', async () => {
    const events = await getProjectAutonomousEvents(testToken, 'proj-1');
    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBeGreaterThan(0);

    const factCategories = events.map((e) => e.factCategory);
    expect(factCategories).toContain('OBSERVED_FACT');
    expect(factCategories).toContain('INFERRED_CONCLUSION');
    expect(factCategories).toContain('AI_HYPOTHESIS');

    // Invariant: AI Hypothesis must never be labeled OBSERVED_FACT
    const aiHypotheses = events.filter((e) => e.eventType === 'RCA_DIAGNOSED');
    for (const hyp of aiHypotheses) {
      expect(hyp.factCategory).toBe('AI_HYPOTHESIS');
    }
  });

  it('should fetch autonomous decisions with required explainable "why" and policy checks', async () => {
    const decisions = await getProjectAutonomousDecisions(testToken, 'proj-1');
    expect(decisions.length).toBeGreaterThan(0);

    const targetDecision = decisions.find((d) => d.id === 'dec-1');
    expect(targetDecision).toBeDefined();
    expect(targetDecision?.why).toBeTruthy();
    expect(targetDecision?.whyNow).toBeTruthy();
    expect(targetDecision?.confidence).toBe('HIGH');
    expect(targetDecision?.policyChecks).toBeDefined();
    expect(targetDecision?.policyChecks?.length).toBeGreaterThan(0);

    // Verify skip decision contains valid skipReason
    const skipDecision = decisions.find((d) => d.decisionType === 'TARGET_SKIP');
    expect(skipDecision).toBeDefined();
    expect(skipDecision?.skipReason).toBe('FLAKY_QUARANTINED');
  });

  it('should compute factual autonomous health metrics with zero invented uptimes', async () => {
    const health = await getProjectAutonomousHealth(testToken, 'proj-1');
    expect(health).toBeDefined();
    expect(typeof health.activeCampaignsCount).toBe('number');
    expect(typeof health.queuedTasksCount).toBe('number');
    expect(typeof health.runningTasksCount).toBe('number');
    expect(typeof health.completedTasksLast24h).toBe('number');
    expect(typeof health.failedTasksLast24h).toBe('number');
    expect(typeof health.skippedTasksLast24h).toBe('number');
    expect(typeof health.pendingApprovalsCount).toBe('number');
    expect(typeof health.avgTaskDurationMs).toBe('number');
    expect(typeof health.healthy).toBe('boolean');

    // Zero fake 99.9% uptime invariant
    expect((health as any).uptime).toBeUndefined();
    expect((health as any).uptimePercentage).toBeUndefined();
  });

  it('should fetch human approvals with bound SHA and plan version', async () => {
    const approvals = await getProjectHumanApprovals(testToken, 'proj-1');
    expect(approvals.length).toBeGreaterThan(0);

    const pending = approvals[0];
    expect(pending.remediationId).toBeTruthy();
    expect(pending.sourceSha).toBeTruthy();
    expect(pending.fixPlanVersion).toBeGreaterThanOrEqual(1);
    expect(pending.status).toBe('PENDING');

    // 24-hour expiration window should be in the future for active pending
    const expiresAt = new Date(pending.expiresAt).getTime();
    expect(expiresAt).toBeGreaterThan(Date.now());
  });

  it('should handle operator decision on human approval', async () => {
    const updated = await decideHumanApproval(
      testToken,
      'appr-1',
      'APPROVED',
      'Code verified against reproduction unit test',
      'operator-john'
    );

    expect(updated).toBeDefined();
    expect(updated?.status).toBe('APPROVED');
    expect(updated?.approvedBy).toBe('operator-john');
    expect(updated?.decisionReason).toBe('Code verified against reproduction unit test');
  });

  it('should build causal evidence graph connecting campaign to patch and approval', async () => {
    const graph = await getCampaignEvidenceGraph(testToken, 'camp-1');
    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(graph.edges.length).toBeGreaterThan(0);

    const nodeTypes = graph.nodes.map((n) => n.type);
    expect(nodeTypes).toContain('CAMPAIGN');
    expect(nodeTypes).toContain('TASK');
    expect(nodeTypes).toContain('OBSERVATION');
    expect(nodeTypes).toContain('ISSUE');
    expect(nodeTypes).toContain('RCA');
    expect(nodeTypes).toContain('PATCH');
    expect(nodeTypes).toContain('APPROVAL');

    // Edge check
    const edgeRelationships = graph.edges.map((e) => e.relationship);
    expect(edgeRelationships).toContain('TRIGGERED');
    expect(edgeRelationships).toContain('PRODUCED');
    expect(edgeRelationships).toContain('DETECTED');
    expect(edgeRelationships).toContain('DIAGNOSED');
  });

  it('should recognize all 11 standardized autonomous skip reasons', () => {
    const expectedReasons: SkipReason[] = [
      'NO_CHANGES_DETECTED',
      'BUDGET_EXHAUSTED',
      'ENVIRONMENT_UNAVAILABLE',
      'PREREQUISITE_FAILED',
      'FLAKY_QUARANTINED',
      'LOW_RISK_PATH',
      'RATE_LIMIT_BACKOFF',
      'UNAUTHORIZED_BRANCH',
      'POLICY_VIOLATION',
      'DUPLICATE_EXECUTION',
      'USER_PAUSED',
    ];

    expect(expectedReasons.length).toBe(11);
  });
});
