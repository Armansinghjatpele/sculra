// ==============================================================================
// Sculra Cross-Run QA Intelligence & Historical Memory Tests (worker/tests/history_engine.test.ts)
// ==============================================================================

import { describe, it, expect } from 'vitest';
import {
  RunComparator,
  FindingMatcher,
  RegressionDetector,
  RecoveryDetector,
  RecurrenceTracker,
  StabilityAnalyzer,
  TrendAnalyzer,
  CoverageTrendTracker,
  HistoricalStrategyEngine,
  HistoricalEvidenceFormatter,
  HistoricalAnalyzer,
  HistoricalRun,
  HistoricalFinding,
  RetestedTargetCoverage,
} from '../src/history';

describe('Historical QA Memory & Regression Engine', () => {
  const projectId = 'proj-123';
  const targetUrl = 'https://example.com/app';

  const baseRunA: HistoricalRun = {
    testRunId: 'run-a',
    projectId,
    status: 'passed',
    createdAt: '2026-09-01T10:00:00Z',
    targetUrl,
    environment: 'staging',
    overallScore: 92,
    findings: [],
    targets: [
      { targetType: 'page', targetIdentifier: 'https://example.com/app', tested: true, status: 'passed' },
      { targetType: 'page', targetIdentifier: 'https://example.com/app/checkout', tested: true, status: 'passed' },
    ],
    coverage: {
      pagesDiscovered: 2,
      pagesTested: 2,
      formsDiscovered: 1,
      formsTested: 1,
      buttonsDiscovered: 5,
      buttonsTested: 5,
      linksDiscovered: 10,
      linksTested: 10,
      pages: { ratio: 1.0 },
      forms: { ratio: 1.0 },
    },
    metrics: { release_score: 92, lcp: 1200 },
  };

  const defect1: HistoricalFinding = {
    fingerprint: 'fp-crash-checkout-submit',
    title: 'Unhandled Exception on Checkout Submit',
    type: 'CONSOLE_ERROR',
    severity: 'critical',
    category: 'functional',
    targetUrl: 'https://example.com/app/checkout',
    selector: '#checkout-submit-btn',
    firstSeenAt: '2026-09-02T10:00:00Z',
    lastSeenAt: '2026-09-02T10:00:00Z',
    occurrenceCount: 1,
    consecutiveRunCount: 1,
    historicalStatus: 'CURRENT',
  };

  const defect2: HistoricalFinding = {
    fingerprint: 'fp-a11y-low-contrast',
    title: 'Low Contrast on Primary Navigation',
    type: 'WCAG_CONTRAST_VIOLATION',
    severity: 'medium',
    category: 'accessibility',
    targetUrl: 'https://example.com/app',
    selector: '.nav-link',
    firstSeenAt: '2026-09-02T10:00:00Z',
    lastSeenAt: '2026-09-02T10:00:00Z',
    occurrenceCount: 1,
    consecutiveRunCount: 1,
    historicalStatus: 'CURRENT',
  };

  const runB: HistoricalRun = {
    ...baseRunA,
    testRunId: 'run-b',
    createdAt: '2026-09-02T10:00:00Z',
    overallScore: 68,
    status: 'failed',
    findings: [defect1, defect2],
  };

  describe('1. Baseline Establishment & Compatibility Selection', () => {
    it('returns BASELINE_MISSING when no prior runs exist', () => {
      const result = RunComparator.selectBestComparableRun(baseRunA, []);
      expect(result.status).toBe('BASELINE_MISSING');
      expect(result.bestMatch).toBeUndefined();
    });

    it('selects best matching comparable run when compatible history exists', () => {
      const result = RunComparator.selectBestComparableRun(runB, [baseRunA]);
      expect(result.status).toBe('COMPARABLE');
      expect(result.bestMatch?.run.testRunId).toBe('run-a');
      expect(result.bestMatch?.compatibilityScore).toBeGreaterThanOrEqual(80);
    });

    it('rejects incompatible run with different project ID', () => {
      const foreignRun: HistoricalRun = {
        ...baseRunA,
        testRunId: 'foreign-run',
        projectId: 'different-project',
      };
      const result = RunComparator.selectBestComparableRun(runB, [foreignRun]);
      expect(result.status).toBe('NO_COMPARABLE_RUN');
    });
  });

  describe('2. Fingerprint & Signature Matching', () => {
    it('matches identical defects by SHA-256 fingerprint', () => {
      const match = FindingMatcher.matchFindings([defect1], [defect1]);
      expect(match.matchedPairs.length).toBe(1);
      expect(match.matchedPairs[0].matchType).toBe('FINGERPRINT');
      expect(match.unmatchedCurrent.length).toBe(0);
      expect(match.unmatchedPrevious.length).toBe(0);
    });

    it('matches by secondary signature when fingerprint differs but selector/url/type match', () => {
      const alteredDefect1: HistoricalFinding = {
        ...defect1,
        fingerprint: 'different-hash',
      };
      const match = FindingMatcher.matchFindings([alteredDefect1], [defect1]);
      expect(match.matchedPairs.length).toBe(1);
      expect(match.matchedPairs[0].matchType).toBe('SIGNATURE');
    });
  });

  describe('3. Regression Detection', () => {
    it('identifies new defects in current run as regressions against clean prior run', () => {
      const match = FindingMatcher.matchFindings(runB.findings || [], baseRunA.findings || []);
      const regressions = RegressionDetector.detectRegressions(match.unmatchedCurrent, baseRunA);

      expect(regressions.length).toBe(2);
      expect(regressions.some((r) => r.fingerprint === defect1.fingerprint && r.severity === 'critical')).toBe(true);
      expect(regressions.some((r) => r.category === 'accessibility')).toBe(true);
    });
  });

  describe('4. Recovery Guarantee (NOT_RETESTED != FIXED)', () => {
    it('marks defect as RECOVERED only when target is actively retested cleanly', () => {
      const coverageWithRetest: RetestedTargetCoverage = {
        visitedUrls: new Set(['https://example.com/app', 'https://example.com/app/checkout']),
        testedSelectors: new Set(['#checkout-submit-btn', '.nav-link']),
        testedApiEndpoints: new Set(),
        executedSecurityChecks: false,
        executedPerformanceChecks: false,
        executedAccessibilityChecks: true,
        testedWorkflows: new Set(),
      };

      const result = RecoveryDetector.evaluateRecoveries([defect1, defect2], coverageWithRetest, 'run-c');
      expect(result.recoveries.length).toBe(2);
      expect(result.notRetested.length).toBe(0);
      expect(result.recoveries[0].currentRunState).toBe('PASSED_RETESTED');
    });

    it('marks defect as NOT_RETESTED when its target page was not visited', () => {
      const partialCoverage: RetestedTargetCoverage = {
        visitedUrls: new Set(['https://example.com/app']), // checkout was NOT visited
        testedSelectors: new Set(['.nav-link']),
        testedApiEndpoints: new Set(),
        executedSecurityChecks: false,
        executedPerformanceChecks: false,
        executedAccessibilityChecks: true,
        testedWorkflows: new Set(),
      };

      const result = RecoveryDetector.evaluateRecoveries([defect1, defect2], partialCoverage, 'run-c');
      expect(result.recoveries.length).toBe(1); // defect2 (nav) is recovered
      expect(result.recoveries[0].fingerprint).toBe(defect2.fingerprint);

      expect(result.notRetested.length).toBe(1); // defect1 (checkout) was NOT retested
      expect(result.notRetested[0].fingerprint).toBe(defect1.fingerprint);
      expect(result.notRetested[0].historicalStatus).toBe('NOT_RETESTED');
    });
  });

  describe('5. Recurrence Tracking', () => {
    it('increments occurrence and consecutive counts for persistent defects', () => {
      const match = FindingMatcher.matchFindings([defect1], [defect1]);
      const recurrences = RecurrenceTracker.trackRecurrences(match.matchedPairs, 3);

      expect(recurrences.length).toBe(1);
      expect(recurrences[0].occurrenceCount).toBe(2);
      expect(recurrences[0].consecutiveRunCount).toBe(2);
      expect(recurrences[0].recurrenceRate).toBeCloseTo(0.67, 1);
    });
  });

  describe('6. Target Stability & Flakiness Classification', () => {
    it('identifies intermittent flaky target when outcomes alternate', () => {
      const histories = [
        {
          targetId: 'checkout-page',
          targetType: 'page',
          targetIdentifier: 'https://example.com/app/checkout',
          outcomes: ['PASS', 'FAIL', 'PASS', 'FAIL'] as Array<'PASS' | 'FAIL'>,
        },
      ];

      const signals = StabilityAnalyzer.analyzeStability(histories);
      expect(signals.length).toBe(1);
      expect(signals[0].stability).toBe('INTERMITTENT');
      expect(signals[0].flakeRate).toBeGreaterThanOrEqual(0.7);
    });

    it('identifies STABLE_PASS when target passes 3+ times in a row', () => {
      const histories = [
        {
          targetId: 'home-page',
          targetType: 'page',
          targetIdentifier: 'https://example.com/app',
          outcomes: ['PASS', 'PASS', 'PASS', 'PASS'] as Array<'PASS' | 'FAIL'>,
        },
      ];

      const signals = StabilityAnalyzer.analyzeStability(histories);
      expect(signals[0].stability).toBe('STABLE_PASS');
      expect(signals[0].consecutivePassCount).toBe(4);
    });
  });

  describe('7. Trend Analysis & Score Deltas', () => {
    it('calculates score delta and DEGRADING trend when release score drops', () => {
      const trend = TrendAnalyzer.analyzeScoreTrends(runB, [baseRunA]);
      expect(trend.scoreDelta).toBe(-24); // 68 - 92
      expect(trend.trend).toBe('DEGRADING');
    });

    it('calculates IMPROVING trend when release score increases', () => {
      const recoveredRun: HistoricalRun = {
        ...runB,
        testRunId: 'run-c',
        overallScore: 95,
      };
      const trend = TrendAnalyzer.analyzeScoreTrends(recoveredRun, [runB, baseRunA]);
      expect(trend.scoreDelta).toBe(27); // 95 - 68
      expect(trend.trend).toBe('IMPROVING');
    });
  });

  describe('8. Strategy Priority Boosting', () => {
    it('applies +25 pts boost for targets that regressed in prior run', () => {
      const candidateTarget = {
        id: 'target-checkout',
        targetType: 'BUTTON' as any,
        pageUrl: 'https://example.com/app/checkout',
        selector: '#checkout-submit-btn',
        priorityScore: 50,
        priorityLevel: 'medium' as any,
        reasons: [],
        attemptsCount: 0,
        dependencies: [],
        estimatedCost: 1,
      };

      const match = FindingMatcher.matchFindings(runB.findings || [], baseRunA.findings || []);
      const regressions = RegressionDetector.detectRegressions(match.unmatchedCurrent, baseRunA);

      const boosts = HistoricalStrategyEngine.computeHistoricalBoosts(
        [candidateTarget],
        [],
        [],
        regressions
      );

      const mod = boosts.get('target-checkout');
      expect(mod).toBeDefined();
      expect(mod?.priorityBonus).toBe(25);
      expect(mod?.reasons[0]).toContain('Priority +25: Target regressed');
    });
  });

  describe('9. Complete HistoricalAnalyzer Orchestration', () => {
    it('executes full pipeline and generates signals, summary, and metric deltas', async () => {
      const comparison = await HistoricalAnalyzer.analyze({
        currentRun: runB,
        historicalRuns: [baseRunA],
        enableAI: true, // Deterministic fallback summary when OpenAI unconfigured
      });

      expect(comparison.isComparable).toBe(true);
      expect(comparison.summary.comparisonStatus).toBe('COMPARABLE');
      expect(comparison.summary.newRegressionsCount).toBe(2);
      expect(comparison.summary.scoreDelta).toBe(-24);
      expect(comparison.summary.releaseTrend).toBe('DEGRADING');
      expect(comparison.generatedSignals.length).toBeGreaterThan(0);
      expect(comparison.aiInterpretation?.executiveSummary).toContain('degrading');

      // Evidence formatting
      const evidences = HistoricalEvidenceFormatter.formatHistoricalEvidence(comparison, targetUrl);
      expect(evidences.length).toBeGreaterThanOrEqual(3);
      expect(evidences.some((e) => e.type === 'historical_summary')).toBe(true);
      expect(evidences.some((e) => e.type === 'regression_event')).toBe(true);
    });
  });
});
