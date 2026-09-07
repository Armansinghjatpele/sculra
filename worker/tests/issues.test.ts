// ==============================================================================
// Sculra Deterministic Bug Detection & Issue Unit Tests (worker/tests/issues.test.ts)
// ==============================================================================

import { describe, it, expect } from 'vitest';
import {
  computeBugFingerprint,
  normalizeUrlForFingerprint,
  normalizeSelectorForFingerprint,
  normalizeErrorSignatureForFingerprint,
  isCriticalNetworkFailure,
  sanitizeUrl,
  classifyConsoleError,
  normalizeConsoleSignature,
  calculateBugSeverity,
  isPrimaryCTA,
  DeterministicIssueClassifier,
} from '../src/issues';
import { JourneyResult } from '../src/journeys/types';

describe('Deterministic Fingerprinting & Deduplication', () => {
  it('generates identical fingerprints for matching bugs regardless of volatile tokens or timestamps', () => {
    const fp1 = computeBugFingerprint({
      projectId: 'proj-123',
      url: 'https://example.com/checkout?session_id=abc12345&timestamp=2026-09-07T12:00:00Z',
      bugType: 'BROKEN_CONTROL',
      selector: '#submit-btn:nth-child(2)',
      action: 'CLICK',
      errorSignature: 'Error at 0x7fff5fbff840: uuid-12345678-1234-1234-1234-123456789abc',
    });

    const fp2 = computeBugFingerprint({
      projectId: 'proj-123',
      url: 'https://example.com/checkout?session_id=xyz98765&timestamp=2026-09-07T13:00:00Z',
      bugType: 'BROKEN_CONTROL',
      selector: '#submit-btn:nth-child(4)',
      action: 'CLICK',
      errorSignature: 'Error at 0x7fff99999999: uuid-87654321-4321-4321-4321-cba987654321',
    });

    expect(fp1).toBe(fp2);
  });

  it('generates distinct fingerprints for different bug types or targets', () => {
    const fp1 = computeBugFingerprint({
      projectId: 'proj-123',
      url: 'https://example.com/checkout',
      bugType: 'BROKEN_CONTROL',
      selector: '#btn-1',
    });

    const fp2 = computeBugFingerprint({
      projectId: 'proj-123',
      url: 'https://example.com/features',
      bugType: 'BROKEN_CONTROL',
      selector: '#btn-1',
    });

    const fp3 = computeBugFingerprint({
      projectId: 'proj-123',
      url: 'https://example.com/checkout',
      bugType: 'NAVIGATION_FAILURE',
      selector: '#btn-1',
    });

    expect(fp1).not.toBe(fp2);
    expect(fp1).not.toBe(fp3);
  });
});

describe('Network Intelligence & Sensitive Sanitization', () => {
  it('redacts sensitive query parameters from URLs', () => {
    const raw = 'https://api.example.com/v1/user?token=secret123&api_key=priv_key_99&name=Sculra&password=mypass';
    const sanitized = sanitizeUrl(raw);

    expect(sanitized).toContain('token=%5BREDACTED%5D');
    expect(sanitized).toContain('api_key=%5BREDACTED%5D');
    expect(sanitized).toContain('password=%5BREDACTED%5D');
    expect(sanitized).toContain('name=Sculra');
    expect(sanitized).not.toContain('secret123');
    expect(sanitized).not.toContain('priv_key_99');
    expect(sanitized).not.toContain('mypass');
  });

  it('filters out non-critical analytics, fonts, and telemetry network failures', () => {
    expect(
      isCriticalNetworkFailure({
        url: 'https://www.google-analytics.com/g/collect',
        method: 'POST',
        status: 404,
        timestamp: new Date().toISOString(),
      }).critical
    ).toBe(false);

    expect(
      isCriticalNetworkFailure({
        url: 'https://app.posthog.com/e/',
        method: 'POST',
        status: 500,
        timestamp: new Date().toISOString(),
      }).critical
    ).toBe(false);

    expect(
      isCriticalNetworkFailure({
        url: 'https://fonts.googleapis.com/css?family=Inter.woff2',
        method: 'GET',
        status: 404,
        timestamp: new Date().toISOString(),
      }).critical
    ).toBe(false);

    expect(
      isCriticalNetworkFailure({
        url: 'https://example.com/favicon.ico',
        method: 'GET',
        status: 404,
        timestamp: new Date().toISOString(),
      }).critical
    ).toBe(false);
  });

  it('flags critical API and application resource failures', () => {
    expect(
      isCriticalNetworkFailure({
        url: 'https://example.com/api/users/profile',
        method: 'GET',
        status: 500,
        resourceType: 'fetch',
        timestamp: new Date().toISOString(),
      }).critical
    ).toBe(true);

    expect(
      isCriticalNetworkFailure({
        url: 'https://example.com/checkout/pay',
        method: 'POST',
        status: 502,
        resourceType: 'xhr',
        timestamp: new Date().toISOString(),
      }).critical
    ).toBe(true);
  });
});

