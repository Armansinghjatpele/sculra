// ==============================================================================
// Sculra Network Performance Tracker (worker/src/performance/network.ts)
// ==============================================================================
// Instruments Playwright network events to capture real request volumes, payload sizes,
// failure ratios, slow requests, and third-party overhead with strict zero-leakage redaction.

import { Page, Request, Response } from 'playwright';
import {
  NetworkMeasurement,
  RequestRecord,
  PerformancePolicyConfig,
} from './types';
import { DEFAULT_PERFORMANCE_POLICY } from './policy';
import { AuthRedaction } from '../auth/redaction';
import { ViewportName } from '../visual/types';

export class NetworkPerformanceTracker {
  private page: Page;
  private targetUrl: string;
  private policy: PerformancePolicyConfig;
  private viewport?: ViewportName;
  private startTime: number = Date.now();

  private requestStartTimes = new Map<Request, number>();
  private recordedRequests: RequestRecord[] = [];
  private failedRequestCount: number = 0;
  private abortedRequestCount: number = 0;
  private timeoutRequestCount: number = 0;
  private httpErrorCount: number = 0;
  private totalTransferredBytes: number = 0;

  private requestListener: (req: Request) => void;
  private responseListener: (res: Response) => void;
  private failedListener: (req: Request) => void;

  constructor(
    page: Page,
    targetUrl: string,
    options: {
      viewport?: ViewportName;
      policy?: PerformancePolicyConfig;
    } = {}
  ) {
    this.page = page;
    this.targetUrl = targetUrl;
    this.viewport = options.viewport;
    this.policy = options.policy || DEFAULT_PERFORMANCE_POLICY;

    const baseOrigin = new URL(targetUrl).origin.toLowerCase();

    // 1. Request Listener
    this.requestListener = (req: Request) => {
      this.requestStartTimes.set(req, Date.now());
    };

    // 2. Response Listener
    this.responseListener = async (res: Response) => {
      const req = res.request();
      const startTime = this.requestStartTimes.get(req) || Date.now();
      const durationMs = Date.now() - startTime;
      const status = res.status();

      let responseSizeBytes = 0;
      try {
        const headers = res.headers();
        const contentLength = headers['content-length'];
        if (contentLength) {
          responseSizeBytes = parseInt(contentLength, 10) || 0;
        }
      } catch {
        responseSizeBytes = 0;
      }

      this.totalTransferredBytes += responseSizeBytes;
      if (status >= 400) {
        this.httpErrorCount++;
      }

      const reqUrl = typeof req.url === 'function' ? req.url() : (typeof (req as any).url === 'string' ? (req as any).url : '');
      let isThirdParty = false;
      try {
        isThirdParty = Boolean(reqUrl && new URL(reqUrl).origin.toLowerCase() !== baseOrigin);
      } catch {
        isThirdParty = false;
      }

      const sanitizedUrl = this.sanitizeUrl(reqUrl);
      const reqMethod = typeof req.method === 'function' ? req.method() : (typeof (req as any).method === 'string' ? (req as any).method : 'GET');
      const reqResourceType = typeof req.resourceType === 'function' ? req.resourceType() : (typeof (req as any).resourceType === 'string' ? (req as any).resourceType : 'other');

      if (this.recordedRequests.length < this.policy.maxNetworkRequestsRecorded) {
        this.recordedRequests.push({
          url: sanitizedUrl,
          method: reqMethod,
          resourceType: reqResourceType,
          status,
          durationMs,
          responseSizeBytes,
          failed: false,
          isThirdParty,
        });
      }
    };

    // 3. Failed Request Listener
    this.failedListener = (req: Request) => {
      const failure = typeof req.failure === 'function' ? req.failure() : null;
      const failureText = failure?.errorText || 'Unknown request failure';
      const isTimeout = failureText.toLowerCase().includes('timeout');
      const isAborted = failureText.toLowerCase().includes('abort') || failureText.toLowerCase().includes('cancel');

      this.failedRequestCount++;
      if (isTimeout) this.timeoutRequestCount++;
      if (isAborted) this.abortedRequestCount++;

      const reqUrl = typeof req.url === 'function' ? req.url() : (typeof (req as any).url === 'string' ? (req as any).url : '');
      let isThirdParty = false;
      try {
        isThirdParty = Boolean(reqUrl && new URL(reqUrl).origin.toLowerCase() !== baseOrigin);
      } catch {
        isThirdParty = false;
      }

      const sanitizedUrl = this.sanitizeUrl(reqUrl);
      const reqMethod = typeof req.method === 'function' ? req.method() : (typeof (req as any).method === 'string' ? (req as any).method : 'GET');
      const reqResourceType = typeof req.resourceType === 'function' ? req.resourceType() : (typeof (req as any).resourceType === 'string' ? (req as any).resourceType : 'other');

      if (this.recordedRequests.length < this.policy.maxNetworkRequestsRecorded) {
        this.recordedRequests.push({
          url: sanitizedUrl,
          method: reqMethod,
          resourceType: reqResourceType,
          durationMs: Date.now() - (this.requestStartTimes.get(req) || Date.now()),
          responseSizeBytes: 0,
          failed: true,
          failureText,
          isThirdParty,
        });
      }
    };
  }

  /**
   * Starts tracking network events on the page.
   */
  start(): void {
    this.startTime = Date.now();
    this.page.on('request', this.requestListener);
    this.page.on('response', this.responseListener);
    this.page.on('requestfailed', this.failedListener);
  }

  /**
   * Stops tracking and compiles the structured NetworkMeasurement result.
   */
  stop(): NetworkMeasurement {
    this.page.off('request', this.requestListener);
    this.page.off('response', this.responseListener);
    this.page.off('requestfailed', this.failedListener);

    const path = new URL(this.targetUrl).pathname;
    const slowThreshold = this.policy.thresholds.apiDurationMs.poor;

    const slowRequests = this.recordedRequests.filter((r) => r.durationMs >= slowThreshold);
    const largestResponses = [...this.recordedRequests]
      .filter((r) => r.responseSizeBytes > 0)
      .sort((a, b) => b.responseSizeBytes - a.responseSizeBytes)
      .slice(0, 5);

    const slowestResponses = [...this.recordedRequests]
      .sort((a, b) => b.durationMs - a.durationMs)
      .slice(0, 5);

    const thirdPartyRequestsCount = this.recordedRequests.filter((r) => r.isThirdParty).length;

    return {
      targetUrl: this.targetUrl,
      path,
      viewport: this.viewport,
      requestCount: this.recordedRequests.length,
      responseCount: this.recordedRequests.filter((r) => !r.failed).length,
      failedRequestCount: this.failedRequestCount,
      abortedRequestCount: this.abortedRequestCount,
      timeoutRequestCount: this.timeoutRequestCount,
      httpErrorCount: this.httpErrorCount,
      slowRequestCount: slowRequests.length,
      totalTransferredBytes: this.totalTransferredBytes,
      largestResponses,
      slowestResponses,
      thirdPartyRequestsCount,
      recordedRequests: this.recordedRequests,
    };
  }

  /**
   * Redacts sensitive query parameters and URL patterns.
   */
  private sanitizeUrl(rawUrl: string): string {
    try {
      const parsed = new URL(rawUrl);
      for (const [k] of Array.from(parsed.searchParams.entries())) {
        if (AuthRedaction.isSensitiveKey(k)) {
          parsed.searchParams.set(k, '[REDACTED]');
        }
      }
      return parsed.toString();
    } catch {
      return AuthRedaction.redactString(rawUrl);
    }
  }
}
