// ==============================================================================
// Sculra Core Web Vitals Evaluator (worker/src/performance/web-vitals.ts)
// ==============================================================================
// Extracts real browser Core Web Vitals (LCP, CLS, INP) and supporting metrics
// with deterministic ratings, explicit availability statuses, and zero metric fabrication.

import { Page } from 'playwright';
import {
  WebVitalMeasurement,
  PerformancePolicyConfig,
  PerformanceMetricValue,
  MetricAvailability,
  PerformanceMetricRating,
} from './types';
import { DEFAULT_PERFORMANCE_POLICY } from './policy';
import { ViewportName } from '../visual/types';

export class WebVitalsEvaluator {
  /**
   * Evaluates Core Web Vitals on a live Playwright page.
   */
  static async evaluateWebVitals(
    page: Page,
    targetUrl: string,
    options: {
      viewport?: ViewportName;
      role?: string;
      policy?: PerformancePolicyConfig;
    } = {}
  ): Promise<WebVitalMeasurement> {
    const policy = options.policy || DEFAULT_PERFORMANCE_POLICY;
    const path = new URL(targetUrl).pathname;

    try {
      const rawVitals = await page.evaluate(() => {
        const result: {
          lcp: number | null;
          cls: number | null;
          inp: number | null;
          fcp: number | null;
          ttfb: number | null;
          domContentLoaded: number | null;
          loadDuration: number | null;
          lcpAvailable: boolean;
          clsAvailable: boolean;
          inpAvailable: boolean;
        } = {
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
        };

        // 1. Navigation / Paint Timings
        const navEntries = performance.getEntriesByType('navigation');
        const nav = navEntries.length > 0 ? (navEntries[0] as PerformanceNavigationTiming) : null;
        if (nav) {
          result.ttfb = nav.responseStart ? Math.round(nav.responseStart - nav.requestStart) : null;
          result.domContentLoaded = nav.domContentLoadedEventEnd ? Math.round(nav.domContentLoadedEventEnd) : null;
          result.loadDuration = nav.duration ? Math.round(nav.duration) : null;
        }

        const paintEntries = performance.getEntriesByType('paint');
        const fcpEntry = paintEntries.find((p) => p.name === 'first-contentful-paint');
        if (fcpEntry) {
          result.fcp = Math.round(fcpEntry.startTime);
        }

        // 2. Largest Contentful Paint (LCP)
        const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
        if (lcpEntries.length > 0) {
          const latestLcp = lcpEntries[lcpEntries.length - 1];
          result.lcp = Math.round(latestLcp.startTime);
          result.lcpAvailable = true;
        }

        // 3. Cumulative Layout Shift (CLS)
        const layoutShiftEntries = performance.getEntriesByType('layout-shift');
        if (layoutShiftEntries.length > 0) {
          let clsScore = 0;
          for (const entry of layoutShiftEntries as any[]) {
            if (!entry.hadRecentInput) {
              clsScore += entry.value;
            }
          }
          result.cls = Math.round(clsScore * 1000) / 1000;
          result.clsAvailable = true;
        } else if (window.PerformanceObserver && PerformanceObserver.supportedEntryTypes?.includes('layout-shift')) {
          // If supported but 0 shifts occurred
          result.cls = 0;
          result.clsAvailable = true;
        }

        // 4. Interaction to Next Paint (INP)
        const eventTimingEntries = performance.getEntriesByType('event');
        if (eventTimingEntries.length > 0) {
          let maxDuration = 0;
          for (const ev of eventTimingEntries as any[]) {
            if (ev.duration > maxDuration) {
              maxDuration = ev.duration;
            }
          }
          result.inp = Math.round(maxDuration);
          result.inpAvailable = true;
        }

        return result;
      });

      const rateNum = (val: number | null, good: number, poor: number): PerformanceMetricRating | undefined => {
        if (val === null || val === undefined) return undefined;
        if (val <= good) return 'good';
        if (val <= poor) return 'needs-improvement';
        return 'poor';
      };

      const lcpAvailability: MetricAvailability = rawVitals.lcp !== null ? 'measured' : rawVitals.lcpAvailable ? 'unavailable' : 'unsupported';
      const clsAvailability: MetricAvailability = rawVitals.cls !== null ? 'measured' : rawVitals.clsAvailable ? 'unavailable' : 'unsupported';
      const inpAvailability: MetricAvailability = rawVitals.inp !== null ? 'measured' : rawVitals.inpAvailable ? 'unavailable' : 'unsupported';
      const fcpAvailability: MetricAvailability = rawVitals.fcp !== null ? 'measured' : 'unavailable';
      const ttfbAvailability: MetricAvailability = rawVitals.ttfb !== null ? 'measured' : 'unavailable';
      const dclAvailability: MetricAvailability = rawVitals.domContentLoaded !== null ? 'measured' : 'unavailable';
      const loadAvailability: MetricAvailability = rawVitals.loadDuration !== null ? 'measured' : 'unavailable';

      const lcp: PerformanceMetricValue = {
        metric: 'LCP',
        value: rawVitals.lcp,
        unit: 'ms',
        availability: lcpAvailability,
        rating: rateNum(rawVitals.lcp, policy.thresholds.lcpMs.good, policy.thresholds.lcpMs.poor),
        threshold: policy.thresholds.lcpMs.poor,
      };

      const cls: PerformanceMetricValue = {
        metric: 'CLS',
        value: rawVitals.cls,
        unit: 'score',
        availability: clsAvailability,
        rating: rateNum(rawVitals.cls, policy.thresholds.cls.good, policy.thresholds.cls.poor),
        threshold: policy.thresholds.cls.poor,
      };

      const inp: PerformanceMetricValue = {
        metric: 'INP',
        value: rawVitals.inp,
        unit: 'ms',
        availability: inpAvailability,
        rating: rateNum(rawVitals.inp, policy.thresholds.inpMs.good, policy.thresholds.inpMs.poor),
        threshold: policy.thresholds.inpMs.poor,
      };

      const fcp: PerformanceMetricValue = {
        metric: 'FCP',
        value: rawVitals.fcp,
        unit: 'ms',
        availability: fcpAvailability,
        rating: rateNum(rawVitals.fcp, policy.thresholds.fcpMs.good, policy.thresholds.fcpMs.poor),
        threshold: policy.thresholds.fcpMs.poor,
      };

      const ttfb: PerformanceMetricValue = {
        metric: 'TTFB',
        value: rawVitals.ttfb,
        unit: 'ms',
        availability: ttfbAvailability,
        rating: rateNum(rawVitals.ttfb, policy.thresholds.ttfbMs.good, policy.thresholds.ttfbMs.poor),
        threshold: policy.thresholds.ttfbMs.poor,
      };

      const domContentLoaded: PerformanceMetricValue = {
        metric: 'DOMContentLoaded',
        value: rawVitals.domContentLoaded,
        unit: 'ms',
        availability: dclAvailability,
        rating: rateNum(rawVitals.domContentLoaded, policy.thresholds.domContentLoadedMs.good, policy.thresholds.domContentLoadedMs.poor),
        threshold: policy.thresholds.domContentLoadedMs.poor,
      };

      const loadDuration: PerformanceMetricValue = {
        metric: 'LoadDuration',
        value: rawVitals.loadDuration,
        unit: 'ms',
        availability: loadAvailability,
        rating: rateNum(rawVitals.loadDuration, policy.thresholds.pageLoadDurationMs.good, policy.thresholds.pageLoadDurationMs.poor),
        threshold: policy.thresholds.pageLoadDurationMs.poor,
      };

      return {
        targetUrl,
        path,
        viewport: options.viewport,
        role: options.role,
        lcp,
        cls,
        inp,
        fcp,
        ttfb,
        domContentLoaded,
        loadDuration,
        timestamp: new Date().toISOString(),
      };
    } catch {
      return this.createUnavailableMeasurement(targetUrl, path, options.viewport, options.role);
    }
  }

  private static createUnavailableMeasurement(
    targetUrl: string,
    path: string,
    viewport?: ViewportName,
    role?: string
  ): WebVitalMeasurement {
    return {
      targetUrl,
      path,
      viewport,
      role,
      lcp: { metric: 'LCP', value: null, unit: 'ms', availability: 'unavailable' },
      cls: { metric: 'CLS', value: null, unit: 'score', availability: 'unavailable' },
      inp: { metric: 'INP', value: null, unit: 'ms', availability: 'unavailable' },
      fcp: { metric: 'FCP', value: null, unit: 'ms', availability: 'unavailable' },
      ttfb: { metric: 'TTFB', value: null, unit: 'ms', availability: 'unavailable' },
      domContentLoaded: { metric: 'DOMContentLoaded', value: null, unit: 'ms', availability: 'unavailable' },
      loadDuration: { metric: 'LoadDuration', value: null, unit: 'ms', availability: 'unavailable' },
      timestamp: new Date().toISOString(),
    };
  }
}
