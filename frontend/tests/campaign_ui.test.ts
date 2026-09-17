import { describe, it, expect, vi, beforeAll } from 'vitest';
import {
  getObjectiveLabel,
  getStageLabel,
  getDomainLabel,
  getCampaignStatusBadgeClass,
  getTaskStatusBadgeClass,
  getVerdictBadgeClass,
  formatDuration,
  formatScore,
} from '../lib/campaignUtils';
import { createCampaign, getCampaign, getProjectCampaigns, getCampaignTasks, cancelCampaign } from '../services/db';

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
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'camp-1',
              project_id: 'proj-1',
              name: 'Test Campaign',
              objective: 'RELEASE_GATE',
              status: 'COMPLETED',
              current_stage: 'RELEASE_EVALUATION',
              overall_score: 95,
              release_verdict: 'RELEASE',
              config: { objective: 'RELEASE_GATE' },
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            error: null,
          }),
          then: (resolve: any) => {
            if (table === 'qa_campaigns') {
              resolve({
                data: [
                  {
                    id: 'camp-1',
                    project_id: 'proj-1',
                    name: 'Test Campaign',
                    objective: 'RELEASE_GATE',
                    status: 'COMPLETED',
                    current_stage: 'RELEASE_EVALUATION',
                    overall_score: 95,
                    release_verdict: 'RELEASE',
                    config: { objective: 'RELEASE_GATE' },
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  },
                ],
                error: null,
              });
            } else if (table === 'qa_campaign_tasks') {
              resolve({
                data: [
                  {
                    id: 'task-1',
                    campaign_id: 'camp-1',
                    task_key: 'stage_1_discovery',
                    stage: 'DISCOVERY_MAPPING',
                    domain: 'discovery',
                    status: 'COMPLETED',
                    priority: 100,
                    target: { type: 'GLOBAL', identifier: 'https://sculra.com' },
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

describe('Autonomous QA Campaign UI Formatters & Database Services', () => {
  describe('formatScore (Zero Metric Fabrication Rule)', () => {
    it('returns -- when score is undefined, null, or NaN', () => {
      expect(formatScore(undefined)).toBe('--');
      expect(formatScore(null)).toBe('--');
      expect(formatScore(NaN)).toBe('--');
    });

    it('formats real numeric scores correctly', () => {
      expect(formatScore(95)).toBe('95/100');
      expect(formatScore(82.4)).toBe('82/100');
      expect(formatScore(0)).toBe('0/100');
    });
  });

  describe('formatDuration', () => {
    it('returns -- when ms is undefined, null, or NaN', () => {
      expect(formatDuration(undefined)).toBe('--');
      expect(formatDuration(null)).toBe('--');
      expect(formatDuration(NaN)).toBe('--');
    });

    it('formats seconds correctly when under 60 seconds', () => {
      expect(formatDuration(45000)).toBe('45s');
      expect(formatDuration(1200)).toBe('1s');
    });

    it('formats minutes and seconds for larger durations', () => {
      expect(formatDuration(185000)).toBe('3m 5s');
      expect(formatDuration(600000)).toBe('10m 0s');
    });
  });

  describe('Labels & Badges', () => {
    it('returns correct label for objectives', () => {
      expect(getObjectiveLabel('RELEASE_GATE')).toBe('Release Gate');
      expect(getObjectiveLabel('FULL_REGRESSION')).toBe('Full Regression');
      expect(getObjectiveLabel('SMOKE')).toBe('Smoke Test');
      expect(getObjectiveLabel('SECURITY_SWEEP')).toBe('Security Sweep');
      expect(getObjectiveLabel('PERFORMANCE_AUDIT')).toBe('Performance Audit');
      expect(getObjectiveLabel('ACCESSIBILITY_AUDIT')).toBe('Accessibility Audit');
      expect(getObjectiveLabel('TARGETED_RETEST')).toBe('Targeted Retest');
      expect(getObjectiveLabel('EXPLORATORY')).toBe('Exploratory QA');
    });

    it('returns correct label for stages', () => {
      expect(getStageLabel('DISCOVERY_MAPPING')).toBe('1. Discovery & Mapping');
      expect(getStageLabel('SURFACE_VERIFICATION')).toBe('2. Surface Verification');
      expect(getStageLabel('DEEP_ENGINE_AUDITS')).toBe('3. Deep Engine Audits');
      expect(getStageLabel('HISTORICAL_CORRELATION')).toBe('4. Historical Correlation');
      expect(getStageLabel('RELEASE_EVALUATION')).toBe('5. Release Evaluation');
    });

    it('returns correct label for domains', () => {
      expect(getDomainLabel('discovery')).toBe('Discovery');
      expect(getDomainLabel('product')).toBe('Product Model');
      expect(getDomainLabel('strategy')).toBe('Strategy');
      expect(getDomainLabel('journey')).toBe('User Journeys');
      expect(getDomainLabel('visual')).toBe('Visual & Responsive');
      expect(getDomainLabel('auth')).toBe('Auth & Roles');
      expect(getDomainLabel('api')).toBe('API & Contracts');
      expect(getDomainLabel('security')).toBe('Security');
      expect(getDomainLabel('performance')).toBe('Performance');
      expect(getDomainLabel('accessibility')).toBe('Accessibility');
      expect(getDomainLabel('historical')).toBe('Historical Memory');
      expect(getDomainLabel('release')).toBe('Release Readiness');
    });

    it('returns appropriate badge classes for status and verdicts', () => {
      expect(getCampaignStatusBadgeClass('COMPLETED')).toContain('text-emerald-400');
      expect(getCampaignStatusBadgeClass('RUNNING')).toContain('text-sky-400');
      expect(getCampaignStatusBadgeClass('FAILED')).toContain('text-rose-400');

      expect(getTaskStatusBadgeClass('COMPLETED')).toContain('text-emerald-400');
      expect(getTaskStatusBadgeClass('RUNNING')).toContain('text-sky-400');

      expect(getVerdictBadgeClass('RELEASE')).toContain('text-emerald-300');
      expect(getVerdictBadgeClass('DO_NOT_RELEASE')).toContain('text-rose-300');
      expect(getVerdictBadgeClass('INSUFFICIENT_EVIDENCE')).toContain('text-slate-300');
    });
  });

  describe('Database Service Layer Methods (Fallback in dev mode)', () => {
    it('creates campaign record and initializes default budget', async () => {
      const camp = await createCampaign('mock-clerk-token', 'proj-1', {
        name: 'Test Campaign',
        objective: 'RELEASE_GATE',
      });
      expect(camp).toBeDefined();
      expect(camp.projectId).toBe('proj-1');
      expect(camp.objective).toBe('RELEASE_GATE');
    });

    it('retrieves project campaigns', async () => {
      const camps = await getProjectCampaigns('mock-clerk-token', 'proj-1');
      expect(Array.isArray(camps)).toBe(true);
    });

    it('retrieves campaign by id', async () => {
      const camp = await getCampaign('mock-clerk-token', 'camp-1');
      expect(camp).toBeDefined();
      if (camp) {
        expect(camp.id).toBe('camp-1');
      }
    });

    it('retrieves campaign tasks', async () => {
      const tasks = await getCampaignTasks('mock-clerk-token', 'camp-1');
      expect(Array.isArray(tasks)).toBe(true);
    });

    it('cancels campaign gracefully', async () => {
      await expect(cancelCampaign('mock-clerk-token', 'camp-1')).resolves.not.toThrow();
    });
  });
});
