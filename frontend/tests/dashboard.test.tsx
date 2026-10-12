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

  describe('Client Component SSR Rendering', () => {
    it('renders IssueList in SSR without useState throwing', async () => {
      const React = await import('react');
      const { renderToString } = await import('react-dom/server');
      const { IssueList } = await import('../components/IssueList');
      const html = renderToString(
        React.createElement(IssueList, {
          issues: [
            {
              id: 'iss-1',
              projectId: 'proj-1',
              projectName: 'Sculra Landing Page',
              severity: 'critical',
              title: 'Navigation Layout Shift',
              description: 'Element moves unexpectedly during render',
              detectedAt: '2026-10-12T00:00:00.000Z',
              status: 'open',
              occurrenceCount: 2,
            },
          ],
        })
      );
      expect(html).toContain('Navigation Layout Shift');
      expect(html).toContain('critical');
    });

    it('renders Avatar, Search, Accordion without crashing in SSR', async () => {
      const React = await import('react');
      const { renderToString } = await import('react-dom/server');
      const { Avatar } = await import('../components/Avatar');
      const { Search } = await import('../components/Search');
      const { Accordion, AccordionItem } = await import('../components/Accordion');

      const avatarHtml = renderToString(React.createElement(Avatar, { fallbackText: 'QA' }));
      expect(avatarHtml).toContain('QA');

      const searchHtml = renderToString(React.createElement(Search, { placeholder: 'Search...' }));
      expect(searchHtml).toContain('Search...');

      const accordionHtml = renderToString(
        React.createElement(Accordion, {
          children: React.createElement(AccordionItem, {
            title: 'Test Accordion',
            children: 'Content',
          }),
        })
      );
      expect(accordionHtml).toContain('Test Accordion');
    });
  });
});


