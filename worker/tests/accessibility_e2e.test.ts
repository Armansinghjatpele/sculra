import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, Browser } from 'playwright';
import { createFixtureServer, FixtureServer } from './fixtures/app';
import { AccessibilityScanner } from '../src/accessibility/scanner';
import { WorkerLogger } from '../src/logger';

describe('Accessibility QA Engine — Live Playwright E2E', () => {
  let fixture: FixtureServer;
  let browser: Browser;
  let logger: WorkerLogger;

  beforeAll(async () => {
    fixture = await createFixtureServer();
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    logger = new WorkerLogger('test-a11y-e2e');
  }, 30000);

  afterAll(async () => {
    if (browser) await browser.close();
    if (fixture) await fixture.close();
  });

  it('scans an accessible page and produces 100 score with zero defects', async () => {
    const targetUrl = `${fixture.url}/a11y/accessible`;
    const scanner = new AccessibilityScanner({}, logger);

    const result = await scanner.scan({
      testRunId: 'run-a11y-clean',
      projectId: 'proj-clean',
      targetUrl,
      browser,
      allowLocalhost: true,
      logger,
    });

    expect(result.coverage.totalChecks).toBeGreaterThan(0);
    expect(result.coverage.criticalFindings).toBe(0);
    expect(result.coverage.highFindings).toBe(0);
    expect(result.coverage.accessibilityScore).toBe(100);
    expect(result.findings.filter(f => f.severity === 'critical' || f.severity === 'high').length).toBe(0);
  }, 30000);

  it('scans an inaccessible page and deterministically catches WCAG defects', async () => {
    const targetUrl = `${fixture.url}/a11y/defects`;
    const scanner = new AccessibilityScanner({}, logger);

    const result = await scanner.scan({
      testRunId: 'run-a11y-defects',
      projectId: 'proj-defects',
      targetUrl,
      browser,
      allowLocalhost: true,
      logger,
    });

    expect(result.findings.length).toBeGreaterThan(0);
    expect(result.coverage.totalChecks).toBeGreaterThan(0);

    const findingTypes = result.findings.map(f => f.type);
    expect(findingTypes).toContain('CONTRAST_FAILURE');
    expect(findingTypes).toContain('EMPTY_BUTTON_NAME');
    expect(findingTypes).toContain('INPUT_MISSING_LABEL');
    expect(findingTypes).toContain('IMAGE_MISSING_ALT');
    expect(findingTypes).toContain('ARIA_ROLE_INVALID');
    expect(findingTypes).toContain('ARIA_HIDDEN_FOCUSABLE');
    expect(findingTypes).toContain('HEADING_HIERARCHY_ERROR');
    expect(findingTypes).toContain('MISSING_MAIN_LANDMARK');
    expect(findingTypes).toContain('TOUCH_TARGET_TOO_SMALL');

    expect(result.coverage.accessibilityScore).toBeDefined();
    expect(result.coverage.accessibilityScore!).toBeLessThan(70);
    expect(result.bugObservations.length).toBeGreaterThan(0);
  }, 30000);
});
