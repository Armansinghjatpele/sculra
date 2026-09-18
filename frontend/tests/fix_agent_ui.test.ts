import { describe, it, expect, vi } from 'vitest';
import {
  getProjectFixPolicy,
  updateProjectFixPolicy,
  getProjectFixRemediations,
  getIssueFixRemediations,
  getFixRemediation,
  createFixRemediation,
  cancelFixRemediation,
  approveFixRemediation,
} from '../services/db';

vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://sculra-test.supabase.co');
vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key-123');
vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-123');

vi.mock('@supabase/supabase-js', () => {
  return {
    createClient: vi.fn(() => {
      const createBuilder = (table: string) => {
        const builder: any = {
          _table: table,
          select: vi.fn().mockImplementation(() => builder),
          insert: vi.fn().mockImplementation(() => builder),
          update: vi.fn().mockImplementation(() => builder),
          eq: vi.fn().mockImplementation(() => builder),
          order: vi.fn().mockImplementation(() => builder),
          limit: vi.fn().mockImplementation(() => builder),
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'fix-new-1',
              project_id: 'proj-123',
              issue_id: 'issue-456',
              mode: 'PLAN_ONLY',
              status: 'INITIAL',
              lines_added: 0,
              lines_removed: 0,
              baseline_status: 'NOT_RUN',
              verification_status: 'NOT_RUN',
              retry_count: 0,
              max_retries: 2,
              execution_time_ms: 0,
              created_at: '2026-09-18T12:00:00Z',
              updated_at: '2026-09-18T12:00:00Z',
            },
            error: null,
          }),
          maybeSingle: vi.fn().mockImplementation(() => {
            if (table === 'projects') {
              return Promise.resolve({
                data: {
                  fix_agent_enabled: true,
                  fix_agent_mode: 'CREATE_PR',
                  fix_allowed_paths: ['src/**'],
                  fix_blocked_paths: ['.github/**'],
                  fix_max_files_changed: 5,
                  fix_max_diff_lines: 250,
                  fix_allowed_test_commands: ['npm test'],
                  fix_require_human_approval: true,
                  fix_auto_pr_enabled: false,
                  fix_branch_prefix: 'sculra/fix/',
                },
                error: null,
              });
            }
            if (table === 'fix_remediations') {
              return Promise.resolve({
                data: {
                  id: 'fix-test-123',
                  project_id: 'proj-123',
                  issue_id: 'issue-456',
                  mode: 'CREATE_PR',
                  status: 'PR_OPENED',
                  branch_name: 'sculra/fix/issue-456/fix-cart',
                  base_branch: 'main',
                  commit_sha: '1234567890abcdef',
                  patch_unified: '--- a/src/cart.ts\n+++ b/src/cart.ts\n@@ -1 +1 @@\n-old\n+new',
                  files_changed: ['src/cart.ts'],
                  lines_added: 1,
                  lines_removed: 1,
                  baseline_status: 'FAILED',
                  verification_status: 'PASSED',
                  pull_request_number: 99,
                  pull_request_url: 'https://github.com/sculra/pulls/99',
                  pull_request_status: 'OPEN',
                  human_approved: true,
                  approved_by: 'user_123',
                  approved_at: '2026-09-18T12:05:00Z',
                  retry_count: 0,
                  max_retries: 2,
                  execution_time_ms: 12400,
                  created_at: '2026-09-18T12:00:00Z',
                  updated_at: '2026-09-18T12:05:00Z',
                  completed_at: '2026-09-18T12:05:00Z',
                  fix_evidence: [
                    {
                      id: 'ev-1',
                      remediation_id: 'fix-test-123',
                      evidence_type: 'VERIFICATION_LOG',
                      content: 'All 4 tests passed successfully.',
                      created_at: '2026-09-18T12:04:00Z',
                    },
                  ],
                },
                error: null,
              });
            }
            return Promise.resolve({ data: null, error: null });
          }),
          then: (resolve: any) => {
            if (table === 'fix_remediations') {
              resolve({
                data: [
                  {
                    id: 'fix-test-123',
                    project_id: 'proj-123',
                    issue_id: 'issue-456',
                    mode: 'CREATE_PR',
                    status: 'PR_OPENED',
                    branch_name: 'sculra/fix/issue-456/fix-cart',
                    base_branch: 'main',
                    lines_added: 1,
                    lines_removed: 1,
                    baseline_status: 'FAILED',
                    verification_status: 'PASSED',
                    created_at: '2026-09-18T12:00:00Z',
                    updated_at: '2026-09-18T12:05:00Z',
                  },
                ],
                error: null,
              });
            } else {
              resolve({ data: [], error: null });
            }
          },
        };
        return builder;
      };

      return {
        from: vi.fn((table: string) => createBuilder(table)),
      };
    }),
  };
});

describe('Autonomous Safe Fix Agent - Frontend Database Service', () => {
  const mockToken = 'mock_clerk_jwt_token';

  it('retrieves project fix agent policy with conservative defaults', async () => {
    const policy = await getProjectFixPolicy(mockToken, 'proj-123');

    expect(policy).toBeDefined();
    expect(policy?.fixAgentEnabled).toBe(true);
    expect(policy?.fixAgentMode).toBe('CREATE_PR');
    expect(policy?.fixAllowedPaths).toEqual(['src/**']);
    expect(policy?.fixMaxFilesChanged).toBe(5);
    expect(policy?.fixRequireHumanApproval).toBe(true);
    expect(policy?.fixBranchPrefix).toBe('sculra/fix/');
  });

  it('updates project fix agent policy', async () => {
    const updated = await updateProjectFixPolicy(mockToken, 'proj-123', {
      fixAgentMode: 'APPLY_AND_VERIFY',
      fixMaxFilesChanged: 8,
    });

    expect(updated).toBeDefined();
    expect(updated.fixBranchPrefix).toBe('sculra/fix/');
  });

  it('fetches project fix remediations list', async () => {
    const remediations = await getProjectFixRemediations(mockToken, 'proj-123');

    expect(Array.isArray(remediations)).toBe(true);
    expect(remediations.length).toBeGreaterThan(0);
    const first = remediations[0];
    expect(first.id).toBe('fix-test-123');
    expect(first.projectId).toBe('proj-123');
    expect(first.status).toBe('PR_OPENED');
    expect(first.baselineStatus).toBe('FAILED');
    expect(first.verificationStatus).toBe('PASSED');
  });

  it('fetches single fix remediation with audit evidence', async () => {
    const res = await getFixRemediation(mockToken, 'fix-test-123');

    expect(res).not.toBeNull();
    expect(res?.remediation.id).toBe('fix-test-123');
    expect(res?.remediation.pullRequestNumber).toBe(99);
    expect(res?.remediation.humanApproved).toBe(true);
    expect(res?.remediation.approvedBy).toBe('user_123');
    expect(res?.evidence.length).toBe(1);
    expect(res?.evidence[0].evidenceType).toBe('VERIFICATION_LOG');
  });

  it('creates a new fix remediation record in INITIAL status', async () => {
    const created = await createFixRemediation(mockToken, {
      projectId: 'proj-123',
      issueId: 'issue-456',
      mode: 'PLAN_ONLY',
    });

    expect(created).toBeDefined();
    expect(created.id).toBe('fix-new-1');
    expect(created.status).toBe('INITIAL');
    expect(created.mode).toBe('PLAN_ONLY');
  });

  it('approves a fix remediation with human audit record', async () => {
    const approved = await approveFixRemediation(mockToken, 'fix-test-123', 'admin_user');

    expect(approved).not.toBeNull();
    expect(approved?.humanApproved).toBe(true);
  });
});
