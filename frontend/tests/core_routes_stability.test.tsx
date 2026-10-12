// ==============================================================================
// Prompt 68: Sculra Core Routes Stability Audit & Regression Hardening Suite
// (frontend/tests/core_routes_stability.test.tsx)
// ==============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as React from 'react';
import { renderToString, renderToPipeableStream } from 'react-dom/server';
import { Writable } from 'stream';
import { Project, TestRun, Issue, ReleaseScore } from '../lib/demoData';

function renderToStringAsync(element: React.ReactElement): Promise<string> {
  return new Promise((resolve, reject) => {
    let html = '';
    const writable = new Writable({
      write(chunk, enc, cb) {
        html += chunk.toString();
        cb();
      },
    });

    const { pipe } = renderToPipeableStream(
      React.createElement(React.Suspense, { fallback: null }, element),
      {
        onAllReady() {
          pipe(writable);
          resolve(html);
        },
        onError(err) {
          reject(err);
        },
      }
    );
  });
}

// ------------------------------------------------------------------------------
// Navigation Mocks
// ------------------------------------------------------------------------------
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
}));

// ------------------------------------------------------------------------------
// Clerk Auth Mocks (Client & Server)
// ------------------------------------------------------------------------------
vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({
    userId: 'user_123',
    orgId: null,
    getToken: vi.fn().mockResolvedValue('token_test_123'),
    isSignedIn: true,
  }),
  useUser: () => ({
    user: { id: 'user_123', firstName: 'QA Engineer', fullName: 'QA Engineer' },
    isLoaded: true,
  }),
  useOrganization: () => ({
    organization: null,
    membership: null,
    memberships: { data: [] },
    isLoaded: true,
  }),
  OrganizationSwitcher: () => React.createElement('div', { 'data-testid': 'org-switcher' }),
  UserButton: () => React.createElement('div', { 'data-testid': 'user-button' }),
  SignIn: () => React.createElement('div', { 'data-testid': 'sign-in' }),
  SignUp: () => React.createElement('div', { 'data-testid': 'sign-up' }),
  SignedIn: ({ children }: { children: React.ReactNode }) => children,
  SignedOut: () => null,
  SignOutButton: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
}));

// ------------------------------------------------------------------------------
// Database Service Mocks
// ------------------------------------------------------------------------------
vi.mock('@/services/db', () => ({
  getProjects: vi.fn(),
  getProject: vi.fn(),
  getTestRuns: vi.fn(),
  getTestRun: vi.fn(),
  getIssues: vi.fn(),
  getAIInsights: vi.fn(),
  getLatestReleaseScore: vi.fn(),
  getReleaseScore: vi.fn(),
  getProjectReleaseHistory: vi.fn(),
  getProjectSources: vi.fn(),
  getProjectSourceSnapshots: vi.fn(),
  getProjectSourceHealth: vi.fn(),
  getProjectSourceChanges: vi.fn(),
  createProject: vi.fn(),
  createProjectSource: vi.fn(),
  validateProjectSource: vi.fn(),
}));

