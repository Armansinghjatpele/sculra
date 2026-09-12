// ==============================================================================
// Sculra Multi-Run QA History & Regression E2E Suite (worker/tests/history_e2e.test.ts)
// ==============================================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createFixtureServer, FixtureServer } from './fixtures/app';
import { BrowserRunner } from '../src/runner';
import { HistoricalAnalyzer, HistoricalRun } from '../src/history';

describe('Multi-Run Cross-Run QA Evolution (Runs A -> B -> C -> D -> E)', () => {
  let fixture: FixtureServer;
  const projectId = 'proj-e2e-history';

  beforeAll(async () => {
    fixture = await createFixtureServer();
  });

  afterAll(async () => {
    if (fixture) await fixture.close();
  });

  it(
    'correctly tracks full application lifecycle across 5 consecutive runs',
    async () => {
      // -------------------------------------------------------------------------
      // Run A: Clean Baseline Execution
      // -------------------------------------------------------------------------
      const runnerA = new BrowserRunner('run-a', projectId, {
        allowLocalhost: true,
        enableVisual: false,
        enableAiQa: false,
        enableApiQa: false,
        enableSecurityQa: false,
        enablePerformanceQa: false,
        enableAccessibilityQa: false,
        enableHistoricalAnalysis: false,
        discoveryLimits: {
          maxPages: 2,
          maxDepth: 1,
          maxTotalDiscoveryTimeMs: 5000,
        },
      });
      const resultA = await runnerA.run(`${fixture.url}/`);
      expect(resultA).toBeDefined();
      expect(resultA.durationMs).toBeGreaterThan(0);

    const runARecord: HistoricalRun = {
      testRunId: 'run-a',
      projectId,
      status: 'passed',
      createdAt: '2026-09-01T10:00:00Z',
      targetUrl: `${fixture.url}/`,
      environment: 'staging',
      overallScore: 95,
      findings: [],
      targets: [
        { targetType: 'page', targetIdentifier: `${fixture.url}/`, tested: true, status: 'passed' },
        { targetType: 'page', targetIdentifier: `${fixture.url}/features`, tested: true, status: 'passed' },
      ],
      coverage: {
        pagesDiscovered: 2,
        pagesTested: 2,
        formsDiscovered: 1,
        formsTested: 1,
        buttonsDiscovered: 4,
        buttonsTested: 4,
        linksDiscovered: 6,
        linksTested: 6,
      },
      metrics: { release_score: 95 },
    };

    const compA = await HistoricalAnalyzer.analyze({
      currentRun: runARecord,
      historicalRuns: [],
    });
    expect(compA.summary.comparisonStatus).toBe('BASELINE_MISSING');
    expect(compA.summary.newRegressionsCount).toBe(0);

    // -------------------------------------------------------------------------
    // Run B: Introduce New Regression (Regression Event)
    // -------------------------------------------------------------------------
    const defectB = {
      fingerprint: 'fp-broken-cta-btn',
      title: 'CTA button leads to error page',
      type: 'NAVIGATION_ERROR',
      severity: 'high' as const,
      category: 'functional',
      targetUrl: `${fixture.url}/`,
      selector: '#cta-broken-btn',
      firstSeenAt: '2026-09-02T10:00:00Z',
      lastSeenAt: '2026-09-02T10:00:00Z',
      occurrenceCount: 1,
      consecutiveRunCount: 1,
      historicalStatus: 'CURRENT' as const,
    };

    const runBRecord: HistoricalRun = {
      ...runARecord,
      testRunId: 'run-b',
      createdAt: '2026-09-02T10:00:00Z',
      status: 'failed',
      overallScore: 72,
      findings: [defectB],
      metrics: { release_score: 72 },
    };

    const compB = await HistoricalAnalyzer.analyze({
      currentRun: runBRecord,
      historicalRuns: [runARecord],
    });
    expect(compB.isComparable).toBe(true);
    expect(compB.summary.newRegressionsCount).toBe(1);
    expect(compB.summary.scoreDelta).toBe(-23);
    expect(compB.summary.releaseTrend).toBe('DEGRADING');
    expect(compB.regressions[0].fingerprint).toBe(defectB.fingerprint);

    // -------------------------------------------------------------------------
    // Run C: Defect Persists (Recurrence Event)
    // -------------------------------------------------------------------------
    const runCRecord: HistoricalRun = {
      ...runBRecord,
      testRunId: 'run-c',
      createdAt: '2026-09-03T10:00:00Z',
      overallScore: 72,
      findings: [defectB],
    };

    const compC = await HistoricalAnalyzer.analyze({
      currentRun: runCRecord,
      historicalRuns: [runBRecord, runARecord],
    });
    expect(compC.summary.newRegressionsCount).toBe(0); // Not a NEW regression anymore
    expect(compC.summary.recurringFindingsCount).toBe(1);
    expect(compC.recurrences[0].consecutiveRunCount).toBe(2);

    // -------------------------------------------------------------------------
    // Run D: Fix Deployed & Retested Cleanly (Recovery Event)
    // -------------------------------------------------------------------------
    const runDRecord: HistoricalRun = {
      ...runARecord,
      testRunId: 'run-d',
      createdAt: '2026-09-04T10:00:00Z',
      status: 'passed',
      overallScore: 98,
      findings: [],
      targets: [
        { targetType: 'page', targetIdentifier: `${fixture.url}/`, selector: '#cta-broken-btn', tested: true, status: 'passed' },
      ],
      metrics: { release_score: 98 },
    };

    const compD = await HistoricalAnalyzer.analyze({
      currentRun: runDRecord,
      historicalRuns: [runCRecord, runBRecord, runARecord],
    });
    expect(compD.summary.recoveredFindingsCount).toBe(1);
    expect(compD.recoveries[0].fingerprint).toBe(defectB.fingerprint);
    expect(compD.summary.scoreDelta).toBe(26); // 98 - 72
    expect(compD.summary.releaseTrend).toBe('IMPROVING');

    // -------------------------------------------------------------------------
    // Run E: Target Route NOT Retested (NOT_RETESTED Guarantee)
    // -------------------------------------------------------------------------
    // If defect existed on /features but Run E only visited /second
    const defectFeatures = {
      fingerprint: 'fp-features-defect',
      title: 'Crash in accordion expand',
      type: 'COMPONENT_CRASH',
      severity: 'high' as const,
      category: 'functional',
      targetUrl: `${fixture.url}/features`,
      firstSeenAt: '2026-09-04T10:00:00Z',
      lastSeenAt: '2026-09-04T10:00:00Z',
      occurrenceCount: 1,
      consecutiveRunCount: 1,
      historicalStatus: 'CURRENT' as const,
    };

    const runPrevWithFeatures: HistoricalRun = {
      ...runARecord,
      testRunId: 'run-prev-features',
      createdAt: '2026-09-04T10:00:00Z',
      findings: [defectFeatures],
    };

    const runERecord: HistoricalRun = {
      ...runARecord,
      testRunId: 'run-e',
      createdAt: '2026-09-05T10:00:00Z',
      targetUrl: `${fixture.url}/second`,
      findings: [],
      targets: [
        { targetType: 'page', targetIdentifier: `${fixture.url}/second`, tested: true, status: 'passed' },
      ],
    };

    const compE = await HistoricalAnalyzer.analyze({
      currentRun: runERecord,
      historicalRuns: [runPrevWithFeatures],
    });
    expect(compE.summary.recoveredFindingsCount).toBe(0); // NOT marked recovered!
    expect(compE.summary.notRetestedCount).toBe(1);
    expect(compE.notRetestedFindings[0].fingerprint).toBe(defectFeatures.fingerprint);
    expect(compE.notRetestedFindings[0].historicalStatus).toBe('NOT_RETESTED');
  }, 30000);
});
