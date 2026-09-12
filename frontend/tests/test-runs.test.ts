import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as createRunHandler } from '../app/api/test-runs/route';
import { GET as getRunDetailHandler } from '../app/api/test-runs/[id]/route';
import { POST as cancelRunHandler } from '../app/api/test-runs/[id]/cancel/route';
import { NextRequest } from 'next/server';

// Mock Clerk Server Auth
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
}));

// Mock Database Service
vi.mock('@/services/db', () => ({
  getProject: vi.fn(),
  getTestRuns: vi.fn(),
  createTestRun: vi.fn(),
  getTestRun: vi.fn(),
  getTestEvidence: vi.fn(),
  getTestRunIssues: vi.fn(),
  getTestRunHistorySignals: vi.fn(),
  cancelTestRun: vi.fn(),
}));

describe('Sculra Test Runs API Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/test-runs (Create & Queue Test Run)', () => {
    it('should return 401 when user is unauthenticated', async () => {
      const { auth } = await import('@clerk/nextjs/server');
      vi.mocked(auth).mockResolvedValue({ userId: null } as any);

      const req = new NextRequest('http://localhost:3000/api/test-runs', {
        method: 'POST',
        body: JSON.stringify({ projectId: 'proj-1' }),
      });

      const res = await createRunHandler(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toContain('Unauthorized');
    });

    it('should return 404 when project does not exist or access is denied', async () => {
      const { auth } = await import('@clerk/nextjs/server');
      const { getProject } = await import('@/services/db');

      vi.mocked(auth).mockResolvedValue({
        userId: 'user_1',
        orgId: null,
        getToken: vi.fn().mockResolvedValue('token_1'),
      } as any);
      vi.mocked(getProject).mockResolvedValue(null);

      const req = new NextRequest('http://localhost:3000/api/test-runs', {
        method: 'POST',
        body: JSON.stringify({ projectId: 'non-existent' }),
      });

      const res = await createRunHandler(req);
      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.error).toContain('Project not found');
    });

    it('should return 400 when project source type is not website', async () => {
      const { auth } = await import('@clerk/nextjs/server');
      const { getProject } = await import('@/services/db');

      vi.mocked(auth).mockResolvedValue({
        userId: 'user_1',
        orgId: null,
        getToken: vi.fn().mockResolvedValue('token_1'),
      } as any);
      vi.mocked(getProject).mockResolvedValue({
        id: 'proj-github',
        name: 'GitHub Repo',
        type: 'github',
        status: 'passed',
        openIssuesCount: 0,
        releaseScore: 90,
      });

      const req = new NextRequest('http://localhost:3000/api/test-runs', {
        method: 'POST',
        body: JSON.stringify({ projectId: 'proj-github' }),
      });

      const res = await createRunHandler(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('Only website targets are supported');
    });

    it('should reject SSRF target URLs (e.g. AWS metadata endpoint)', async () => {
      const { auth } = await import('@clerk/nextjs/server');
      const { getProject } = await import('@/services/db');

      vi.mocked(auth).mockResolvedValue({
        userId: 'user_1',
        orgId: null,
        getToken: vi.fn().mockResolvedValue('token_1'),
      } as any);
      vi.mocked(getProject).mockResolvedValue({
        id: 'proj-ssrf',
        name: 'SSRF Target',
        type: 'website',
        url: 'http://169.254.169.254/latest/meta-data',
        status: 'passed',
        openIssuesCount: 0,
        releaseScore: 90,
      });

      const req = new NextRequest('http://localhost:3000/api/test-runs', {
        method: 'POST',
        body: JSON.stringify({ projectId: 'proj-ssrf' }),
      });

      const res = await createRunHandler(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('Invalid project URL');
    });

    it('should prevent duplicate runs if an active run is already queued or running', async () => {
      const { auth } = await import('@clerk/nextjs/server');
      const { getProject, getTestRuns } = await import('@/services/db');

      vi.mocked(auth).mockResolvedValue({
        userId: 'user_1',
        orgId: null,
        getToken: vi.fn().mockResolvedValue('token_1'),
      } as any);
      vi.mocked(getProject).mockResolvedValue({
        id: 'proj-1',
        name: 'Sculra Landing',
        type: 'website',
        url: 'https://sculra.com',
        status: 'passed',
        openIssuesCount: 0,
        releaseScore: 95,
      });
      vi.mocked(getTestRuns).mockResolvedValue([
        {
          id: 'run-existing',
          projectId: 'proj-1',
          projectName: 'Sculra Landing',
          status: 'queued',
          issuesCount: 0,
          releaseScore: 0,
          durationMs: 0,
          createdAt: 'Just now',
        },
      ]);

      const req = new NextRequest('http://localhost:3000/api/test-runs', {
        method: 'POST',
        body: JSON.stringify({ projectId: 'proj-1' }),
      });

      const res = await createRunHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.testRunId).toBe('run-existing');
      expect(json.message).toContain('already queued');
    });

    it('should successfully create and queue a new test run for valid website project', async () => {
      const { auth } = await import('@clerk/nextjs/server');
      const { getProject, getTestRuns, createTestRun } = await import('@/services/db');

      vi.mocked(auth).mockResolvedValue({
        userId: 'user_1',
        orgId: 'org_1',
        getToken: vi.fn().mockResolvedValue('token_1'),
      } as any);
      vi.mocked(getProject).mockResolvedValue({
        id: 'proj-valid',
        name: 'Sculra App',
        type: 'website',
        url: 'https://sculra.com',
        status: 'passed',
        openIssuesCount: 0,
        releaseScore: 95,
      });
      vi.mocked(getTestRuns).mockResolvedValue([]);
      vi.mocked(createTestRun).mockResolvedValue({
        id: 'run-new-123',
        status: 'queued',
      });

      const req = new NextRequest('http://localhost:3000/api/test-runs', {
        method: 'POST',
        body: JSON.stringify({ projectId: 'proj-valid' }),
      });

      const res = await createRunHandler(req);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.testRunId).toBe('run-new-123');
      expect(json.status).toBe('queued');
      expect(createTestRun).toHaveBeenCalledWith('token_1', {
        projectId: 'proj-valid',
        clerkUserId: 'user_1',
        clerkOrgId: 'org_1',
        triggerType: 'manual',
      });
    });
  });

  describe('GET /api/test-runs/[id] (Retrieve Test Run & Evidence)', () => {
    it('should return test run details and evidence collection', async () => {
      const { auth } = await import('@clerk/nextjs/server');
      const { getTestRun, getTestEvidence } = await import('@/services/db');

      vi.mocked(auth).mockResolvedValue({
        userId: 'user_1',
        getToken: vi.fn().mockResolvedValue('token_1'),
      } as any);
      vi.mocked(getTestRun).mockResolvedValue({
        id: 'run-123',
        projectId: 'proj-1',
        projectName: 'Sculra App',
        status: 'passed',
        issuesCount: 0,
        releaseScore: 100,
        durationMs: 3400,
        createdAt: 'Just now',
      });
      vi.mocked(getTestEvidence).mockResolvedValue([
        {
          id: 'ev-1',
          testRunId: 'run-123',
          projectId: 'proj-1',
          type: 'screenshot',
          title: 'Viewport Screenshot',
          storagePath: 'screenshots/run-123/shot.png',
          createdAt: 'Just now',
        },
      ]);

      const req = new NextRequest('http://localhost:3000/api/test-runs/run-123');
      const res = await getRunDetailHandler(req, {
        params: Promise.resolve({ id: 'run-123' }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.testRun.id).toBe('run-123');
      expect(json.evidence.length).toBe(1);
    });
  });

  describe('POST /api/test-runs/[id]/cancel (Cancel Active Run)', () => {
    it('should cancel queued or running test runs', async () => {
      const { auth } = await import('@clerk/nextjs/server');
      const { getTestRun, cancelTestRun } = await import('@/services/db');

      vi.mocked(auth).mockResolvedValue({
        userId: 'user_1',
        getToken: vi.fn().mockResolvedValue('token_1'),
      } as any);
      vi.mocked(getTestRun).mockResolvedValue({
        id: 'run-running',
        projectId: 'proj-1',
        projectName: 'Sculra App',
        status: 'running',
        issuesCount: 0,
        releaseScore: null,
        durationMs: 0,
        createdAt: 'Just now',
      });
      vi.mocked(cancelTestRun).mockResolvedValue(true);

      const req = new NextRequest('http://localhost:3000/api/test-runs/run-running/cancel', {
        method: 'POST',
      });
      const res = await cancelRunHandler(req, {
        params: Promise.resolve({ id: 'run-running' }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(cancelTestRun).toHaveBeenCalledWith('token_1', 'run-running');
    });

    it('should reject cancelling already completed runs', async () => {
      const { auth } = await import('@clerk/nextjs/server');
      const { getTestRun } = await import('@/services/db');

      vi.mocked(auth).mockResolvedValue({
        userId: 'user_1',
        getToken: vi.fn().mockResolvedValue('token_1'),
      } as any);
      vi.mocked(getTestRun).mockResolvedValue({
        id: 'run-passed',
        projectId: 'proj-1',
        projectName: 'Sculra App',
        status: 'passed',
        issuesCount: 0,
        releaseScore: 100,
        durationMs: 4000,
        createdAt: 'Just now',
      });

      const req = new NextRequest('http://localhost:3000/api/test-runs/run-passed/cancel', {
        method: 'POST',
      });
      const res = await cancelRunHandler(req, {
        params: Promise.resolve({ id: 'run-passed' }),
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('Cannot cancel test run with final status');
    });
  });
});
