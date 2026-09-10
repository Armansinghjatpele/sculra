// ==============================================================================
// Unit Test: Navigation Performance Evaluator (worker/tests/performance_navigation.test.ts)
// ==============================================================================

import { describe, it, expect } from 'vitest';
import { NavigationPerformanceEvaluator } from '../src/performance/navigation';
import { DEFAULT_PERFORMANCE_POLICY } from '../src/performance/policy';
import { WebVitalsEvaluator } from '../src/performance/web-vitals';

describe('NavigationPerformanceEvaluator', () => {
  it('handles unavailable navigation timings with explicit metric states without fabricating zeroes', async () => {
    const mockPage: any = {
      evaluate: async () => null,
    };

    const result = await NavigationPerformanceEvaluator.evaluatePageNavigation(
      mockPage,
      'http://localhost/test',
      {
        viewport: 'desktop',
        policy: DEFAULT_PERFORMANCE_POLICY,
      }
    );

    expect(result.targetUrl).toBe('http://localhost/test');
    expect(result.viewport).toBe('desktop');
    expect(result.ttfbMs).toBeNull();
    expect(result.domContentLoadedMs).toBeNull();
    expect(result.loadEventMs).toBeNull();
    expect(result.metricDetails.ttfb.availability).toBe('unavailable');
    expect(result.metricDetails.ttfb.value).toBeNull();
  });

  it('correctly extracts navigation timing metrics from window.performance timing entries', async () => {
    const mockTimingData = {
      source: 'PerformanceNavigationTiming',
      duration: 380,
      domainLookupStart: 10,
      domainLookupEnd: 22.5,
      connectStart: 22.5,
      connectEnd: 46.7,
      requestStart: 46.7,
      responseStart: 132.1,
      responseEnd: 162.1,
      domContentLoadedEventStart: 220,
      domContentLoadedEventEnd: 230,
      loadEventStart: 370,
      loadEventEnd: 380,
      transferSize: 45000,
      encodedBodySize: 42000,
      decodedBodySize: 120000,
      firstPaint: 180,
      firstContentfulPaint: 210,
      redirectCount: 0,
      type: 'navigate',
      protocol: 'http/1.1',
    };

    const mockPage: any = {
      evaluate: async () => mockTimingData,
    };

    const result = await NavigationPerformanceEvaluator.evaluatePageNavigation(
      mockPage,
      'http://localhost/dashboard',
      {
        viewport: 'desktop',
        policy: DEFAULT_PERFORMANCE_POLICY,
      }
    );

    expect(result.targetUrl).toBe('http://localhost/dashboard');
    expect(result.dnsDurationMs).toBe(13); // Math.round(22.5 - 10) = 13
    expect(result.ttfbMs).toBe(85); // Math.round(132.1 - 46.7) = 85
    expect(result.domContentLoadedMs).toBe(230);
    expect(result.loadEventMs).toBe(380);
    expect(result.transferSizeBytes).toBe(45000);
    expect(result.metricDetails.ttfb.availability).toBe('measured');
    expect(result.metricDetails.ttfb.value).toBe(85);
  });
});

describe('WebVitalsEvaluator', () => {
  it('returns unavailable web vital states when browser does not capture observers', async () => {
    const mockPage: any = {
      evaluate: async () => ({
        lcp: null,
        cls: null,
        inp: null,
        fcp: null,
        ttfb: null,
        domContentLoaded: null,
        loadDuration: null,
        lcpAvailable: false,
        clsAvailable: false,
        inpAvailable: false,
      }),
    };

    const vitals = await WebVitalsEvaluator.evaluateWebVitals(
      mockPage,
      'http://localhost/test',
      {
        viewport: 'desktop',
        policy: DEFAULT_PERFORMANCE_POLICY,
      }
    );

    expect(['unsupported', 'unavailable']).toContain(vitals.lcp.availability);
    expect(['unsupported', 'unavailable']).toContain(vitals.cls.availability);
    expect(['unsupported', 'unavailable']).toContain(vitals.inp.availability);
  });

  it('correctly reports healthy Web Vitals status against thresholds', async () => {
    const mockPage: any = {
      evaluate: async () => ({
        lcp: 1800, // < 2500 good
        cls: 0.05, // < 0.1 good
        inp: 120, // < 200 good
        fcp: 1200, // < 1800 good
        ttfb: 350, // < 800 good
        domContentLoaded: 600,
        loadDuration: 1500,
        lcpAvailable: true,
        clsAvailable: true,
        inpAvailable: true,
      }),
    };

    const vitals = await WebVitalsEvaluator.evaluateWebVitals(
      mockPage,
      'http://localhost/test',
      {
        viewport: 'desktop',
        policy: DEFAULT_PERFORMANCE_POLICY,
      }
    );

    expect(vitals.lcp.availability).toBe('measured');
    expect(vitals.lcp.value).toBe(1800);
    expect(vitals.cls.availability).toBe('measured');
    expect(vitals.cls.value).toBe(0.05);
    expect(vitals.fcp.availability).toBe('measured');
    expect(vitals.fcp.value).toBe(1200);
  });

  it('preserves genuine metric value of 0 without coercing to unavailable or null', async () => {
    const mockPage: any = {
      evaluate: async () => ({
        lcp: 1200,
        cls: 0, // Perfect zero CLS shift
        inp: 0,
        fcp: 900,
        ttfb: 150,
        domContentLoaded: 400,
        loadDuration: 800,
        lcpAvailable: true,
        clsAvailable: true,
        inpAvailable: true,
      }),
    };

    const vitals = await WebVitalsEvaluator.evaluateWebVitals(
      mockPage,
      'http://localhost/test',
      {
        viewport: 'desktop',
        policy: DEFAULT_PERFORMANCE_POLICY,
      }
    );

    expect(vitals.cls.availability).toBe('measured');
    expect(vitals.cls.value).toBe(0);
    expect(vitals.inp.availability).toBe('measured');
    expect(vitals.inp.value).toBe(0);
  });
});
