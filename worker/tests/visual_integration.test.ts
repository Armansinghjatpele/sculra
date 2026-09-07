import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, Browser } from 'playwright';
import { createFixtureServer, FixtureServer } from './fixtures/app';
import {
  STANDARD_VIEWPORTS,
  OverflowDetector,
  OverlapDetector,
  TextOverflowDetector,
  ResponsiveVisualEngine,
} from '../src/visual';
import { IssueManager } from '../src/issues';
import { BugObservation } from '../src/issues/types';

describe('Deterministic Visual & Responsive QA Integration Tests', () => {
  let fixture: FixtureServer;
  let browser: Browser;

  beforeAll(async () => {
    fixture = await createFixtureServer();
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  });

  afterAll(async () => {
    if (browser) await browser.close();
    if (fixture) await fixture.close();
  });

  it('should detect horizontal overflow on broken mobile page', async () => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    await page.goto(`${fixture.url}/broken-overflow`, { waitUntil: 'domcontentloaded' });

    const detector = new OverflowDetector();
    const result = await detector.detect(page, STANDARD_VIEWPORTS.MOBILE, `${fixture.url}/broken-overflow`);

    expect(result.hasHorizontalOverflow).toBe(true);
    expect(result.docScrollWidth).toBeGreaterThan(800);
    expect(result.observations.length).toBeGreaterThanOrEqual(1);

    const overflowObs = result.observations.find((o) => o.type === 'HORIZONTAL_OVERFLOW');
    expect(overflowObs).toBeDefined();
    expect(overflowObs?.overflowAmount).toBeGreaterThan(400);

    await context.close();
  });

  it('should NOT flag intentional horizontal scroll containers as overflow bugs', async () => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    await page.goto(`${fixture.url}/responsive-scroll`, { waitUntil: 'domcontentloaded' });

    const detector = new OverflowDetector();
    const result = await detector.detect(page, STANDARD_VIEWPORTS.MOBILE, `${fixture.url}/responsive-scroll`);

    // Intentional scroll container should NOT produce a horizontal layout overflow bug
    const overflowObs = result.observations.filter((o) => o.type === 'HORIZONTAL_OVERFLOW');
    expect(overflowObs.length).toBe(0);

    await context.close();
  });

  it('should detect clipped interactive buttons inside overflow:hidden containers', async () => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    await page.goto(`${fixture.url}/clipped-button`, { waitUntil: 'domcontentloaded' });

    const detector = new OverflowDetector();
    const result = await detector.detect(page, STANDARD_VIEWPORTS.DESKTOP, `${fixture.url}/clipped-button`);

    const clippedObs = result.observations.find((o) => o.type === 'CONTENT_CLIPPED');
    expect(clippedObs).toBeDefined();
    expect(clippedObs?.selector).toContain('severely-clipped-btn');

    await context.close();
  });

  it('should detect geometric overlap between unrelated interactive controls', async () => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    await page.goto(`${fixture.url}/overlapping-controls`, { waitUntil: 'domcontentloaded' });

    const detector = new OverlapDetector();
    const observations = await detector.detect(page, STANDARD_VIEWPORTS.DESKTOP, `${fixture.url}/overlapping-controls`);

    expect(observations.length).toBeGreaterThanOrEqual(1);
    const overlapObs = observations.find((o) => o.type === 'ELEMENT_OVERLAP');
    expect(overlapObs).toBeDefined();
    expect(overlapObs?.overlapArea).toBeGreaterThan(100);

    await context.close();
  });

  it('should detect unhandled text overflow without ellipsis', async () => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    await page.goto(`${fixture.url}/text-overflow`, { waitUntil: 'domcontentloaded' });

    const detector = new TextOverflowDetector();
    const observations = await detector.detect(page, STANDARD_VIEWPORTS.DESKTOP, `${fixture.url}/text-overflow`);

    const textObs = observations.find((o) => o.type === 'TEXT_OVERFLOW');
    expect(textObs).toBeDefined();
    expect(textObs?.selector).toContain('unhandled-text-overflow-btn');

    await context.close();
  });

  it('should harden IssueManager against concurrent insert race conditions', async () => {
    const savedIssues: any[] = [];
    const savedOccurrences: any[] = [];

    // Mock Supabase with unique constraint simulation on (project_id, fingerprint)
    const mockSupabase: any = {
      from: (table: string) => {
        if (table === 'issues') {
          return {
            select: () => {
              const chain: any = {
                eq: (col: string, val: string) => {
                  if (col === 'fingerprint') {
                    const match = savedIssues.find((i) => i.fingerprint === val);
                    return {
                      limit: async () => ({ data: match ? [match] : [], error: null }),
                      single: async () => ({ data: match || null, error: null }),
                      maybeSingle: async () => ({ data: match || null, error: null }),
                    };
                  }
                  return chain;
                },
                limit: async () => ({ data: [], error: null }),
                single: async () => ({ data: null, error: null }),
                maybeSingle: async () => ({ data: null, error: null }),
              };
              return chain;
            },
            insert: (issueRow: any) => ({
              select: () => ({
                single: async () => {
                  const exists = savedIssues.find(
                    (i) => i.project_id === issueRow.project_id && i.fingerprint === issueRow.fingerprint
                  );
                  if (exists) {
                    // Simulate PostgreSQL 23505 unique constraint violation
                    return {
                      data: null,
                      error: { code: '23505', message: 'duplicate key value violates unique constraint' },
                    };
                  }
                  const saved = { id: `issue-${savedIssues.length + 1}`, ...issueRow };
                  savedIssues.push(saved);
                  return { data: saved, error: null };
                },
              }),
            }),
            update: (updateFields: any) => ({
              eq: async (_col: string, val: string) => {
                const target = savedIssues.find((i) => i.id === val);
                if (target) {
                  Object.assign(target, updateFields);
                }
                return { data: target, error: null };
              },
            }),
          };
        }

        if (table === 'issue_occurrences') {
          return {
            insert: async (occRow: any) => {
              savedOccurrences.push(occRow);
              return { data: occRow, error: null };
            },
          };
        }

        return {};
      },
    };

    const bug: BugObservation = {
      id: 'bug-1',
      testRunId: 'run-1',
      projectId: 'proj-1',
      type: 'LAYOUT_DEFECT',
      severity: 'high',
      confidence: 'high',
      status: 'open',
      title: 'Simulated Layout Defect',
      summary: 'Summary',
      description: 'Description',
      url: 'http://localhost/test',
      fingerprint: 'stable-sha256-fingerprint-concurrency-test',
      timestamp: new Date().toISOString(),
      reproductionSteps: [],
    };

    const manager1 = new IssueManager();
    const manager2 = new IssueManager();

    // Run two simultaneous persistBugs calls
    const [res1, res2] = await Promise.all([
      manager1.persistBugs(mockSupabase, [bug], 'run-1', 'proj-1'),
      manager2.persistBugs(mockSupabase, [bug], 'run-2', 'proj-1'),
    ]);

    // Exactly 1 issue created in database, 2 occurrences recorded!
    expect(savedIssues.length).toBe(1);
    expect(savedOccurrences.length).toBe(2);
    expect(savedIssues[0].occurrence_count).toBe(2);
  });
});
