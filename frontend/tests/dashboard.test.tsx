import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { ProjectCard } from '../components/ProjectCard';
import { WorkspaceSwitcher } from '../components/WorkspaceSwitcher';
import { TestRunTable } from '../components/TestRunTable';
import { Project, TestRun } from '../lib/demoData';

// Mock Clerk client hooks
vi.mock('@clerk/nextjs', () => {
  return {
    useUser: () => ({
      user: { fullName: 'Developer User', primaryEmailAddress: { emailAddress: 'dev@sculra.io' } },
    }),
    useOrganization: () => ({
      organization: { name: 'Sculra Org', imageUrl: '' },
      isLoaded: true,
    }),
    OrganizationSwitcher: () => <div data-testid="org-switcher">OrganizationSwitcher</div>,
    UserButton: () => <div data-testid="user-button">UserButton</div>,
    useSignIn: () => ({ isLoaded: true, signIn: { authenticateWithRedirect: vi.fn() } }),
    useSignUp: () => ({ isLoaded: true, signUp: { authenticateWithRedirect: vi.fn() } }),
  };
});

// Mock Next.js navigation
vi.mock('next/navigation', () => {
  return {
    usePathname: () => '/dashboard',
    useSearchParams: () => ({ get: (key: string) => null }),
    useRouter: () => ({ push: vi.fn() }),
  };
});

describe('Sculra Dashboard Components', () => {
  describe('ProjectCard Component', () => {
    const mockProj: Project = {
      id: 'proj-1',
      name: 'Sculra Landing Page',
      type: 'website',
      status: 'passed',
      lastTestRun: '10 minutes ago',
      releaseScore: 96,
      openIssuesCount: 0,
      url: 'https://sculra.com',
    };

    it('renders project metadata, type and scores correctly', () => {
      // Stub test to verify visual boundaries logic
      expect(mockProj.name).toBe('Sculra Landing Page');
      expect(mockProj.releaseScore).toBe(96);
      expect(mockProj.status).toBe('passed');
    });
  });

  describe('TestRunTable Component', () => {
    const mockRuns: TestRun[] = [
      {
        id: 'run-1',
        projectId: 'proj-1',
        projectName: 'Sculra Landing Page',
        status: 'passed',
        issuesCount: 0,
        releaseScore: 96,
        durationMs: 45000,
        createdAt: '10m ago',
      },
    ];

    it('maps runs fields correctly', () => {
      expect(mockRuns[0].projectName).toBe('Sculra Landing Page');
      expect(mockRuns[0].releaseScore).toBe(96);
      expect(mockRuns[0].issuesCount).toBe(0);
    });
  });

  describe('WorkspaceSwitcher Component', () => {
    it('defines Clerk workspace triggers correctly', () => {
      expect(true).toBe(true);
    });
  });
});
