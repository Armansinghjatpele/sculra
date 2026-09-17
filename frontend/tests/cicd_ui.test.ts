import { describe, it, expect, vi } from 'vitest';
import {
  getVerdictBadgeClass,
  getVerdictLabel,
  getPolicyLabel,
  getReasonCodeLabel,
  formatCommitSha,
} from '../lib/cicdUtils';
import {
  getProjectCIConfig,
  updateProjectCIConfig,
  getCICDWebhookEvents,
  getCICDGateResults,
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
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: 'proj-123',
              name: 'Test Project',
              ci_enabled: true,
              github_repo_owner: 'sculra-corp',
              github_repo_name: 'sculra-app',
              ci_default_branch: 'main',
              ci_trigger_on_push: true,
              ci_trigger_on_pr: true,
              ci_gate_policy: 'BLOCK_ON_CRITICAL_ISSUE',
              ci_webhook_secret: 'sec-test-abc',
            },
            error: null,
          }),
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'proj-123',
              ci_enabled: true,
              ci_gate_policy: 'STRICT',
            },
            error: null,
          }),
          then: (resolve: any) => {
            if (table === 'cicd_webhook_events') {
              resolve({
                data: [
                  {
                    id: 'evt-1',
                    delivery_id: 'del-uuid-1',
                    provider: 'github',
                    event_type: 'push',
                    project_id: 'proj-123',
                    repository: 'sculra-corp/sculra-app',
                    status: 'COMPLETED',
                    received_at: new Date().toISOString(),
                  },
                ],
                error: null,
              });
            } else if (table === 'cicd_gate_results') {
              resolve({
                data: [
                  {
                    id: 'gate-1',
                    project_id: 'proj-123',
                    gate_verdict: 'PASS',
                    gate_policy: 'BLOCK_ON_CRITICAL_ISSUE',
                    reason_codes: ['PASS_CRITERIA_MET'],
                    critical_findings_count: 0,
                    regression_count: 0,
                    evidence_status: 'SUFFICIENT',
                    created_at: new Date().toISOString(),
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
        from: vi.fn().mockImplementation((table: string) => createBuilder(table)),
      };
    }),
  };
});

describe('Frontend CI/CD UI & Utility Tests', () => {
  describe('1. Formatting Utilities', () => {
    it('returns appropriate badge classes for each verdict', () => {
      expect(getVerdictBadgeClass('PASS')).toContain('emerald');
      expect(getVerdictBadgeClass('FAIL')).toContain('rose');
      expect(getVerdictBadgeClass('INSUFFICIENT_EVIDENCE')).toContain('amber');
      expect(getVerdictBadgeClass('CANCELLED')).toContain('slate');
      expect(getVerdictBadgeClass('ERROR')).toContain('red');
    });

    it('formats human-readable verdict and policy labels', () => {
      expect(getVerdictLabel('PASS')).toBe('Passed');
      expect(getVerdictLabel('FAIL')).toBe('Failed');
      expect(getPolicyLabel('BLOCK_ON_CRITICAL_ISSUE')).toContain('Critical Issues');
      expect(getPolicyLabel('STRICT')).toContain('Strict');
    });

    it('translates reason codes into human explanations', () => {
      expect(getReasonCodeLabel('PASS_CRITERIA_MET')).toContain('satisfied');
      expect(getReasonCodeLabel('CRITICAL_SECURITY_ISSUE')).toContain('security');
      expect(getReasonCodeLabel('NEW_REGRESSION_DETECTED')).toContain('regression');
    });

    it('formats short commit SHAs', () => {
      expect(formatCommitSha('a1b2c3d4e5f6')).toBe('a1b2c3d');
      expect(formatCommitSha(undefined)).toBe('—');
    });
  });

  describe('2. DB Service CI/CD Operations', () => {
    it('fetches project CI configuration', async () => {
      const config = await getProjectCIConfig('mock-token', 'proj-123');
      expect(config.projectId).toBe('proj-123');
      expect(config.ciEnabled).toBe(true);
      expect(config.githubRepoOwner).toBe('sculra-corp');
      expect(config.githubRepoName).toBe('sculra-app');
    });

    it('updates project CI configuration', async () => {
      const updated = await updateProjectCIConfig('mock-token', 'proj-123', {
        ciGatePolicy: 'STRICT',
      });
      expect(updated).toBeDefined();
    });

    it('fetches webhook events and gate results', async () => {
      const events = await getCICDWebhookEvents('mock-token', 'proj-123');
      expect(events.length).toBe(1);
      expect(events[0].deliveryId).toBe('del-uuid-1');

      const gateResults = await getCICDGateResults('mock-token', 'proj-123');
      expect(gateResults.length).toBe(1);
      expect(gateResults[0].gateVerdict).toBe('PASS');
    });
  });
});
