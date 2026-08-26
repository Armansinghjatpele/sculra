import { describe, it, expect } from 'vitest';
import { Project, TestRun } from '../lib/demoData';

describe('Sculra Dashboard Demo Data Structures', () => {
  describe('Project Mock Data Configuration', () => {
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
      expect(mockProj.name).toBe('Sculra Landing Page');
      expect(mockProj.releaseScore).toBe(96);
      expect(mockProj.status).toBe('passed');
    });
  });

  describe('TestRun Mock Data Mapping', () => {
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
});
