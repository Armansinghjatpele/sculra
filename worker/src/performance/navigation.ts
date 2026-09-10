// ==============================================================================
// Sculra Navigation Performance Evaluator (worker/src/performance/navigation.ts)
// ==============================================================================
// Measures real browser Navigation Timing API metrics (DNS, TCP, TTFB, DOMContentLoaded,
// Load, FCP, LCP) with explicit availability states and threshold evaluation.

import { Page } from 'playwright';
import {
  NavigationPerformance,
  PerformancePolicyConfig,
  PerformanceMetricValue,
  MetricAvailability,
  PerformanceMetricRating,
} from './types';
import { DEFAULT_PERFORMANCE_POLICY } from './policy';
import { ViewportName } from '../visual/types';

export class NavigationPerformanceEvaluator {
  /**
   * Evaluates navigation performance timing for a given Playwright page.
   */
  static async evaluatePageNavigation(
    page: Page,
    targetUrl: string,
    options: {
      viewport?: ViewportName;
      role?: string;
      policy?: PerformancePolicyConfig;
    } = {}
  ): Promise<NavigationPerformance> {
    const policy = options.policy || DEFAULT_PERFORMANCE_POLICY;
    const path = new URL(targetUrl).pathname;

    try {
      // Extract browser performance timing via window.performance
      const rawTimings = await page.evaluate(() => {
        const navEntries = performance.getEntriesByType('navigation');
        const nav = navEntries.length > 0 ? (navEntries[0] as PerformanceNavigationTiming) : null;
        const paintEntries = performance.getEntriesByType('paint');

        const fpEntry = paintEntries.find((p) => p.name === 'first-paint');
        const fcpEntry = paintEntries.find((p) => p.name === 'first-contentful-paint');

        if (nav) {
          return {
            source: 'PerformanceNavigationTiming',
            duration: nav.duration,
            domainLookupStart: nav.domainLookupStart,
            domainLookupEnd: nav.domainLookupEnd,
            connectStart: nav.connectStart,
            connectEnd: nav.connectEnd,
            requestStart: nav.requestStart,
            responseStart: nav.responseStart,
            responseEnd: nav.responseEnd,
            domContentLoadedEventStart: nav.domContentLoadedEventStart,
            domContentLoadedEventEnd: nav.domContentLoadedEventEnd,
            loadEventStart: nav.loadEventStart,
            loadEventEnd: nav.loadEventEnd,
            transferSize: nav.transferSize,
            encodedBodySize: nav.encodedBodySize,
            decodedBodySize: nav.decodedBodySize,
            firstPaint: fpEntry ? fpEntry.startTime : null,
            firstContentfulPaint: fcpEntry ? fcpEntry.startTime : null,
          };
        }

        // Fallback to legacy performance.timing
        const t = performance.timing;
        if (t && t.navigationStart) {
          const origin = t.navigationStart;
          return {
            source: 'performance.timing',
            duration: t.loadEventEnd ? t.loadEventEnd - origin : Date.now() - origin,
            domainLookupStart: t.domainLookupStart ? t.domainLookupStart - origin : 0,
            domainLookupEnd: t.domainLookupEnd ? t.domainLookupEnd - origin : 0,
            connectStart: t.connectStart ? t.connectStart - origin : 0,
            connectEnd: t.connectEnd ? t.connectEnd - origin : 0,
            requestStart: t.requestStart ? t.requestStart - origin : 0,
            responseStart: t.responseStart ? t.responseStart - origin : 0,
            responseEnd: t.responseEnd ? t.responseEnd - origin : 0,
            domContentLoadedEventStart: t.domContentLoadedEventStart ? t.domContentLoadedEventStart - origin : 0,
            domContentLoadedEventEnd: t.domContentLoadedEventEnd ? t.domContentLoadedEventEnd - origin : 0,
            loadEventStart: t.loadEventStart ? t.loadEventStart - origin : 0,
            loadEventEnd: t.loadEventEnd ? t.loadEventEnd - origin : 0,
            transferSize: 0,
            encodedBodySize: 0,
            decodedBodySize: 0,
            firstPaint: fpEntry ? fpEntry.startTime : null,
            firstContentfulPaint: fcpEntry ? fcpEntry.startTime : null,
          };
        }

        return null;
      });

      if (!rawTimings) {
        return this.createUnavailableMeasurement(targetUrl, path, options.viewport, options.role, 'Performance timing API unavailable');
      }

      const calcDiff = (start?: number | null, end?: number | null): number | null => {
        if (typeof start === 'number' && typeof end === 'number' && end >= start && start >= 0) {
          return Math.round(end - start);
        }
        return null;
      };

      const dnsDurationMs = calcDiff(rawTimings.domainLookupStart, rawTimings.domainLookupEnd);
      const connectDurationMs = calcDiff(rawTimings.connectStart, rawTimings.connectEnd);
      const ttfbMs = calcDiff(rawTimings.requestStart, rawTimings.responseStart);
      const responseDurationMs = calcDiff(rawTimings.responseStart, rawTimings.responseEnd);
      const domContentLoadedMs = rawTimings.domContentLoadedEventEnd && rawTimings.domContentLoadedEventEnd > 0
        ? Math.round(rawTimings.domContentLoadedEventEnd)
        : null;
      const loadEventMs = rawTimings.loadEventEnd && rawTimings.loadEventEnd > 0
        ? Math.round(rawTimings.loadEventEnd)
        : null;
      const firstPaintMs = typeof rawTimings.firstPaint === 'number' ? Math.round(rawTimings.firstPaint) : null;
      const fcpMs = typeof rawTimings.firstContentfulPaint === 'number' ? Math.round(rawTimings.firstContentfulPaint) : null;
      const totalDurationMs = Math.round(rawTimings.duration || loadEventMs || 0);

      // Evaluate ratings against policy thresholds
      const rateMetric = (val: number | null, goodThresh: number, poorThresh: number): PerformanceMetricRating | undefined => {
        if (val === null || val === undefined) return undefined;
        if (val <= goodThresh) return 'good';
        if (val <= poorThresh) return 'needs-improvement';
        return 'poor';
      };

      const metricDetails: Record<string, PerformanceMetricValue> = {
        ttfb: {
          metric: 'TTFB',
          value: ttfbMs,
          unit: 'ms',
          availability: ttfbMs !== null ? 'measured' : 'unavailable',
          rating: rateMetric(ttfbMs, policy.thresholds.ttfbMs.good, policy.thresholds.ttfbMs.poor),
          threshold: policy.thresholds.ttfbMs.poor,
        },
        fcp: {
          metric: 'FCP',
          value: fcpMs,
          unit: 'ms',
          availability: fcpMs !== null ? 'measured' : 'unavailable',
          rating: rateMetric(fcpMs, policy.thresholds.fcpMs.good, policy.thresholds.fcpMs.poor),
          threshold: policy.thresholds.fcpMs.poor,
        },
        domContentLoaded: {
          metric: 'DOMContentLoaded',
          value: domContentLoadedMs,
          unit: 'ms',
          availability: domContentLoadedMs !== null ? 'measured' : 'unavailable',
          rating: rateMetric(domContentLoadedMs, policy.thresholds.domContentLoadedMs.good, policy.thresholds.domContentLoadedMs.poor),
          threshold: policy.thresholds.domContentLoadedMs.poor,
        },
        loadEvent: {
          metric: 'LoadEvent',
          value: loadEventMs,
          unit: 'ms',
          availability: loadEventMs !== null ? 'measured' : 'unavailable',
          rating: rateMetric(loadEventMs, policy.thresholds.pageLoadDurationMs.good, policy.thresholds.pageLoadDurationMs.poor),
          threshold: policy.thresholds.pageLoadDurationMs.poor,
        },
      };

      return {
        targetUrl,
        path,
        viewport: options.viewport,
        role: options.role,
        status: 'SUCCESS',
        statusCode: 200,
        durationMs: totalDurationMs,
        dnsDurationMs,
        connectDurationMs,
        ttfbMs,
        responseDurationMs,
        domContentLoadedMs,
        loadEventMs,
        firstPaintMs,
        fcpMs,
        lcpMs: null, // Populated by WebVitalsEvaluator
        transferSizeBytes: rawTimings.transferSize || null,
        encodedBodySizeBytes: rawTimings.encodedBodySize || null,
        decodedBodySizeBytes: rawTimings.decodedBodySize || null,
        metricDetails,
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      return this.createUnavailableMeasurement(targetUrl, path, options.viewport, options.role, err.message);
    }
  }

  private static createUnavailableMeasurement(
    targetUrl: string,
    path: string,
    viewport?: ViewportName,
    role?: string,
    errorMsg?: string
  ): NavigationPerformance {
    return {
      targetUrl,
      path,
      viewport,
      role,
      status: 'ERROR',
      durationMs: 0,
      dnsDurationMs: null,
      connectDurationMs: null,
      ttfbMs: null,
      responseDurationMs: null,
      domContentLoadedMs: null,
      loadEventMs: null,
      firstPaintMs: null,
      fcpMs: null,
      lcpMs: null,
      transferSizeBytes: null,
      encodedBodySizeBytes: null,
      decodedBodySizeBytes: null,
      metricDetails: {
        ttfb: { metric: 'TTFB', value: null, unit: 'ms', availability: 'unavailable' },
        fcp: { metric: 'FCP', value: null, unit: 'ms', availability: 'unavailable' },
        domContentLoaded: { metric: 'DOMContentLoaded', value: null, unit: 'ms', availability: 'unavailable' },
        loadEvent: { metric: 'LoadEvent', value: null, unit: 'ms', availability: 'unavailable' },
      },
      timestamp: new Date().toISOString(),
    };
  }
}
