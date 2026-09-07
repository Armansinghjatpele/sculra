// ==============================================================================
// Sculra Deterministic Release Readiness Scorer Tests (worker/tests/release_scorer.test.ts)
// ==============================================================================

import { describe, it, expect } from 'vitest';
import { DeterministicReleaseScorer } from '../src/release/scorer';
import { ApplicationMap } from '../src/types';
import { JourneyResult } from '../src/journeys/types';
import { BugObservation } from '../src/issues/types';
import { ResponsiveExecutionResult } from '../src/visual/types';

describe('DeterministicReleaseScorer', () => {
  const baseAppMap: ApplicationMap = {
    startUrl: 'http://127.0.0.1:3000',
    discoveredAt: new Date().toISOString(),
    totalPages: 5,
    totalLinks: 8,
    totalButtons: 10,
    totalForms: 2,
    totalInputs: 4,
    pages: [
      { url: 'http://127.0.0.1:3000', title: 'Home', depth: 0, elementsCount: 2, elements: [], forms: [], links: [], consoleErrors: [], networkErrors: [], timestamp: '' },
      { url: 'http://127.0.0.1:3000/pricing', title: 'Pricing', depth: 1, elementsCount: 2, elements: [], forms: [], links: [], consoleErrors: [], networkErrors: [], timestamp: '' },
      { url: 'http://127.0.0.1:3000/docs', title: 'Docs', depth: 1, elementsCount: 2, elements: [], forms: [], links: [], consoleErrors: [], networkErrors: [], timestamp: '' },
      { url: 'http://127.0.0.1:3000/contact', title: 'Contact', depth: 1, elementsCount: 2, elements: [], forms: [], links: [], consoleErrors: [], networkErrors: [], timestamp: '' },
      { url: 'http://127.0.0.1:3000/login', title: 'Login', depth: 1, elementsCount: 2, elements: [], forms: [], links: [], consoleErrors: [], networkErrors: [], timestamp: '' },
    ],
  };

  const cleanJourneys: JourneyResult[] = [
    {
      journeyId: 'j-1',
      name: 'Primary Navigation',
      category: 'navigation',
      status: 'PASSED',
      startedAt: '',
      finishedAt: '',
      durationMs: 1200,
      viewport: { width: 1440, height: 900, name: 'desktop' },
      steps: [],
      observations: [],
      pagesVisited: ['http://127.0.0.1:3000', 'http://127.0.0.1:3000/pricing', 'http://127.0.0.1:3000/docs', 'http://127.0.0.1:3000/contact', 'http://127.0.0.1:3000/login'],
      actionsAttempted: 10,
      actionsPassed: 10,
      actionsFailed: 0,
      actionsSkipped: 0,
    },
    {
      journeyId: 'j-2',
      name: 'Form Usability',
      category: 'form',
      status: 'PASSED',
      startedAt: '',
      finishedAt: '',
      durationMs: 800,
      viewport: { width: 390, height: 844, name: 'mobile' },
      steps: [],
      observations: [],
      pagesVisited: ['http://127.0.0.1:3000/contact'],
      actionsAttempted: 5,
      actionsPassed: 5,
      actionsFailed: 0,
      actionsSkipped: 0,
    },
  ];

  const cleanVisual: ResponsiveExecutionResult = {
    testRunId: 'run-1',
    projectId: 'proj-1',
    targetUrl: 'http://127.0.0.1:3000',
    executedAt: new Date().toISOString(),
    viewportsTested: [
      { name: 'desktop', width: 1440, height: 900, scaleFactor: 1, isMobile: false, hasTouch: false },
      { name: 'tablet', width: 768, height: 1024, scaleFactor: 2, isMobile: false, hasTouch: true },
      { name: 'mobile', width: 390, height: 844, scaleFactor: 3, isMobile: true, hasTouch: true },
    ],
    snapshots: [],
    comparisons: [
      {
        comparisonId: 'comp-1',
        pageUrl: 'http://127.0.0.1:3000',
        viewport: { name: 'desktop', width: 1440, height: 900, scaleFactor: 1, isMobile: false, hasTouch: false },
        status: 'MATCH',
        changedPixelCount: 0,
        totalPixelCount: 100000,
        pixelDifferenceRatio: 0,
        comparedAt: new Date().toISOString(),
      },
      {
        comparisonId: 'comp-2',
        pageUrl: 'http://127.0.0.1:3000',
        viewport: { name: 'mobile', width: 390, height: 844, scaleFactor: 3, isMobile: true, hasTouch: true },
        status: 'BASELINE_MISSING',
        changedPixelCount: 0,
        totalPixelCount: 100000,
        pixelDifferenceRatio: 0,
        comparedAt: new Date().toISOString(),
      },
    ],
    observations: [],
    durationMs: 2000,
  };

  it('1. evaluates perfect evidence scenario cleanly with RELEASE recommendation and HIGH confidence', () => {
    const assessment = DeterministicReleaseScorer.calculateAssessment({
      testRunId: 'run-perf-1',
      projectId: 'proj-1',
      targetUrl: 'http://127.0.0.1:3000',
      applicationMap: baseAppMap,
      journeyResults: cleanJourneys,
      visualResult: cleanVisual,
      bugObservations: [],
    });

    expect(assessment.scoringVersion).toBe('1.0');
    expect(assessment.overallScore).toBeGreaterThanOrEqual(85);
    expect(assessment.scores.functional).toBe(100);
    expect(assessment.scores.visual).toBe(100);
    expect(assessment.scores.responsive).toBe(100);
    expect(assessment.scores.reliability).toBe(100);
    expect(assessment.recommendation).toBe('RELEASE');
    expect(assessment.riskLevel).toBe('LOW');
    expect(assessment.confidenceLevel).toBe('HIGH');
    expect(assessment.blockers.length).toBe(0);
  });

  it('2. evaluates insufficient evidence scenario (1 page, 0 journeys) as INSUFFICIENT_EVIDENCE and capped score', () => {
    const sparseAppMap: ApplicationMap = {
      startUrl: 'http://127.0.0.1:3000',
      discoveredAt: new Date().toISOString(),
      totalPages: 1,
      totalLinks: 0,
      totalButtons: 0,
      totalForms: 0,
      totalInputs: 0,
      pages: [{ url: 'http://127.0.0.1:3000', title: 'Home', depth: 0, elementsCount: 0, elements: [], forms: [], links: [], consoleErrors: [], networkErrors: [], timestamp: '' }],
    };

    const assessment = DeterministicReleaseScorer.calculateAssessment({
      testRunId: 'run-sparse-1',
      projectId: 'proj-1',
      targetUrl: 'http://127.0.0.1:3000',
      applicationMap: sparseAppMap,
      journeyResults: [],
      bugObservations: [],
    });

    expect(assessment.confidenceLevel).toBe('INSUFFICIENT');
    expect(assessment.recommendation).toBe('INSUFFICIENT_EVIDENCE');
    expect(assessment.overallScore).toBeLessThanOrEqual(50);
  });

  it('3. identifies critical blocker and caps overall score at <= 59', () => {
    const critBug: BugObservation = {
      id: 'bug-1',
      testRunId: 'run-crit-1',
      projectId: 'proj-1',
      type: 'RUNTIME_EXCEPTION',
      severity: 'critical',
      confidence: 'high',
      status: 'open',
      title: 'Uncaught React runtime crash on checkout',
      summary: 'TypeError: Cannot read properties of undefined',
      description: 'Crashed React render tree.',
      url: 'http://127.0.0.1:3000/pricing',
      fingerprint: 'fp-crit-1',
      reproductionSteps: [],
      timestamp: new Date().toISOString(),
    };

    const assessment = DeterministicReleaseScorer.calculateAssessment({
      testRunId: 'run-crit-1',
      projectId: 'proj-1',
      targetUrl: 'http://127.0.0.1:3000',
      applicationMap: baseAppMap,
      journeyResults: cleanJourneys,
      bugObservations: [critBug],
      visualResult: cleanVisual,
    });

    expect(assessment.blockers.length).toBeGreaterThanOrEqual(1);
    expect(assessment.blockers[0].severity).toBe('critical');
    expect(assessment.overallScore).toBeLessThanOrEqual(59);
    expect(assessment.recommendation).toBe('DO_NOT_RELEASE');
    expect(assessment.riskLevel).toBe('CRITICAL');
  });

  it('4. correctly deducts points for high, medium, and low issues', () => {
    const bugs: BugObservation[] = [
      {
        id: 'bug-h',
        testRunId: 'run-bugs',
        projectId: 'proj-1',
        type: 'BROKEN_CONTROL',
        severity: 'high',
        confidence: 'high',
        status: 'open',
        title: 'Primary CTA button fails to trigger action',
        summary: '',
        description: '',
        url: 'http://127.0.0.1:3000',
        fingerprint: 'fp-high-1',
        reproductionSteps: [],
        timestamp: '',
      },
      {
        id: 'bug-m',
        testRunId: 'run-bugs',
        projectId: 'proj-1',
        type: 'FORM_VALIDATION_FAILURE',
        severity: 'medium',
        confidence: 'high',
        status: 'open',
        title: 'Missing client error feedback on invalid email',
        summary: '',
        description: '',
        url: 'http://127.0.0.1:3000/contact',
        fingerprint: 'fp-med-1',
        reproductionSteps: [],
        timestamp: '',
      },
      {
        id: 'bug-l',
        testRunId: 'run-bugs',
        projectId: 'proj-1',
        type: 'LAYOUT_DEFECT',
        severity: 'low',
        confidence: 'high',
        status: 'open',
        title: 'Minor padding misalignment on footer text',
        summary: '',
        description: '',
        url: 'http://127.0.0.1:3000',
        fingerprint: 'fp-low-1',
        reproductionSteps: [],
        timestamp: '',
      },
    ];

    const assessment = DeterministicReleaseScorer.calculateAssessment({
      testRunId: 'run-bugs',
      projectId: 'proj-1',
      targetUrl: 'http://127.0.0.1:3000',
      applicationMap: baseAppMap,
      journeyResults: cleanJourneys,
      bugObservations: bugs,
      visualResult: cleanVisual,
    });

    // 100 - 15 (high) - 6 (medium) - 2 (low) = 77
    expect(assessment.scores.functional).toBe(77);
  });

  it('5. verifies BASELINE_MISSING does not penalize visual score as a defect', () => {
    const visualWithBaselineMissing: ResponsiveExecutionResult = {
      testRunId: 'run-bm',
      projectId: 'proj-1',
      targetUrl: 'http://127.0.0.1:3000',
      executedAt: new Date().toISOString(),
      viewportsTested: [
        { name: 'desktop', width: 1440, height: 900, scaleFactor: 1, isMobile: false, hasTouch: false },
        { name: 'tablet', width: 768, height: 1024, scaleFactor: 2, isMobile: false, hasTouch: true },
        { name: 'mobile', width: 390, height: 844, scaleFactor: 3, isMobile: true, hasTouch: true },
      ],
      snapshots: [],
      comparisons: [
        {
          comparisonId: 'comp-1',
          pageUrl: 'http://127.0.0.1:3000',
          viewport: { name: 'desktop', width: 1440, height: 900, scaleFactor: 1, isMobile: false, hasTouch: false },
          status: 'BASELINE_MISSING',
          changedPixelCount: 0,
          totalPixelCount: 100000,
          pixelDifferenceRatio: 0,
          comparedAt: new Date().toISOString(),
        },
      ],
      observations: [],
      durationMs: 1000,
    };

    const assessment = DeterministicReleaseScorer.calculateAssessment({
      testRunId: 'run-bm',
      projectId: 'proj-1',
      targetUrl: 'http://127.0.0.1:3000',
      applicationMap: baseAppMap,
      journeyResults: cleanJourneys,
      visualResult: visualWithBaselineMissing,
    });

    expect(assessment.scores.visual).toBe(100);
    expect(assessment.breakdown.visual.missingBaselinesCount).toBe(1);
    expect(assessment.breakdown.visual.regressionsCount).toBe(0);
  });

  it('6. deducts visual score on real regression and geometric element overlap', () => {
    const visualWithDefects: ResponsiveExecutionResult = {
      testRunId: 'run-vd',
      projectId: 'proj-1',
      targetUrl: 'http://127.0.0.1:3000',
      executedAt: new Date().toISOString(),
      viewportsTested: [
        { name: 'desktop', width: 1440, height: 900, scaleFactor: 1, isMobile: false, hasTouch: false },
      ],
      snapshots: [],
      comparisons: [
        {
          comparisonId: 'comp-reg',
          pageUrl: 'http://127.0.0.1:3000/pricing',
          viewport: { name: 'desktop', width: 1440, height: 900, scaleFactor: 1, isMobile: false, hasTouch: false },
          status: 'HIGH_REGRESSION',
          changedPixelCount: 8500,
          totalPixelCount: 100000,
          pixelDifferenceRatio: 0.085,
          comparedAt: new Date().toISOString(),
        },
      ],
      observations: [
        {
          type: 'ELEMENT_OVERLAP',
          pageUrl: 'http://127.0.0.1:3000',
          viewport: { name: 'desktop', width: 1440, height: 900, scaleFactor: 1, isMobile: false, hasTouch: false },
          description: 'Button overlapping card container title',
          severity: 'medium',
          timestamp: '',
        },
      ],
      durationMs: 1000,
    };

    const assessment = DeterministicReleaseScorer.calculateAssessment({
      testRunId: 'run-vd',
      projectId: 'proj-1',
      targetUrl: 'http://127.0.0.1:3000',
      applicationMap: baseAppMap,
      journeyResults: cleanJourneys,
      visualResult: visualWithDefects,
    });

    // 100 - 20 (high regression) - 8 (overlap) = 72
    expect(assessment.scores.visual).toBe(72);
  });

  it('7. applies responsive deductions for mobile horizontal layout overflow', () => {
    const visualWithOverflow: ResponsiveExecutionResult = {
      testRunId: 'run-resp',
      projectId: 'proj-1',
      targetUrl: 'http://127.0.0.1:3000',
      executedAt: new Date().toISOString(),
      viewportsTested: [
        { name: 'mobile', width: 390, height: 844, scaleFactor: 3, isMobile: true, hasTouch: true },
      ],
      snapshots: [],
      comparisons: [],
      observations: [
        {
          type: 'HORIZONTAL_OVERFLOW',
          pageUrl: 'http://127.0.0.1:3000',
          viewport: { name: 'mobile', width: 390, height: 844, scaleFactor: 3, isMobile: true, hasTouch: true },
          description: 'Document scrollWidth (512px) exceeds viewport width (390px)',
          severity: 'high',
          timestamp: '',
        },
      ],
      durationMs: 1000,
    };

    const assessment = DeterministicReleaseScorer.calculateAssessment({
      testRunId: 'run-resp',
      projectId: 'proj-1',
      targetUrl: 'http://127.0.0.1:3000',
      applicationMap: baseAppMap,
      journeyResults: cleanJourneys,
      visualResult: visualWithOverflow,
    });

    // 100 - 15 (mobile overflow) = 85
    expect(assessment.scores.responsive).toBe(85);
  });

  it('8. handles confirmed vs suspected issues distinctly', () => {
    const confirmedHigh: BugObservation = {
      id: 'bug-conf',
      testRunId: 'run-cs',
      projectId: 'proj-1',
      type: 'BROKEN_CONTROL',
      severity: 'high',
      confidence: 'high',
      status: 'open',
      title: 'Confirmed broken button',
      summary: '',
      description: '',
      url: 'http://127.0.0.1:3000',
      fingerprint: 'fp-conf',
      reproductionSteps: [],
      timestamp: '',
    };

    const suspectedHigh: BugObservation = {
      id: 'bug-susp',
      testRunId: 'run-cs',
      projectId: 'proj-1',
      type: 'BROKEN_CONTROL',
      severity: 'high',
      confidence: 'low',
      status: 'open',
      title: 'Suspected broken button without deterministic trace',
      summary: '',
      description: '',
      url: 'http://127.0.0.1:3000',
      fingerprint: 'fp-susp',
      reproductionSteps: [],
      timestamp: '',
    };

    const assessment = DeterministicReleaseScorer.calculateAssessment({
      testRunId: 'run-cs',
      projectId: 'proj-1',
      targetUrl: 'http://127.0.0.1:3000',
      applicationMap: baseAppMap,
      journeyResults: cleanJourneys,
      bugObservations: [confirmedHigh, suspectedHigh],
      visualResult: cleanVisual,
    });

    // Confirmed high = -15, Suspected high = -3 -> 100 - 18 = 82
    expect(assessment.scores.functional).toBe(82);
    expect(assessment.breakdown.functional.confirmedIssuesCount).toBe(1);
    expect(assessment.breakdown.functional.suspectedIssuesCount).toBe(1);
  });

  it('9. deduplicates recurring issue occurrences without artificial multiplier', () => {
    const recurringOccurrences: BugObservation[] = [
      {
        id: 'bug-occ-1',
        testRunId: 'run-recur',
        projectId: 'proj-1',
        type: 'HTTP_ERROR',
        severity: 'high',
        confidence: 'high',
        status: 'open',
        title: 'HTTP 500 on /api/data',
        summary: '',
        description: '',
        url: 'http://127.0.0.1:3000',
        fingerprint: 'fp-same-error',
        reproductionSteps: [],
        timestamp: '',
      },
      {
        id: 'bug-occ-2',
        testRunId: 'run-recur',
        projectId: 'proj-1',
        type: 'HTTP_ERROR',
        severity: 'high',
        confidence: 'high',
        status: 'open',
        title: 'HTTP 500 on /api/data',
        summary: '',
        description: '',
        url: 'http://127.0.0.1:3000',
        fingerprint: 'fp-same-error',
        reproductionSteps: [],
        timestamp: '',
      },
      {
        id: 'bug-occ-3',
        testRunId: 'run-recur',
        projectId: 'proj-1',
        type: 'HTTP_ERROR',
        severity: 'high',
        confidence: 'high',
        status: 'open',
        title: 'HTTP 500 on /api/data',
        summary: '',
        description: '',
        url: 'http://127.0.0.1:3000',
        fingerprint: 'fp-same-error',
        reproductionSteps: [],
        timestamp: '',
      },
    ];

    const assessment = DeterministicReleaseScorer.calculateAssessment({
      testRunId: 'run-recur',
      projectId: 'proj-1',
      targetUrl: 'http://127.0.0.1:3000',
      applicationMap: baseAppMap,
      journeyResults: cleanJourneys,
      bugObservations: recurringOccurrences,
      visualResult: cleanVisual,
    });

    // 1 unique issue (-15) + recurrence penalty of 2 extra occurrences (-2) = -17 -> 100 - 17 = 83
    expect(assessment.scores.functional).toBe(83);
    expect(assessment.breakdown.functional.confirmedIssuesCount).toBe(1);
  });

  it('10. verifies scoring determinism (identical inputs yield exact same score)', () => {
    const opts = {
      testRunId: 'run-det-1',
      projectId: 'proj-1',
      targetUrl: 'http://127.0.0.1:3000',
      applicationMap: baseAppMap,
      journeyResults: cleanJourneys,
      visualResult: cleanVisual,
      bugObservations: [],
    };

    const res1 = DeterministicReleaseScorer.calculateAssessment(opts);
    const res2 = DeterministicReleaseScorer.calculateAssessment(opts);

    expect(res1.overallScore).toBe(res2.overallScore);
    expect(res1.scores).toEqual(res2.scores);
    expect(res1.recommendation).toBe(res2.recommendation);
    expect(res1.riskLevel).toBe(res2.riskLevel);
    expect(res1.confidenceLevel).toBe(res2.confidenceLevel);
  });

  it('11. calculates historical score change accurately when previous assessment exists', () => {
    const assessment = DeterministicReleaseScorer.calculateAssessment({
      testRunId: 'run-hist-2',
      projectId: 'proj-1',
      targetUrl: 'http://127.0.0.1:3000',
      applicationMap: baseAppMap,
      journeyResults: cleanJourneys,
      visualResult: cleanVisual,
      previousAssessment: {
        overallScore: 72,
        testRunId: 'run-hist-1',
        createdAt: '2026-09-06T10:00:00Z',
      },
    });

    expect(assessment.breakdown.historicalComparison).toBeDefined();
    expect(assessment.breakdown.historicalComparison?.previousScore).toBe(72);
    expect(assessment.breakdown.historicalComparison?.change).toBe(assessment.overallScore - 72);
  });

  it('12. marks cancelled test runs with INSUFFICIENT_EVIDENCE and capped score', () => {
    const assessment = DeterministicReleaseScorer.calculateAssessment({
      testRunId: 'run-cancel-1',
      projectId: 'proj-1',
      targetUrl: 'http://127.0.0.1:3000',
      testRunStatus: 'cancelled',
      applicationMap: baseAppMap,
      journeyResults: [],
    });

    expect(assessment.confidenceLevel).toBe('INSUFFICIENT');
    expect(assessment.recommendation).toBe('INSUFFICIENT_EVIDENCE');
    expect(assessment.overallScore).toBeLessThanOrEqual(50);
  });
});