describe('Console Error Intelligence', () => {
  it('normalizes volatile tokens from console messages', () => {
    const raw = 'Uncaught TypeError: Cannot read property "name" of undefined at chunk-1234.js:45:12 (0x7fff5fbff840)';
    const sig = normalizeConsoleSignature(raw);

    expect(sig).toContain('cannot read property "name" of undefined');
    expect(sig).not.toContain('0x7fff5fbff840');
    expect(sig).not.toContain(':45:12');
  });

  it('classifies runtime exceptions as bug candidates and warnings as non-bugs', () => {
    const exc = classifyConsoleError({
      message: 'Uncaught ReferenceError: x is not defined',
      timestamp: new Date().toISOString(),
    });
    expect(exc.isBugCandidate).toBe(true);
    expect(exc.category).toBe('runtime_exception');

    const warn = classifyConsoleError({
      message: 'Warning: React Hook useEffect has a missing dependency',
      timestamp: new Date().toISOString(),
    });
    expect(warn.isBugCandidate).toBe(false);
    expect(warn.category).toBe('warning');
  });
});

describe('Deterministic Severity & Primary CTA Rules', () => {
  it('identifies primary CTAs deterministically', () => {
    expect(isPrimaryCTA('Get Started Now', '#hero-cta')).toBe(true);
    expect(isPrimaryCTA('Submit Order', '#order-submit')).toBe(true);
    expect(isPrimaryCTA('Sign Up', 'button.btn-primary')).toBe(true);
    expect(isPrimaryCTA('Search Documentation', '#search-btn')).toBe(true);

    // Destructive actions are not CTAs
    expect(isPrimaryCTA('Delete Account', '#del-btn')).toBe(false);
    expect(isPrimaryCTA('Log Out', '#logout')).toBe(false);
  });

  it('elevates severity for primary CTA failures and catastrophic server errors', () => {
    expect(
      calculateBugSeverity({
        bugType: 'BROKEN_CONTROL',
        url: 'https://example.com',
        targetDescription: 'Get Started Now',
        selector: '#hero-cta',
      })
    ).toBe('high');

    expect(
      calculateBugSeverity({
        bugType: 'PAGE_LOAD_FAILURE',
        url: 'https://example.com',
        isInitialPage: true,
        statusCode: 500,
      })
    ).toBe('critical');

    expect(
      calculateBugSeverity({
        bugType: 'BROKEN_CONTROL',
        url: 'https://example.com/settings',
        targetDescription: 'Secondary Accordion',
        selector: '#accordion-1',
      })
    ).toBe('medium');
  });
});

