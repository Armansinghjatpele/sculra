// ==============================================================================
// Sculra Performance & Reliability Domain Models (worker/src/performance/types.ts)
// ==============================================================================
// Strongly typed domain models for browser navigation timing, Core Web Vitals,
// network metrics, resource analysis, safe action latencies, API response times,
// page reliability, baseline comparisons, regressions, and performance findings.

import { ApiHttpMethod } from '../api-qa/types';
import { BugSeverity } from '../issues/types';
import { ViewportName } from '../visual/types';

export type PerformanceTargetType =
  | 'PAGE'
  | 'API'
  | 'WORKFLOW'
  | 'ACTION'
  | 'RESOURCE';

export interface PerformanceTarget {
  id: string;
  type: PerformanceTargetType;
  path: string;
  url: string;
  method?: ApiHttpMethod;
  workflowId?: string;
  role?: string;
  viewport?: ViewportName;
  isCritical?: boolean;
  priority: number; // Higher is prioritized first
  source: 'DISCOVERY' | 'PRODUCT_MODEL' | 'OPENAPI' | 'AUTH_CONTEXT' | 'PROJECT_CONFIG';
  safeToTest: boolean;
  description?: string;
}

export type MetricAvailability = 'measured' | 'unsupported' | 'unavailable' | 'invalid';

export type PerformanceMetricRating = 'good' | 'needs-improvement' | 'poor';

export interface PerformanceMetricValue {
  metric: string;
  value: number | null;
  unit: 'ms' | 'bytes' | 'score' | 'count';
  availability: MetricAvailability;
  rating?: PerformanceMetricRating;
  threshold?: number;
}

export interface NavigationPerformance {
  targetUrl: string;
  path: string;
  viewport?: ViewportName;
  role?: string;
  status: 'SUCCESS' | 'TIMEOUT' | 'ERROR';
  statusCode?: number;
  durationMs: number;
  // Browser Performance Navigation Timing metrics
  dnsDurationMs?: number | null;
  connectDurationMs?: number | null;
  ttfbMs?: number | null; // Time To First Byte (responseStart - requestStart)
  responseDurationMs?: number | null; // responseEnd - responseStart
  domContentLoadedMs?: number | null;
  loadEventMs?: number | null;
  firstPaintMs?: number | null;
  fcpMs?: number | null; // First Contentful Paint
  lcpMs?: number | null; // Largest Contentful Paint
  transferSizeBytes?: number | null;
  encodedBodySizeBytes?: number | null;
  decodedBodySizeBytes?: number | null;
  metricDetails: Record<string, PerformanceMetricValue>;
  timestamp: string;
}

export interface WebVitalMeasurement {
  targetUrl: string;
  path: string;
  viewport?: ViewportName;
  role?: string;
  lcp: PerformanceMetricValue; // Largest Contentful Paint (ms)
  cls: PerformanceMetricValue; // Cumulative Layout Shift (score)
  inp: PerformanceMetricValue; // Interaction to Next Paint (ms)
  fcp: PerformanceMetricValue; // First Contentful Paint (ms)
  ttfb: PerformanceMetricValue; // Time to First Byte (ms)
  domContentLoaded: PerformanceMetricValue;
  loadDuration: PerformanceMetricValue;
  timestamp: string;
}

export interface ResourceMeasurement {
  url: string;
  name: string;
  initiatorType: string; // 'script' | 'css' | 'img' | 'fetch' | 'xmlhttprequest' | 'font' | 'other'
  durationMs: number;
  transferSizeBytes: number;
  encodedBodySizeBytes: number;
  decodedBodySizeBytes: number;
  statusCode?: number;
  isSlow: boolean;
  isOversized: boolean;
  isFailed: boolean;
  isDuplicate: boolean;
}

export interface RequestRecord {
  url: string;
  method: string;
  resourceType: string;
  status?: number;
  durationMs: number;
  responseSizeBytes: number;
  failed: boolean;
  failureText?: string;
  isThirdParty: boolean;
}

export interface NetworkMeasurement {
  targetUrl: string;
  path: string;
  viewport?: ViewportName;
  requestCount: number;
  responseCount: number;
  failedRequestCount: number;
  abortedRequestCount: number;
  timeoutRequestCount: number;
  httpErrorCount: number;
  slowRequestCount: number;
  totalTransferredBytes: number;
  largestResponses: RequestRecord[];
  slowestResponses: RequestRecord[];
  thirdPartyRequestsCount: number;
  recordedRequests: RequestRecord[];
}

export interface ActionPerformance {
  actionType: string;
  targetDescription: string;
  selector?: string;
  pageUrl: string;
  durationMs: number;
  resultingNavigationUrl?: string;
  networkRequestsTriggered: number;
  success: boolean;
  timeout: boolean;
  errorMessage?: string;
  timestamp: string;
}

export interface ReliabilityMeasurement {
  targetUrl: string;
  path: string;
  totalAttempts: number;
  successfulAttempts: number;
  failedAttempts: number;
  timeouts: number;
  runtimeErrors: number;
  successRate: number; // 0.0 - 1.0
  averageDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  consistencyScore: number; // 0 - 100
  isStable: boolean;
  repetitionDurations: number[];
}

export type BaselineStatus = 'BASELINE_MISSING' | 'BASELINE_AVAILABLE' | 'BASELINE_INVALID';

