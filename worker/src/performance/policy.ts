// ==============================================================================
// Sculra Performance Policy & Safe QA Boundaries (worker/src/performance/policy.ts)
// ==============================================================================
// Configurable, deterministic thresholds and execution bounds for navigation timing,
// Web Vitals, resource weight, API responsiveness, reliability repetitions, and regressions.

import { PerformancePolicyConfig } from './types';

export const DEFAULT_PERFORMANCE_POLICY: PerformancePolicyConfig = {
  maxPerformanceTargets: 20,
  maxPerformancePages: 10,
  maxPerformanceApis: 20,
  maxReliabilityRepetitions: 3,
  maxNetworkRequestsRecorded: 200,
  maxResourceRecords: 200,
  maxConcurrentTargets: 3,
  maxExecutionTimeMs: 120000, // 2 minutes total budget
  requestTimeoutMs: 15000, // 15s timeout
  maxResponseBytes: 1024 * 1024, // 1 MB
  enableNavigationChecks: true,
  enableWebVitals: true,
  enableNetworkChecks: true,
  enableResourceChecks: true,
  enableActionChecks: true,
  enableApiChecks: true,
  enableReliabilityChecks: true,
  enableBaselineComparison: true,
  thresholds: {
    // Time to First Byte (TTFB)
    ttfbMs: { good: 800, poor: 1800 },
    // First Contentful Paint (FCP)
    fcpMs: { good: 1800, poor: 3000 },
    // Largest Contentful Paint (LCP)
    lcpMs: { good: 2500, poor: 4000 },
    // Cumulative Layout Shift (CLS)
    cls: { good: 0.1, poor: 0.25 },
    // Interaction to Next Paint (INP)
    inpMs: { good: 200, poor: 500 },
    // DOM Content Loaded
    domContentLoadedMs: { good: 2000, poor: 4000 },
    // Total Page Load Duration
    pageLoadDurationMs: { good: 3000, poor: 6000 },
    // Single API call latency
    apiDurationMs: { good: 500, poor: 2000 },
    // Safe UI Action latency
    actionDurationMs: { good: 300, poor: 1000 },
    // Maximum resource sizes before flagging
    maxResourceSizeBytes: 500 * 1024, // 500 KB
    maxJsSizeBytes: 400 * 1024, // 400 KB
    maxCssSizeBytes: 150 * 1024, // 150 KB
    maxImageSizeBytes: 800 * 1024, // 800 KB
    // Network request count per page
    maxTotalRequestsPerPage: 75,
    // Regression threshold (percentage slower than established baseline)
    regressionThresholdPercent: 25, // 25% degradation
    criticalWorkflowRegressionThresholdPercent: 15, // 15% degradation on business-critical workflows
    // Minimum acceptable reliability rate across multi-run probes
    minReliabilitySuccessRate: 0.9, // 90%
  },
};