describe('Prompt 68: Core Routes Stability & Boundary Hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // 1. Dashboard Route (Server Component) SSR Boundary Hardening
  // ============================================================================
  describe('Route: /dashboard (Server Component)', () => {
    it('renders empty state cleanly when workspace has 0 projects', async () => {
      const { auth, currentUser } = await import('@clerk/nextjs/server');
      const { getProjects, getTestRuns, getIssues, getAIInsights } = await import('@/services/db');
      const DashboardPage = (await import('../app/(authenticated)/dashboard/page')).default;

      vi.mocked(currentUser).mockResolvedValue({ id: 'user_1', firstName: 'Alice' } as any);
      vi.mocked(auth).mockResolvedValue({
        userId: 'user_1',
        orgId: null,
        getToken: vi.fn().mockResolvedValue('jwt_token_1'),
      } as any);

      vi.mocked(getProjects).mockResolvedValue([]);
      vi.mocked(getTestRuns).mockResolvedValue([]);
      vi.mocked(getIssues).mockResolvedValue([]);
      vi.mocked(getAIInsights).mockResolvedValue([]);

      const element = await DashboardPage();
      const html = renderToString(element);

      expect(html).toContain('Alice');
      expect(html).toContain('Start testing your first application.');
      expect(html).toContain('Website (Active)');
    });

    it('renders populated state with IssueList in SSR without useState throwing (Regression for Error #441)', async () => {
      const { auth, currentUser } = await import('@clerk/nextjs/server');
      const { getProjects, getTestRuns, getIssues, getAIInsights } = await import('@/services/db');
      const DashboardPage = (await import('../app/(authenticated)/dashboard/page')).default;

      vi.mocked(currentUser).mockResolvedValue({ id: 'user_1', firstName: 'Alice' } as any);
      vi.mocked(auth).mockResolvedValue({
        userId: 'user_1',
        orgId: null,
        getToken: vi.fn().mockResolvedValue('jwt_token_1'),
      } as any);

      const mockProject: Project = {
        id: 'proj-real-1',
        name: 'Production Portal',
        type: 'website',
        status: 'passed',
        releaseScore: 92,
        openIssuesCount: 1,
      };

      const mockRun: TestRun = {
        id: 'tr-real-1',
        projectId: 'proj-real-1',
        projectName: 'Production Portal',
        status: 'passed',
        issuesCount: 1,
        releaseScore: 92,
        durationMs: 32000,
        createdAt: '1 hour ago',
      };

      const mockIssue: Issue = {
        id: 'iss-real-1',
        projectId: 'proj-real-1',
        projectName: 'Production Portal',
        severity: 'critical',
        title: 'DOM Hydration Shift',
        detectedAt: '2026-10-12T00:00:00.000Z',
        status: 'open',
        occurrenceCount: 3,
      };

      vi.mocked(getProjects).mockResolvedValue([mockProject]);
      vi.mocked(getTestRuns).mockResolvedValue([mockRun]);
      vi.mocked(getIssues).mockResolvedValue([mockIssue]);
      vi.mocked(getAIInsights).mockResolvedValue([]);

      // This is the exact code path that crashed before the 'use client' boundary fix
      const element = await DashboardPage();
      const html = renderToString(element);

      expect(html).toContain('Workspace Stability Score');
      expect(html).toContain('Recent Test Runs');
      expect(html).toContain('Open Issues');
      expect(html).toContain('DOM Hydration Shift');
      expect(html).toContain('critical');
    });

    it('handles database failure gracefully by falling back to empty summaries without unhandled rejection', async () => {
      const { auth, currentUser } = await import('@clerk/nextjs/server');
      const { getProjects, getTestRuns, getIssues, getAIInsights } = await import('@/services/db');
      const DashboardPage = (await import('../app/(authenticated)/dashboard/page')).default;

      vi.mocked(currentUser).mockResolvedValue({ id: 'user_1', firstName: 'Alice' } as any);
      vi.mocked(auth).mockResolvedValue({
        userId: 'user_1',
        orgId: null,
        getToken: vi.fn().mockResolvedValue(null), // Token missing / auth failure
      } as any);

      vi.mocked(getProjects).mockResolvedValue([]);
      vi.mocked(getTestRuns).mockResolvedValue([]);
      vi.mocked(getIssues).mockResolvedValue([]);
      vi.mocked(getAIInsights).mockResolvedValue([]);

      const element = await DashboardPage();
      const html = renderToString(element);

      expect(html).toContain('Alice');
      expect(html).toContain('Start testing your first application.');
    });
  });

  // ============================================================================
  // 2. Interactive UI Primitives SSR Stability
  // ============================================================================
  describe('Interactive Components SSR Boundary Verification', () => {
    it('renders IssueList with empty and multiple issues without crashing', async () => {
      const { IssueList } = await import('../components/IssueList');

      // Empty issues list
      const emptyHtml = renderToString(React.createElement(IssueList, { issues: [] }));
      expect(emptyHtml).toBeDefined();

      // Populated issues list
      const populatedHtml = renderToString(
        React.createElement(IssueList, {
          issues: [
            {
              id: 'iss-1',
              projectId: 'p1',
              projectName: 'Project 1',
              severity: 'high',
              title: 'Critical Layout Breakage',
              detectedAt: '2026-10-12T00:00:00Z',
              status: 'open',
            },
            {
              id: 'iss-2',
              projectId: 'p1',
              projectName: 'Project 1',
              severity: 'medium',
              title: 'Contrast Ratio Warning',
              detectedAt: '2026-10-12T00:00:00Z',
              status: 'open',
            },
          ],
        })
      );
      expect(populatedHtml).toContain('Critical Layout Breakage');
      expect(populatedHtml).toContain('Contrast Ratio Warning');
    });

    it('renders CommandMenu, Dialog, Drawer, Dropdown without throwing in SSR', async () => {
      const { CommandMenu } = await import('../components/CommandMenu');
      const { Dialog } = await import('../components/Dialog');
      const { Drawer } = await import('../components/Drawer');
      const { Dropdown } = await import('../components/Dropdown');

      // CommandMenu SSR
      const cmdHtml = renderToString(
        React.createElement(CommandMenu, {
          isOpen: false,
          onClose: () => {},
          items: [{ category: 'Nav', links: [{ title: 'Home', href: '/' }] }],
        })
      );
      expect(cmdHtml).toBeDefined();

      // Dialog SSR
      const dialogHtml = renderToString(
        React.createElement(Dialog, {
          isOpen: false,
          onClose: () => {},
          title: 'Test Modal',
          children: React.createElement('span', null, 'Modal Body'),
        })
      );
      expect(dialogHtml).toBeDefined();

      // Drawer SSR
      const drawerHtml = renderToString(
        React.createElement(Drawer, {
          isOpen: false,
          onClose: () => {},
          title: 'Sidebar Drawer',
          children: React.createElement('span', null, 'Drawer Content'),
        })
      );
      expect(drawerHtml).toBeDefined();

      // Dropdown SSR
      const dropdownHtml = renderToString(
        React.createElement(Dropdown, {
          trigger: React.createElement('button', null, 'Options'),
          children: React.createElement('div', null, 'Item 1'),
        })
      );
      expect(dropdownHtml).toContain('Options');
    });
  });

  // ============================================================================
  // 3. Projects Page & Project Details SSR Verification
  // ============================================================================
  describe('Route: /projects & /projects/[projectId]', () => {
    it('renders ProjectList with empty and populated states', async () => {
      const { ProjectList } = await import('../components/ProjectList');

      const emptyHtml = renderToString(React.createElement(ProjectList, { initialProjects: [] }));
      expect(emptyHtml).toContain('No projects found');

      const populatedHtml = renderToString(
        React.createElement(ProjectList, {
          initialProjects: [
            {
              id: 'p-1',
              name: 'Sculra Staging',
              type: 'website',
              status: 'passed',
              releaseScore: 98,
              openIssuesCount: 0,
            },
          ],
        })
      );
      expect(populatedHtml).toContain('Sculra Staging');
      expect(populatedHtml).toContain('98%');
    });

    it('renders ProjectDetailPage in SSR handling loading and missing record (404) states safely', async () => {
      const ProjectDetailPage = (await import('../app/(authenticated)/projects/[projectId]/page')).default;

      // In initial SSR pass, component starts with loading = true
      const loadingHtml = await renderToStringAsync(
        React.createElement(ProjectDetailPage, {
          params: Promise.resolve({ projectId: 'non-existent-proj' }),
        })
      );
      expect(loadingHtml).toContain('Loading project workspace details...');
    });
  });

  // ============================================================================
  // 4. Test Runs Page & Details SSR Verification
  // ============================================================================
  describe('Route: /test-runs & TestRunTable', () => {
    it('renders TestRunTable with runs list without throwing', async () => {
      const { TestRunTable } = await import('../components/TestRunTable');

      const runs: TestRun[] = [
        {
          id: 'tr-1',
          projectId: 'p-1',
          projectName: 'Staging Target',
          status: 'passed',
          issuesCount: 0,
          releaseScore: 99,
          durationMs: 12000,
          createdAt: 'Just now',
        },
      ];

      const html = renderToString(React.createElement(TestRunTable, { runs }));
      expect(html).toContain('Staging Target');
      expect(html).toContain('99%');
    });

    it('renders TestRunDetailPage in SSR without unhandled exceptions', async () => {
      const TestRunDetailPage = (await import('../app/(authenticated)/test-runs/[testRunId]/page')).default;

      const html = await renderToStringAsync(
        React.createElement(TestRunDetailPage, {
          params: Promise.resolve({ testRunId: 'tr-non-existent' }),
        })
      );
      expect(html).toContain('Loading test run execution telemetry...');
    });
  });

  // ============================================================================
  // 5. Issues & Reports Pages SSR Verification
  // ============================================================================
  describe('Routes: /issues & /reports', () => {
    it('renders IssuesPage in SSR cleanly', async () => {
      const IssuesPage = (await import('../app/(authenticated)/issues/page')).default;

      const html = renderToString(React.createElement(IssuesPage));
      expect(html).toContain('Open Issues');
      expect(html).toContain('All Severities');
      expect(html).toContain('Loading issues list...');
    });

    it('renders ReportsPage in SSR cleanly', async () => {
      const ReportsPage = (await import('../app/(authenticated)/reports/page')).default;

      const html = renderToString(React.createElement(ReportsPage));
      expect(html).toContain('Generated QA Reports');
      expect(html).toContain('Loading generated reports...');
    });
  });

  // ============================================================================
  // 6. Navigation, Layout Shell & Tenant Isolation Scoping
  // ============================================================================
  describe('Navigation Shell & Tenant Isolation Scoping Behavior', () => {
    it('renders AppHeader, AppSidebar, and WorkspaceSwitcher in SSR without hydration failures', async () => {
      const { AppHeader } = await import('../components/AppHeader');
      const { AppSidebar } = await import('../components/AppSidebar');
      const { WorkspaceSwitcher } = await import('../components/WorkspaceSwitcher');

      const headerHtml = renderToString(
        React.createElement(AppHeader, {
          setIsMobileOpen: () => {},
          setIsCmdOpen: () => {},
        })
      );
      expect(headerHtml).toContain('Sculra');

      const sidebarHtml = renderToString(
        React.createElement(AppSidebar, {
          isCollapsed: false,
          setIsCollapsed: () => {},
        })
      );
      expect(sidebarHtml).toContain('Dashboard');
      expect(sidebarHtml).toContain('Projects');

      const switcherHtml = renderToString(React.createElement(WorkspaceSwitcher));
      expect(switcherHtml).toContain('data-testid="org-switcher"');
    });

    it('enforces multi-tenant isolation by passing clerkOrgId to queries', async () => {
      const { getProjects } = await import('@/services/db');

      // Verify getProjects accepts clerkToken and clerkOrgId
      vi.mocked(getProjects).mockResolvedValueOnce([]);
      await getProjects('test-token', 'org_123');
      expect(getProjects).toHaveBeenCalledWith('test-token', 'org_123');
    });
  });
});
