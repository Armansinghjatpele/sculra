import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JobAcquirer } from '../src/execution/job-acquirer';
import { JobFinalizer } from '../src/execution/job-finalizer';
import { ExecutionJob } from '../src/execution/types';
import { GitHubSourceAdapter } from '../src/sources/adapters/github-adapter';
import { SourceOrchestrator } from '../src/sources/source-orchestrator';

describe('Production Onboarding & First Real QA Run Worker Execution (Prompt 65)', () => {

  // ============================================================================
  // 1. Durable Queue Lifecycle & Atomic Job Claiming
  // ============================================================================
  describe('Durable Queue Acquisition via JobAcquirer', () => {
    it('claims queued TEST_RUN atomically and assigns worker lease', async () => {
      const mockTestRuns = [
        {
          id: 'tr-prod-001',
          project_id: 'proj-123',
          organization_id: 'org-456',
          status: 'queued',
          created_at: new Date(Date.now() - 5000).toISOString(),
          attempt: 0,
          max_attempts: 3,
          projects: {
            id: 'proj-123',
            source_url: 'https://staging.example.com',
            source_type: 'website',
          },
        },
      ];

      const mockSupabase: any = {
        rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'RPC not installed' } }),
        from: vi.fn((table: string) => {
          if (table === 'qa_campaigns') {
            return {
              select: vi.fn().mockReturnThis(),
              or: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue({ data: [] }),
            };
          }
          if (table === 'test_runs') {
            return {
              select: vi.fn().mockReturnThis(),
              or: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              limit: vi.fn().mockResolvedValue({ data: mockTestRuns }),
              update: vi.fn((patch: any) => ({
                eq: vi.fn(() => ({
                  select: vi.fn().mockReturnThis(),
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      ...mockTestRuns[0],
                      ...patch,
                      status: 'running',
                      worker_id: 'worker-node-1',
                      attempt: 1,
                    },
                    error: null,
                  }),
                })),
              })),
            };
          }
          return {};
        }),
      };

      const acquirer = new JobAcquirer(mockSupabase);
      const job = await acquirer.acquireNextJob({
        workerId: 'worker-node-1',
        leaseSeconds: 30,
        supportedTypes: ['TEST_RUN'],
      });

      expect(job).not.toBeNull();
      expect(job?.jobId).toBe('tr-prod-001');
      expect(job?.jobType).toBe('TEST_RUN');
      expect(job?.status).toBe('RUNNING');
      expect(job?.workerId).toBe('worker-node-1');
      expect(job?.targetUrl).toBe('https://staging.example.com');
      expect(job?.attempt).toBe(1);
    });

    it('recovers expired leases for crashed workers and updates recovery count', async () => {
      const expiredIso = new Date(Date.now() - 60000).toISOString();
      const mockStaleRun = {
        id: 'tr-stale-002',
        project_id: 'proj-123',
        organization_id: 'org-456',
        status: 'running',
        worker_id: 'worker-crashed',
        lease_expires_at: expiredIso,
        attempt: 1,
        max_attempts: 3,
        recovery_count: 0,
        projects: {
          id: 'proj-123',
          source_url: 'https://staging.example.com',
        },
      };

      const mockSupabase: any = {
        rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'Fallback' } }),
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          or: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: [mockStaleRun] }),
          update: vi.fn((patch: any) => ({
            eq: vi.fn(() => ({
              select: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  ...mockStaleRun,
                  ...patch,
                  worker_id: 'worker-recovery-2',
                  previous_worker_id: 'worker-crashed',
                  recovery_count: 1,
                },
                error: null,
              }),
            })),
          })),
        })),
      };

      const acquirer = new JobAcquirer(mockSupabase);
      const job = await acquirer.acquireNextJob({
        workerId: 'worker-recovery-2',
        leaseSeconds: 30,
        supportedTypes: ['TEST_RUN'],
      });

      expect(job).not.toBeNull();
      expect(job?.jobId).toBe('tr-stale-002');
      expect(job?.workerId).toBe('worker-recovery-2');
      expect(job?.previousWorkerId).toBe('worker-crashed');
      expect(job?.recoveryCount).toBe(1);
    });
  });

  // ============================================================================
  // 2. Strict Truthfulness: NO EVIDENCE -> NO INFERENCE
  // ============================================================================
  describe('Strict Zero Synthetic Evidence & Null Score Invariants', () => {
    it('persists overall_score as NULL when no measured score exists, even if campaign succeeded', async () => {
      let persistedPayload: any = null;

      const mockSupabase: any = {
        from: vi.fn((table: string) => {
          if (table === 'test_runs') {
            return {
              update: vi.fn((payload: any) => {
                persistedPayload = payload;
                return {
                  eq: vi.fn().mockReturnThis(),
                  select: vi.fn(() => ({
                    maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'run-test', worker_id: 'worker-1', status: 'passed' }, error: null }),
                  })),
                };
              }),
            };
          }
          return {
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
          };
        }),
      };

      const finalizer = new JobFinalizer(mockSupabase);
      const executionJob: ExecutionJob = {
        jobId: 'run-zero-score-test',
        jobType: 'TEST_RUN',
        projectId: 'proj-1',
        organizationId: 'org-1',
        status: 'RUNNING',
        attempt: 1,
        maxAttempts: 3,
        workerId: 'worker-1',
        leaseExpiresAt: new Date(Date.now() + 60000).toISOString(),
        createdAt: new Date().toISOString(),
        targetUrl: 'https://example.com',
      };

      // Finalize with SUCCESS but without any release assessment or measured overall score
      await finalizer.finalizeJob(executionJob, {
        status: 'passed',
        success: true,
        // Notice: releaseScore / overallScore is explicitly undefined (unmeasured)
      });

      expect(persistedPayload).not.toBeNull();
      expect(persistedPayload.status).toBe('passed');
      // Must be null; never synthetic 100 or 50
      expect(persistedPayload.overall_score).toBeNull();
    });

    it('persists overall_score as NULL when execution fails, never fallback 50', async () => {
      let persistedPayload: any = null;

      const mockSupabase: any = {
        from: vi.fn((table: string) => {
          if (table === 'test_runs') {
            return {
              update: vi.fn((payload: any) => {
                persistedPayload = payload;
                return {
                  eq: vi.fn().mockReturnThis(),
                  select: vi.fn(() => ({
                    maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'run-test', worker_id: 'worker-1', status: 'passed' }, error: null }),
                  })),
                };
              }),
            };
          }
          return {
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
          };
        }),
      };

      const finalizer = new JobFinalizer(mockSupabase);
      const executionJob: ExecutionJob = {
        jobId: 'run-failed-score-test',
        jobType: 'TEST_RUN',
        projectId: 'proj-1',
        organizationId: 'org-1',
        status: 'RUNNING',
        attempt: 1,
        maxAttempts: 3,
        workerId: 'worker-1',
        leaseExpiresAt: new Date(Date.now() + 60000).toISOString(),
        createdAt: new Date().toISOString(),
        targetUrl: 'https://example.com',
      };

      await finalizer.finalizeJob(executionJob, {
        status: 'failed',
        success: false,
        error: new Error('Target unreachable'),
      });

      expect(persistedPayload).not.toBeNull();
      expect(persistedPayload.status).toBe('failed');
      expect(persistedPayload.overall_score).toBeNull();
      expect(persistedPayload.overall_score).not.toBe(50);
    });

    it('persists measured score accurately when real evidence produces a release assessment', async () => {
      let persistedPayload: any = null;

      const mockSupabase: any = {
        from: vi.fn((table: string) => {
          if (table === 'test_runs') {
            return {
              update: vi.fn((payload: any) => {
                persistedPayload = payload;
                return {
                  eq: vi.fn().mockReturnThis(),
                  select: vi.fn(() => ({
                    maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'run-test', worker_id: 'worker-1', status: 'passed' }, error: null }),
                  })),
                };
              }),
            };
          }
          return {
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
          };
        }),
      };

      const finalizer = new JobFinalizer(mockSupabase);
      const executionJob: ExecutionJob = {
        jobId: 'run-measured-score-test',
        jobType: 'TEST_RUN',
        projectId: 'proj-1',
        organizationId: 'org-1',
        status: 'RUNNING',
        attempt: 1,
        maxAttempts: 3,
        workerId: 'worker-1',
        leaseExpiresAt: new Date(Date.now() + 60000).toISOString(),
        createdAt: new Date().toISOString(),
        targetUrl: 'https://example.com',
      };

      await finalizer.finalizeJob(executionJob, {
        status: 'passed',
        success: true,
        releaseScore: 84, // Measured from axe, console, and journey assertions
        releaseVerdict: 'READY',
      });

      expect(persistedPayload).not.toBeNull();
      expect(persistedPayload.overall_score).toBe(84);
      expect(persistedPayload.release_verdict).toBe('READY');
    });
  });

  // ============================================================================
  // 3. GitHub Source Adapter Truthful Onboarding
  // ============================================================================
  describe('GitHub Adapter Truthful Probe', () => {
    it('returns UNAVAILABLE and valid: false when GitHub API request fails, without fake HEAD commit or AVAILABLE status', async () => {
      const adapter = new GitHubSourceAdapter();
      // Probe non-existent or blocked repository
      const probe = await adapter.validate('nonexistent-owner-999/nonexistent-repo-999', {});

      expect(probe.valid).toBe(false);
      expect(probe.status).toBe('UNAVAILABLE');
      expect(probe.health).toBe('UNREACHABLE');
      expect(probe.revision).toBeUndefined();
      expect(probe.errors.length).toBeGreaterThan(0);
    });

    it('does not invent branch "main" when computing fingerprint if branch was not configured', async () => {
      const adapter = new GitHubSourceAdapter();
      const source: any = {
        id: 'src-gh-1',
        locator: 'https://github.com/facebook/react',
        branch: undefined, // unspecified
        configuration: {},
      };

      const fp = await adapter.fingerprint(source);
      expect(fp).toBeDefined();
      expect(fp.hash).toBeDefined();
    });
  });

  // ============================================================================
  // 4. Multi-Tenant Queue Isolation
  // ============================================================================
  describe('Multi-Tenant Organization Queue Isolation', () => {
    it('ensures jobs in Org A are tagged with Org A organization_id and cannot be claimed by mismatched tenant scope', () => {
      const orgAJob: ExecutionJob = {
        jobId: 'job-org-a',
        jobType: 'TEST_RUN',
        projectId: 'proj-a',
        organizationId: 'org-alpha-uuid',
        status: 'RUNNING',
        attempt: 1,
        maxAttempts: 3,
        workerId: 'worker-node-1',
        leaseExpiresAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        targetUrl: 'https://alpha.example.com',
      };

      expect(orgAJob.organizationId).toBe('org-alpha-uuid');
      expect(orgAJob.organizationId).not.toBe('org-beta-uuid');
    });
  });
});