export interface PerformanceBaseline {
  id: string;
  projectId: string;
  targetKey: string; // e.g. "PAGE:/dashboard:desktop:ADMIN"
  targetUrl: string;
  path: string;
  viewport: ViewportName;
  role?: string;
  environment: string;
  metrics: {
    ttfbMs?: number;
    fcpMs?: number;
    lcpMs?: number;
    cls?: number;
    inpMs?: number;
    pageLoadDurationMs?: number;
    totalTransferredBytes?: number;
    requestCount?: number;
    apiDurationMs?: number;
  };
  establishedAt: string;
  testRunId: string;
  status: BaselineStatus;
}

export interface PerformanceRegression {
  metric: string;
  currentValue: number;
  baselineValue: number;
  absoluteDelta: number;
  percentageDelta: number;
  thresholdPercentage: number;
  isRegression: boolean;
  severity: BugSeverity;
}

export type PerformanceFindingType =
  | 'PERFORMANCE_NAVIGATION_SLOW'
  | 'PERFORMANCE_TTFB_SLOW'
  | 'PERFORMANCE_FCP_SLOW'
  | 'PERFORMANCE_LCP_SLOW'
  | 'PERFORMANCE_INP_SLOW'
  | 'PERFORMANCE_CLS_HIGH'
  | 'PERFORMANCE_RESOURCE_SLOW'
  | 'PERFORMANCE_RESOURCE_LARGE'
  | 'PERFORMANCE_TOO_MANY_REQUESTS'
  | 'PERFORMANCE_NETWORK_FAILURE'
  | 'PERFORMANCE_TIMEOUT'
  | 'PERFORMANCE_API_SLOW'
  | 'PERFORMANCE_API_TIMEOUT'
  | 'PERFORMANCE_RUNTIME_UNSTABLE'
  | 'PERFORMANCE_PAGE_UNRELIABLE'
  | 'PERFORMANCE_JOURNEY_UNRELIABLE'
  | 'PERFORMANCE_REGRESSION'
  | 'PERFORMANCE_BASELINE_MISSING'
  | 'PERFORMANCE_CONFIGURATION_ERROR'
  | 'PERFORMANCE_INCONCLUSIVE';

export interface PerformanceFinding {
  id: string;
  type: PerformanceFindingType;
  severity: BugSeverity;
  confidence: 'high' | 'medium' | 'low';
  targetUrl: string;
  targetPath: string;
  metric?: string;
  observedValue?: number | string;
  thresholdValue?: number | string;
  baselineValue?: number | string;
  regressionPercentage?: number;
  title: string;
  summary: string;
  description: string;
  whyItMatters: string;
  remediationRecommendation: string;
  evidenceSummary: string;
  evidence?: string[];
  baselineComparison?: any;
  metadata?: Record<string, any>;
  workflowId?: string;
  role?: string;
  viewport?: ViewportName;
  fingerprint: string;
  detectedAt: string;
}

export interface PerformanceCoverageSummary {
  targetsDiscovered: number;
  targetsTested: number;
  pagesMeasured: number;
  apisMeasured: number;
  actionsMeasured: number;
  totalMeasurements: number;
  findingsCount: number;
  criticalFindings: number;
  highFindings: number;
  mediumFindings: number;
  lowFindings: number;
  regressionsCount: number;
  performanceScore?: number; // 0 - 100, undefined if unmeasured
  durationMs: number;
}

export interface PerformanceScanResult {
  testRunId: string;
  projectId: string;
  targetUrl: string;
  coverage: PerformanceCoverageSummary;
  navigations: NavigationPerformance[];
  webVitals: WebVitalMeasurement[];
  resources: ResourceMeasurement[];
  network: NetworkMeasurement[];
  actions: ActionPerformance[];
  reliability: ReliabilityMeasurement[];
  findings: PerformanceFinding[];
  bugObservations: import('../issues/types').BugObservation[];
  baselines: PerformanceBaseline[];
}

export interface PerformancePolicyThresholds {
  ttfbMs: { good: number; poor: number };
  fcpMs: { good: number; poor: number };
  lcpMs: { good: number; poor: number };
  cls: { good: number; poor: number };
  inpMs: { good: number; poor: number };
  domContentLoadedMs: { good: number; poor: number };
  pageLoadDurationMs: { good: number; poor: number };
  apiDurationMs: { good: number; poor: number };
  actionDurationMs: { good: number; poor: number };
  maxResourceSizeBytes: number;
  maxJsSizeBytes: number;
  maxCssSizeBytes: number;
  maxImageSizeBytes: number;
  maxTotalRequestsPerPage: number;
  regressionThresholdPercent: number;
  criticalWorkflowRegressionThresholdPercent: number;
  minReliabilitySuccessRate: number;
}

export interface PerformancePolicyConfig {
  maxPerformanceTargets: number;
  maxPerformancePages: number;
  maxPerformanceApis: number;
  maxReliabilityRepetitions: number;
  maxNetworkRequestsRecorded: number;
  maxResourceRecords: number;
  maxConcurrentTargets: number;
  maxExecutionTimeMs: number;
  requestTimeoutMs: number;
  maxResponseBytes: number;
  enableNavigationChecks: boolean;
  enableWebVitals: boolean;
  enableNetworkChecks: boolean;
  enableResourceChecks: boolean;
  enableActionChecks: boolean;
  enableApiChecks: boolean;
  enableReliabilityChecks: boolean;
  enableBaselineComparison: boolean;
  thresholds: PerformancePolicyThresholds;
}