describe('DeterministicIssueClassifier', () => {
  const sampleJourney: JourneyResult = {
    journeyId: 'j-1',
    name: 'Interactive Controls Flow',
    category: 'interaction',
    status: 'PASSED',
    startedAt: '2026-09-07T12:00:00Z',
    finishedAt: '2026-09-07T12:00:05Z',
    durationMs: 5000,
    viewport: { width: 1280, height: 720, name: 'desktop' },
    actionsAttempted: 2,
    actionsPassed: 2,
    actionsFailed: 0,
    actionsSkipped: 0,
    pagesVisited: ['http://localhost:3000'],
    observations: [],
    steps: [
      {
        stepId: 'step-1',
        action: 'NAVIGATE',
        targetDescription: 'Home',
        status: 'PASSED',
        startedAt: '2026-09-07T12:00:00Z',
        finishedAt: '2026-09-07T12:00:01Z',
        durationMs: 1000,
        beforeUrl: 'about:blank',
        afterUrl: 'http://localhost:3000',
        consoleErrors: [],
        networkErrors: [],
        observations: [],
      },
      {
        stepId: 'step-2',
        action: 'CLICK',
        targetDescription: 'Broken Action Button',
        selector: '#broken-btn',
        status: 'PASSED',
        startedAt: '2026-09-07T12:00:01Z',
        finishedAt: '2026-09-07T12:00:02Z',
        durationMs: 1000,
        beforeUrl: 'http://localhost:3000',
        afterUrl: 'http://localhost:3000',
        consoleErrors: [],
        networkErrors: [],
        observations: [
          {
            type: 'CLICK_NO_OP',
            message: 'Element "#broken-btn" clicked successfully but triggered zero state or DOM mutations',
            severity: 'warning',
            pageUrl: 'http://localhost:3000',
            selector: '#broken-btn',
            timestamp: '2026-09-07T12:00:02Z',
          },
        ],
      },
    ],
  };

  it('classifies CLICK_NO_OP into a structured BROKEN_CONTROL bug observation with reproduction steps', () => {
    const classifier = new DeterministicIssueClassifier();
    const bugs = classifier.classify({
      testRunId: 'run-1',
      projectId: 'proj-1',
      targetUrl: 'http://localhost:3000',
      journeyResults: [sampleJourney],
    });

    expect(bugs.length).toBe(1);
    const bug = bugs[0];
    expect(bug.type).toBe('BROKEN_CONTROL');
    expect(bug.title).toBe('Broken control: Broken Action Button');
    expect(bug.reproductionSteps.length).toBe(2);
    expect(bug.reproductionSteps[0].action).toBe('NAVIGATE');
    expect(bug.reproductionSteps[1].action).toBe('CLICK');
    expect(bug.reproductionSteps[1].observedBehavior).toContain('zero state or DOM mutations');
  });

  it('does NOT create a bug for expected form validation messages', () => {
    const formJourney: JourneyResult = {
      journeyId: 'j-2',
      name: 'Form Usability Flow',
      category: 'form',
      status: 'PASSED',
      startedAt: '2026-09-07T12:00:00Z',
      finishedAt: '2026-09-07T12:00:02Z',
      durationMs: 2000,
      viewport: { width: 1280, height: 720, name: 'desktop' },
      actionsAttempted: 1,
      actionsPassed: 1,
      actionsFailed: 0,
      actionsSkipped: 0,
      pagesVisited: ['http://localhost:3000/form'],
      observations: [],
      steps: [
        {
          stepId: 'step-f1',
          action: 'VALIDATE_FORM',
          targetDescription: 'Feedback Form',
          selector: '#feedback-form',
          status: 'PASSED',
          startedAt: '2026-09-07T12:00:00Z',
          finishedAt: '2026-09-07T12:00:01Z',
          durationMs: 1000,
          beforeUrl: 'http://localhost:3000/form',
          afterUrl: 'http://localhost:3000/form',
          consoleErrors: [],
          networkErrors: [],
          observations: [
            {
              type: 'FORM_VALIDATION_FAILURE',
              message: 'Form inspection: 2 required fields identified',
              severity: 'info',
              pageUrl: 'http://localhost:3000/form',
              timestamp: '2026-09-07T12:00:01Z',
            },
          ],
        },
      ],
    };

    const classifier = new DeterministicIssueClassifier();
    const bugs = classifier.classify({
      testRunId: 'run-2',
      projectId: 'proj-1',
      targetUrl: 'http://localhost:3000',
      journeyResults: [formJourney],
    });

    expect(bugs.length).toBe(0); // Expected validation is NOT a bug!
  });
});
