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
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: [],
                error: null,
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
    });

    const processed = await daemon.pollOnce();
    expect(processed).toBe(0);
    expect(mockExecutor.executeTestRun).not.toHaveBeenCalled();
  });

  it('should claim queued job atomically and invoke JobExecutor', async () => {
    const mockRun = { id: 'run-123', project_id: 'proj-abc', created_at: '2026-09-07T00:00:00Z' };

    mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'test_runs') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: [mockRun],
                    error: null,
                  }),
                }),
              }),
            }),
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
          };
        }
        return {};
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

    await daemon.stop();
    expect(daemon.getIsRunning()).toBe(false);
    expect(fakeToken.isCancelled).toBe(true);
    expect(fakeToken.onCancel).toHaveBeenCalled();
  });
});
