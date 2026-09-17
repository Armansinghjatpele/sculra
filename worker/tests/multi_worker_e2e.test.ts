import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  JobAcquirer,
  JobHeartbeatManager,
  JobFinalizer,
  JobRecoveryScanner,
  JobRunner,
  WorkerDaemon,
} from '../src';

/**
 * In-Memory Distributed Database Simulator to test multi-worker concurrency,
 * atomic leases, heartbeat renewals, stale recovery, and guarded finalization.
 */
class InMemoryDatabase {
  public campaigns: Map<string, any> = new Map();
  public testRuns: Map<string, any> = new Map();
  public projects: Map<string, any> = new Map();

  constructor() {
    this.reset();
  }

  reset() {
    this.campaigns.clear();
    this.testRuns.clear();
    this.projects.clear();

    this.projects.set('proj-100', {
      id: 'proj-100',
      source_type: 'website',
      source_url: 'https://example.com',
      url: 'https://example.com',
    });
  }

  createClient(): any {
    const db = this;

    return {
      rpc: vi.fn(async (funcName: string, args: any) => {
        if (funcName === 'acquire_execution_job') {
          const { p_worker_id, p_lease_seconds = 60, p_supported_types = ['CAMPAIGN', 'TEST_RUN'] } = args;
          const now = new Date();
          const leaseExpires = new Date(now.getTime() + p_lease_seconds * 1000).toISOString();
          const nowIso = now.toISOString();

          if (p_supported_types.includes('CAMPAIGN')) {
            for (const [id, c] of db.campaigns.entries()) {
              const isQueued = c.status === 'QUEUED';
              const isStale =
                c.status === 'RUNNING' &&
                c.lease_expires_at &&
                new Date(c.lease_expires_at) < now &&
                (c.attempt || 0) < (c.max_attempts || 3);

              if (isQueued || isStale) {
                const currentAttempt = typeof c.attempt === 'number' ? c.attempt : 0;
                c.status = 'RUNNING';
                c.worker_id = p_worker_id;
                c.attempt = currentAttempt + 1;
                c.lease_expires_at = leaseExpires;
                c.last_heartbeat_at = nowIso;
                c.started_at = c.started_at || nowIso;
                c.updated_at = nowIso;
                if (isStale) {
                  c.previous_worker_id = c.worker_id;
                  c.recovery_count = (c.recovery_count || 0) + 1;
                }

                return {
                  data: [
                    {
                      job_id: c.id,
                      job_type: 'CAMPAIGN',
                      project_id: c.project_id,
                      organization_id: c.organization_id || null,
                      status: 'RUNNING',
                      attempt: c.attempt,
                      max_attempts: c.max_attempts || 3,
                      worker_id: p_worker_id,
                      lease_expires_at: leaseExpires,
                      target_url: 'https://example.com',
                      config: c.configuration || {},
                      metadata: { budget: c.budget },
                      created_at: c.created_at,
                    },
                  ],
                  error: null,
                };
              }
            }
          }

          return { data: [], error: null };
        }

        if (funcName === 'heartbeat_execution_job') {
          const { p_job_id, p_job_type, p_worker_id, p_lease_seconds = 60 } = args;
          const table = p_job_type === 'CAMPAIGN' ? db.campaigns : db.testRuns;
          const record = table.get(p_job_id);

          if (!record || record.worker_id !== p_worker_id || record.status !== 'RUNNING') {
            return { data: false, error: null };
          }

          const now = new Date();
          record.last_heartbeat_at = now.toISOString();
          record.lease_expires_at = new Date(now.getTime() + p_lease_seconds * 1000).toISOString();
          record.updated_at = now.toISOString();
          return { data: true, error: null };
        }

        if (funcName === 'fail_exhausted_stale_jobs') {
          const now = new Date();
          let recovered = 0;
          let failed = 0;

          for (const [id, c] of db.campaigns.entries()) {
            if (c.status === 'RUNNING' && c.lease_expires_at && new Date(c.lease_expires_at) < now) {
              const attempt = c.attempt || 1;
              const maxAttempts = c.max_attempts || 3;
              if (attempt >= maxAttempts) {
                c.status = 'FAILED';
                c.error_code = 'MAX_ATTEMPTS_EXCEEDED';
                c.lease_expires_at = null;
                c.completed_at = now.toISOString();
                failed++;
              } else {
                c.status = 'QUEUED';
                c.previous_worker_id = c.worker_id;
                c.worker_id = null;
                c.recovery_count = (c.recovery_count || 0) + 1;
                c.lease_expires_at = null;
                recovered++;
              }
            }
          }

          return {
            data: { recovered_count: recovered, failed_count: failed },
            error: null,
          };
        }

        return { data: null, error: new Error(`Unknown RPC ${funcName}`) };
      }),

      from: vi.fn((tableName: string) => {
        const table = tableName === 'qa_campaigns' ? db.campaigns : db.testRuns;

        return {
          update: vi.fn((updates: any) => ({
            eq: vi.fn((f1: string, v1: any) => ({
              eq: vi.fn((f2: string, v2: any) => ({
                select: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => {
                    const record = table.get(v1);
                    if (!record) return { data: null, error: null };
                    if (record[f2] !== v2) return { data: null, error: null }; // Ownership mismatch!

                    Object.assign(record, updates);
                    return { data: record, error: null };
                  }),
                })),
              })),
            })),
          })),
        };
      }),
    };
  }
}

