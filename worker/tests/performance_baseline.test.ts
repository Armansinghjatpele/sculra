// ==============================================================================
// Unit Test: Performance Baseline & Regressions (worker/tests/performance_baseline.test.ts)
// ==============================================================================

import { describe, it, expect } from 'vitest';
import { PerformanceBaselineManager } from '../src/performance/baseline';
import { PerformanceFindingAnalyzer } from '../src/performance/analyzer';
import { DEFAULT_PERFORMANCE_POLICY } from '../src/performance/policy';
import { NavigationPerformance } from '../src/performance/types';
import { DeterministicReleaseScorer } from '../src/release/scorer';

describe('PerformanceBaselineManager', () => {
  it('generates deterministic composite target keys', () => {
    const key = PerformanceBaselineManager.generateTargetKey({
      type: 'PAGE',
      path: '/checkout',
      method: 'GET',
      viewport: 'desktop',
      role: 'ANONYMOUS',
    });

    expect(key).toBe('PAGE:GET:/checkout:desktop:ANONYMOUS');
  });

  it('detects severe regressions when metrics degrade beyond the regression threshold (>= 15%)', () => {
    const regression = PerformanceBaselineManager.evaluateRegression({
      metric: 'pageLoad',
      currentValue: 1400,
      baselineValue: 1000,
      isCriticalWorkflow: true,
      policy: DEFAULT_PERFORMANCE_POLICY,
    });

    expect(regression.isRegression).toBe(true);
    expect(regression.percentageDelta).toBe(40);
    expect(regression.absoluteDelta).toBe(400);
    expect(regression.severity).toBe('high');
  });

  it('reports isRegression: false for mild variations below regression threshold', () => {
    const regression = PerformanceBaselineManager.evaluateRegression({
      metric: 'pageLoad',
      currentValue: 1050,
      baselineValue: 1000,
      isCriticalWorkflow: false,
      policy: DEFAULT_PERFORMANCE_POLICY,
    });

    expect(regression.isRegression).toBe(false);
    expect(regression.percentageDelta).toBe(5);
  });
});

describe('PerformanceFindingAnalyzer', () => {
  it('translates measurements and regressions into deterministic findings and bug observations', () => {
    const navigation: NavigationPerformance = {
      targetUrl: 'http://localhost/slow-page',
      path: '/slow-page',
      viewport: 'desktop',
      timestamp: new Date().toISOString(),
      status: 'SUCCESS',
      durationMs: 7000, // > 6000ms poor threshold
      dnsDurationMs: 20,
      connectDurationMs: 30,
      ttfbMs: 2500, // > 1800ms poor threshold
      responseDurationMs: 50,
      domContentLoadedMs: 4500, // > 4000ms poor threshold
      loadEventMs: 7000,
      firstPaintMs: 2000,
      fcpMs: 3500, // > 3000ms poor threshold
      lcpMs: 5200,
      transferSizeBytes: 50000,
      encodedBodySizeBytes: 40000,
      decodedBodySizeBytes: 150000,
      metricDetails: {},
    };

    const vitals = {
      targetUrl: 'http://localhost/slow-page',
      path: '/slow-page',
      viewport: 'desktop' as const,
      timestamp: new Date().toISOString(),
      lcp: { metric: 'LCP', value: 5200, unit: 'ms' as const, availability: 'measured' as const, rating: 'poor' as const }, // > 4000ms
      cls: { metric: 'CLS', value: 0.35, unit: 'score' as const, availability: 'measured' as const, rating: 'poor' as const }, // > 0.25
      inp: { metric: 'INP', value: 650, unit: 'ms' as const, availability: 'measured' as const, rating: 'poor' as const }, // > 500ms
      fcp: { metric: 'FCP', value: 3500, unit: 'ms' as const, availability: 'measured' as const, rating: 'poor' as const },
      ttfb: { metric: 'TTFB', value: 2500, unit: 'ms' as const, availability: 'measured' as const, rating: 'poor' as const },
      domContentLoaded: { metric: 'DOMContentLoaded', value: 4500, unit: 'ms' as const, availability: 'measured' as const, rating: 'poor' as const },
      loadDuration: { metric: 'LoadDuration', value: 7000, unit: 'ms' as const, availability: 'measured' as const, rating: 'poor' as const },
    };

    const analysis = PerformanceFindingAnalyzer.analyzeNavigationAndVitals({
      projectId: 'proj-1',
      testRunId: 'test-run-perf-1',
      navigation,
      vitals,
      isCritical: true,
      policy: DEFAULT_PERFORMANCE_POLICY,
    });

    expect(analysis.findings.length).toBeGreaterThanOrEqual(4);
    expect(analysis.bugObservations.length).toBeGreaterThanOrEqual(4);

    const ttfbFinding = analysis.findings.find((f) => f.type === 'PERFORMANCE_TTFB_SLOW');
    expect(ttfbFinding).toBeDefined();

    const lcpFinding = analysis.findings.find((f) => f.type === 'PERFORMANCE_LCP_SLOW');
    expect(lcpFinding).toBeDefined();

    const clsFinding = analysis.findings.find((f) => f.type === 'PERFORMANCE_CLS_HIGH');
    expect(clsFinding).toBeDefined();
  });

  it('leaves performanceScore undefined when no measurements or findings were evaluated (never fabricates 100)', () => {
    const assessment = DeterministicReleaseScorer.calculateAssessment({
      testRunId: 'perf-empty-run',
      projectId: 'proj-1',
      targetUrl: 'http://localhost/test',
      performanceResult: {
        testRunId: 'perf-empty-run',
        projectId: 'proj-1',
        targetUrl: 'http://localhost/test',
        coverage: {
          targetsDiscovered: 0,
          targetsTested: 0,
          pagesMeasured: 0,
          apisMeasured: 0,
          actionsMeasured: 0,
          totalMeasurements: 0,
          findingsCount: 0,
          criticalFindings: 0,
          highFindings: 0,
          mediumFindings: 0,
          lowFindings: 0,
          regressionsCount: 0,
          performanceScore: undefined,
          durationMs: 0,
        },
        navigations: [],
        webVitals: [],
        resources: [],
        network: [],
        actions: [],
        reliability: [],
        findings: [],
        bugObservations: [],
        baselines: [],
      },
    });

    expect(assessment.scores.performance).toBeUndefined();
    expect(assessment.breakdown.performance).toBeUndefined();
  });
});
