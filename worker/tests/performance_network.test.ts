// ==============================================================================
// Unit Test: Network Performance Tracker (worker/tests/performance_network.test.ts)
// ==============================================================================

import { describe, it, expect } from 'vitest';
import { NetworkPerformanceTracker } from '../src/performance/network';
import { DEFAULT_PERFORMANCE_POLICY } from '../src/performance/policy';

describe('NetworkPerformanceTracker', () => {
  it('instruments network events and correctly calculates traffic summaries with redactions', async () => {
    let requestHandler: any;
    let responseHandler: any;
    let failedHandler: any;

    const mockPage: any = {
      on: (event: string, handler: any) => {
        if (event === 'request') requestHandler = handler;
        if (event === 'response') responseHandler = handler;
        if (event === 'requestfailed') failedHandler = handler;
      },
      off: () => {},
    };

    const tracker = new NetworkPerformanceTracker(mockPage, 'http://localhost/app', {
      policy: DEFAULT_PERFORMANCE_POLICY,
      viewport: 'desktop',
    });
    tracker.start();

    // Simulate standard request/response with sensitive query params and headers
    const req1 = {
      url: () => 'http://localhost/api/user?token=super_secret_123&name=Alice',
      method: () => 'GET',
      resourceType: () => 'fetch',
      headers: () => ({
        authorization: 'Bearer secret_jwt_token',
        cookie: 'session_id=confidential',
        accept: 'application/json',
      }),
    };

    const res1 = {
      request: () => req1,
      status: () => 200,
      headers: () => ({
        'content-type': 'application/json',
        'content-length': '2048',
      }),
    };

    requestHandler(req1);
    await responseHandler(res1);

    // Simulate a second request
    const req2 = {
      url: () => 'http://localhost/api/slow-report',
      method: () => 'POST',
      resourceType: () => 'xhr',
      headers: () => ({}),
    };
    const res2 = {
      request: () => req2,
      status: () => 200,
      headers: () => ({ 'content-length': '512' }),
    };

    requestHandler(req2);
    await responseHandler(res2);

    const summary = tracker.stop();

    expect(summary.requestCount).toBe(2);
    expect(summary.responseCount).toBe(2);
    expect(summary.failedRequestCount).toBe(0);
    expect(summary.totalTransferredBytes).toBe(2560);

    const capturedRequests = summary.recordedRequests;
    expect(capturedRequests.length).toBe(2);

    // Verify token & credential redaction
    const firstReq = capturedRequests[0];
    expect(firstReq.url).not.toContain('super_secret_123');
    expect(decodeURIComponent(firstReq.url)).toContain('[REDACTED]');
  });
});