describe('Distributed Multi-Worker Reliability E2E Simulation', () => {
  let db: InMemoryDatabase;

  beforeEach(() => {
    db = new InMemoryDatabase();
  });

  it('enforces single worker lease ownership, stale recovery, and rejects stale overwrites', async () => {
    // 1. Seed a queued campaign
    db.campaigns.set('camp-cluster-1', {
      id: 'camp-cluster-1',
      project_id: 'proj-100',
      status: 'QUEUED',
      attempt: 0,
      max_attempts: 3,
      created_at: new Date().toISOString(),
    });

    const clientWorkerA = db.createClient();
    const clientWorkerB = db.createClient();

    const acquirerA = new JobAcquirer(clientWorkerA);
    const acquirerB = new JobAcquirer(clientWorkerB);

    // 2. Worker A acquires the job
    const jobA = await acquirerA.acquireNextJob({ workerId: 'worker_alpha' });
    expect(jobA).not.toBeNull();
    expect(jobA?.jobId).toBe('camp-cluster-1');
    expect(jobA?.workerId).toBe('worker_alpha');
    expect(jobA?.attempt).toBe(1);

    // DB state verified
    const dbRecord = db.campaigns.get('camp-cluster-1');
    expect(dbRecord.status).toBe('RUNNING');
    expect(dbRecord.worker_id).toBe('worker_alpha');

    // 3. Worker B attempts to acquire concurrently -> zero jobs available
    const jobB = await acquirerB.acquireNextJob({ workerId: 'worker_beta' });
    expect(jobB).toBeNull(); // Zero duplicate ownership!

    // 4. Worker A maintains heartbeat
    const heartbeatA = new JobHeartbeatManager(clientWorkerA);
    const renewed = await heartbeatA.renewLease(jobA!, 60);
    expect(renewed).toBe(true);

    // 5. Worker A crashes / network partition -> lease expires
    // Simulate time passing 61 seconds into future
    const pastDate = new Date(Date.now() - 5000).toISOString();
    dbRecord.lease_expires_at = pastDate;

    // 6. Worker B runs recovery scanner
    const recoveryScannerB = new JobRecoveryScanner(clientWorkerB);
    const recoveryResult = await recoveryScannerB.scanAndRecoverStaleJobs(3);
    expect(recoveryResult.recoveredCount).toBe(1);
    expect(recoveryResult.failedCount).toBe(0);

    expect(dbRecord.status).toBe('QUEUED');
    expect(dbRecord.worker_id).toBeNull();
    expect(dbRecord.previous_worker_id).toBe('worker_alpha');
    expect(dbRecord.recovery_count).toBe(1);

    // 7. Worker B acquires the recovered job
    const reclaimedJobB = await acquirerB.acquireNextJob({ workerId: 'worker_beta' });
    expect(reclaimedJobB).not.toBeNull();
    expect(reclaimedJobB?.jobId).toBe('camp-cluster-1');
    expect(reclaimedJobB?.workerId).toBe('worker_beta');
    expect(reclaimedJobB?.attempt).toBe(2);

    expect(dbRecord.status).toBe('RUNNING');
    expect(dbRecord.worker_id).toBe('worker_beta');

    // 8. Zombie Worker A wakes up and attempts to heartbeat or finalize
    const zombieHeartbeat = await heartbeatA.renewLease(jobA!, 60);
    expect(zombieHeartbeat).toBe(false); // Heartbeat rejected!

    const finalizerA = new JobFinalizer(clientWorkerA);
    const zombieFinalize = await finalizerA.finalizeJob(jobA!, {
      success: true,
      status: 'COMPLETED',
    });
    expect(zombieFinalize.success).toBe(false);
    expect(zombieFinalize.conflict).toBe(true); // Overwrite rejected!

    // Ensure Worker B's active ownership is undisturbed
    expect(dbRecord.status).toBe('RUNNING');
    expect(dbRecord.worker_id).toBe('worker_beta');

    // 9. Worker B completes and finalizes cleanly
    const finalizerB = new JobFinalizer(clientWorkerB);
    const bFinalize = await finalizerB.finalizeJob(reclaimedJobB!, {
      success: true,
      status: 'COMPLETED',
    });
    expect(bFinalize.success).toBe(true);
    expect(bFinalize.conflict).toBe(false);

    expect(dbRecord.status).toBe('COMPLETED');
    expect(dbRecord.lease_expires_at).toBeNull();
  });

  it('strictly bounds stale job retries and transitions to FAILED when max_attempts is exceeded', async () => {
    // Seed a job that has already executed attempt 3 and died
    db.campaigns.set('camp-exhaust-1', {
      id: 'camp-exhaust-1',
      project_id: 'proj-100',
      status: 'RUNNING',
      attempt: 3,
      max_attempts: 3,
      worker_id: 'crashed_worker',
      lease_expires_at: new Date(Date.now() - 10000).toISOString(), // Stale
    });

    const client = db.createClient();
    const scanner = new JobRecoveryScanner(client);

    const result = await scanner.scanAndRecoverStaleJobs(3);
    expect(result.failedCount).toBe(1);
    expect(result.recoveredCount).toBe(0);

    const record = db.campaigns.get('camp-exhaust-1');
    expect(record.status).toBe('FAILED');
    expect(record.error_code).toBe('MAX_ATTEMPTS_EXCEEDED');
    expect(record.lease_expires_at).toBeNull();
  });
});
