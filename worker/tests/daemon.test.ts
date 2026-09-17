import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkerDaemon } from '../src/daemon';
import { JobExecutor } from '../src/executor';

describe('WorkerDaemon Queue Processing', () => {
  let mockSupabase: any;
  let mockExecutor: JobExecutor;

  beforeEach(() => {
    vi.clearAllMocks();

    mockExecutor = {
      executeTestRun: vi.fn().mockResolvedValue({ success: true, status: 'passed' }),
    } as unknown as JobExecutor;
  });

  it('should return 0 processed jobs when Supabase is not configured', async () => {
    const daemon = new WorkerDaemon({
      supabaseClient: undefined,
      executor: mockExecutor,
      pollIntervalMs: 1000,
    });

    // Nullify supabase client
    (daemon as any).supabase = null;

    const processed = await daemon.pollOnce();
    expect(processed).toBe(0);
    expect(mockExecutor.executeTestRun).not.toHaveBeenCalled();
  });

  it('should return 0 when no queued runs exist in test_runs table', async () => {
    mockSupabase = {
      rpc: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    };

    const daemon = new WorkerDaemon({
      supabaseClient: mockSupabase,
      executor: mockExecutor,
      pollIntervalMs: 1000,
    });

    const processed = await daemon.pollOnce();
    expect(processed).toBe(0);
    expect(mockExecutor.executeTestRun).not.toHaveBeenCalled();
  });

  it('should claim queued job atomically and invoke JobExecutor', async () => {
    const mockRun = {
      job_id: 'run-123',
      job_type: 'TEST_RUN',
      project_id: 'proj-abc',
      status: 'RUNNING',
      attempt: 1,
      max_attempts: 3,
      worker_id: 'worker-test-1',
      lease_expires_at: new Date(Date.now() + 60000).toISOString(),
      target_url: 'https://example.com',
      created_at: '2026-09-07T00:00:00Z',
    };

    mockSupabase = {
      rpc: vi.fn((funcName: string) => {
        if (funcName === 'acquire_execution_job') {
          return Promise.resolve({
            data: [mockRun],
            error: null,
          });
        }
        if (funcName === 'heartbeat_execution_job') {
          return Promise.resolve({
            data: true,
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      }),
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: 'run-123' },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    };

    const daemon = new WorkerDaemon({
      supabaseClient: mockSupabase,
      executor: mockExecutor,
      pollIntervalMs: 1000,
      concurrency: 1,
    });

    const processed = await daemon.pollOnce();
    expect(processed).toBe(1);
    expect(mockExecutor.executeTestRun).toHaveBeenCalledWith('run-123', expect.any(Object));
  });

  it('should handle start and stop lifecycle properly and cancel active jobs', async () => {
    const daemon = new WorkerDaemon({
      supabaseClient: undefined,
      executor: mockExecutor,
      pollIntervalMs: 5000,
    });

    await daemon.start();
    expect(daemon.getIsRunning()).toBe(true);

    // Mock an active job
    const fakeToken = { isCancelled: false, onCancel: vi.fn() };
    (daemon as any).activeJobs.set('test-run-999', fakeToken);

    await daemon.stop(0);
    expect(daemon.getIsRunning()).toBe(false);
    expect(fakeToken.isCancelled).toBe(true);
    expect(fakeToken.onCancel).toHaveBeenCalled();
  });
});
