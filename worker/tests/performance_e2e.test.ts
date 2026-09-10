// ==============================================================================
// End-to-End Integration Test: Performance & Reliability Autonomous QA
// (worker/tests/performance_e2e.test.ts)
// ==============================================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { createFixtureServer, FixtureServer } from './fixtures/app';
import { PerformanceScanner } from '../src/performance/scanner';
import { DEFAULT_PERFORMANCE_POLICY } from '../src/performance/policy';
import { DeterministicReleaseScorer } from '../src/release/scorer';
import { BrowserRunner } from '../src/runner';
import { WorkerLogger } from '../src/logger';

describe('Performance & Reliability Autonomous QA E2E', () => {
  let fixture: FixtureServer;
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;

  beforeAll(async () => {
    fixture = await createFixtureServer();
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    page = await context.newPage();
  }, 60000);

  afterAll(async () => {
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    if (fixture) await fixture.close();
  }, 60000);

  it('runs PerformanceScanner across local fixture endpoints and produces deterministic telemetry', async () => {
    const logger = new WorkerLogger('perf-test-run-1');
    const scanner = new PerformanceScanner(
      {
        ...DEFAULT_PERFORMANCE_POLICY,
        maxPerformanceChecks: 25,
        thresholds: {
          ...DEFAULT_PERFORMANCE_POLICY.thresholds,
          apiDurationMs: { good: 50, poor: 100 },
          maxResourceSizeBytes: 100 * 1024, // 100KB (fixture large resource is 600KB)
        },
      },
      logger
    );

    const scanResult = await scanner.scan({
      testRunId: 'perf-test-run-1',
      projectId: 'proj-perf-1',
      targetUrl: fixture.url,
      page,
      browserContext: context,
      applicationMap: {
        startUrl: fixture.url,
        discoveredAt: new Date().toISOString(),
        totalPages: 2,
        totalLinks: 2,
        totalButtons: 2,
        totalForms: 0,
        totalInputs: 0,
        pages: [
          {
            url: `${fixture.url}/perf/slow-page`,
            title: 'Slow Page',
            depth: 1,
            elementsCount: 2,
            elements: [],
            forms: [],
            links: [],
            consoleErrors: [],
            networkErrors: [],
            timestamp: new Date().toISOString(),
          },
          {
            url: `${fixture.url}/perf/page-with-resources`,
            title: 'Page with Resources',
            depth: 1,
            elementsCount: 2,
            elements: [],
            forms: [],
            links: [],
            consoleErrors: [],
            networkErrors: [],
            timestamp: new Date().toISOString(),
          },
        ],
      },
      apiEndpoints: [
        {
          id: 'ep-slow-api',
          path: '/api/perf/slow-endpoint',
          url: `${fixture.url}/api/perf/slow-endpoint`,
          method: 'GET',
          source: 'APPLICATION_MAP',
          firstSeen: '',
          lastSeen: '',
          confidence: 1,
        },
        {
          id: 'ep-large-resource',
          path: '/api/perf/large-resource',
          url: `${fixture.url}/api/perf/large-resource`,
          method: 'GET',
          source: 'APPLICATION_MAP',
          firstSeen: '',
          lastSeen: '',
          confidence: 1,
        },
      ],
      allowLocalhost: true,
      logger,
    });

    expect(scanResult.coverage.targetsTested).toBeGreaterThan(0);
    expect(scanResult.coverage.totalMeasurements).toBeGreaterThan(0);
    expect(scanResult.navigations.length).toBeGreaterThan(0);

    // Verify slow API detection
    const slowApiFinding = scanResult.findings.find(
      (f) => f.type === 'PERFORMANCE_API_SLOW' && f.targetUrl.includes('/api/perf/slow-endpoint')
    );
    expect(slowApiFinding).toBeDefined();

    // Verify oversized resource detection
    const largeResFinding = scanResult.findings.find(
      (f) => f.type === 'PERFORMANCE_RESOURCE_LARGE' && f.evidenceSummary?.includes('/api/perf/large-resource')
    );
    expect(largeResFinding).toBeDefined();
  });

  it('incorporates performance scan result into Release Readiness scoring and Blocker 9', () => {
    const mockPerfResult = {
      testRunId: 'perf-scorer-run',
      projectId: 'proj-1',
      targetUrl: 'http://localhost/app',
      scanTimestamp: new Date().toISOString(),
      coverage: {
        targetsDiscovered: 4,
        targetsTested: 4,
        pagesMeasured: 2,
        apisMeasured: 2,
        actionsMeasured: 0,
        totalMeasurements: 8,
        findingsCount: 2,
        criticalFindings: 1,
        highFindings: 1,
        mediumFindings: 0,
        lowFindings: 0,
        regressionsCount: 1,
        performanceScore: 45,
        durationMs: 1200,
      },
      findings: [
        {
          id: 'perf-finding-crit-1',
          type: 'PERFORMANCE_REGRESSION' as const,
          category: 'REGRESSION' as const,
          severity: 'critical' as const,
          confidence: 'high' as const,
          targetUrl: 'http://localhost/checkout',
          targetPath: '/checkout',
          metric: 'pageLoad',
          observedValue: '1450ms',
          thresholdValue: '1000ms',
          title: 'Critical Performance Regression: pageLoad (+45%)',
          summary: 'pageLoad degraded by +45% compared to historical baseline on critical workflow.',
          whyItMatters: 'Regressions directly degrade customer conversion and satisfaction.',
          remediationRecommendation: 'Optimize page bundle and server response time.',
          evidenceSummary: 'pageLoad degraded from 1000ms to 1450ms (+45%).',
          fingerprint: 'perf_reg_checkout_123',
          detectedAt: new Date().toISOString(),
        },
        {
          id: 'perf-finding-high-1',
          type: 'PERFORMANCE_API_SLOW' as const,
          category: 'LATENCY' as const,
          severity: 'high' as const,
          confidence: 'high' as const,
          targetUrl: 'http://localhost/api/search',
          targetPath: '/api/search',
          metric: 'ApiDuration',
          observedValue: '2400ms',
          thresholdValue: '1000ms',
          title: 'Slow API Endpoint: GET /api/search (2400ms)',
          summary: 'API endpoint exceeded latency threshold.',
          whyItMatters: 'Slow API delays client rendering.',
          remediationRecommendation: 'Add database indexes.',
          evidenceSummary: 'GET /api/search took 2400ms.',
          fingerprint: 'perf_api_search_123',
          detectedAt: new Date().toISOString(),
        },
      ],
      bugObservations: [],
      navigations: [],
      webVitals: [],
      network: [],
      resources: [],
      actions: [],
      reliability: [],
      baselines: [],
    };

    const assessment = DeterministicReleaseScorer.calculateAssessment({
      testRunId: 'perf-scorer-run',
      projectId: 'proj-1',
      testRunStatus: 'passed',
      targetUrl: 'http://localhost/app',
      performanceResult: mockPerfResult,
    });

    expect(assessment.scores.performance).toBeDefined();
    expect(assessment.scores.performance).toBeLessThan(60);
    expect(assessment.breakdown.performance).toBeDefined();
    expect(assessment.breakdown.performance?.slowApisCount).toBe(1);
    expect(assessment.breakdown.performance?.regressionsCount).toBe(1);

    // Critical performance regression must trigger Blocker 9 and DO_NOT_RELEASE
    const perfBlocker = assessment.blockers.find((b) => b.category === 'performance');
    expect(perfBlocker).toBeDefined();
    expect(perfBlocker?.severity).toBe('critical');
    expect(assessment.overallScore).toBeLessThanOrEqual(59);
    expect(assessment.recommendation).toBe('DO_NOT_RELEASE');
  });

  it('runs complete BrowserRunner flow and generates performance result telemetry', async () => {
    const runner = new BrowserRunner('runner-perf-e2e', 'proj-1', {
      allowLocalhost: true,
      headless: true,
      enableDiscovery: true,
      enableJourneys: false,
      enableVisual: false,
      enableAiQa: false,
      enableSecurityQa: false,
      enablePerformanceQa: true,
    });

    const result = await runner.run(`${fixture.url}/perf/page-with-resources`);

    expect(['passed', 'failed']).toContain(result.status);
    expect(result.performanceResult).toBeDefined();
    expect(result.performanceResult?.coverage.targetsDiscovered).toBeGreaterThan(0);
    expect(result.performanceFindings).toBeDefined();
  }, 25000);
});
