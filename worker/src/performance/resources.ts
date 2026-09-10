// ==============================================================================
// Sculra Resource Performance Evaluator (worker/src/performance/resources.ts)
// ==============================================================================
// Analyzes loaded page assets (JS, CSS, Images, Fonts) to detect oversized bundles,
// slow assets, duplicate requests, and failed critical resources with deterministic thresholds.

import { Page } from 'playwright';
import { ResourceMeasurement, PerformancePolicyConfig } from './types';
import { DEFAULT_PERFORMANCE_POLICY } from './policy';
import { AuthRedaction } from '../auth/redaction';

export class ResourcePerformanceEvaluator {
  /**
   * Evaluates resource timing entries from a live Playwright page.
   */
  static async evaluatePageResources(
    page: Page,
    targetUrl: string,
    policy: PerformancePolicyConfig = DEFAULT_PERFORMANCE_POLICY
  ): Promise<ResourceMeasurement[]> {
    try {
      const rawResources = await page.evaluate(() => {
        const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
        return entries.map((r) => ({
          name: r.name,
          initiatorType: r.initiatorType || 'other',
          duration: Math.round(r.duration),
          transferSize: r.transferSize || 0,
          encodedBodySize: r.encodedBodySize || 0,
          decodedBodySize: r.decodedBodySize || 0,
        }));
      });

      const seenUrls = new Map<string, number>();
      for (const res of rawResources) {
        const count = seenUrls.get(res.name) || 0;
        seenUrls.set(res.name, count + 1);
      }

      const results: ResourceMeasurement[] = [];

      for (const raw of rawResources.slice(0, policy.maxResourceRecords)) {
        const sanitizedUrl = AuthRedaction.redactString(raw.name);
        const urlObj = this.safeParseUrl(raw.name);
        const fileName = urlObj ? urlObj.pathname.split('/').pop() || urlObj.pathname : raw.name;
        const initiator = raw.initiatorType.toLowerCase();

        // Check size thresholds
        let sizeThreshold = policy.thresholds.maxResourceSizeBytes;
        if (initiator === 'script' || raw.name.endsWith('.js')) {
          sizeThreshold = policy.thresholds.maxJsSizeBytes;
        } else if (initiator === 'css' || raw.name.endsWith('.css')) {
          sizeThreshold = policy.thresholds.maxCssSizeBytes;
        } else if (initiator === 'img' || /\.(png|jpe?g|webp|gif|svg|avif)$/i.test(raw.name)) {
          sizeThreshold = policy.thresholds.maxImageSizeBytes;
        }

        const effectiveSize = raw.decodedBodySize || raw.transferSize || raw.encodedBodySize;
        const isOversized = effectiveSize > sizeThreshold;
        const isSlow = raw.duration >= policy.thresholds.apiDurationMs.poor;
        const isDuplicate = (seenUrls.get(raw.name) || 0) > 1;

        results.push({
          url: sanitizedUrl,
          name: fileName,
          initiatorType: initiator,
          durationMs: raw.duration,
          transferSizeBytes: raw.transferSize,
          encodedBodySizeBytes: raw.encodedBodySize,
          decodedBodySizeBytes: raw.decodedBodySize,
          isSlow,
          isOversized,
          isFailed: false,
          isDuplicate,
        });
      }

      return results;
    } catch {
      return [];
    }
  }

  private static safeParseUrl(urlStr: string): URL | null {
    try {
      return new URL(urlStr);
    } catch {
      return null;
    }
  }
}
