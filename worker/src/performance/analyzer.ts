// ==============================================================================
// Sculra Performance Finding & Issue Analyzer (worker/src/performance/analyzer.ts)
// ==============================================================================
// Evaluates performance measurements against policy thresholds and baselines to produce
// deterministic, evidence-backed PerformanceFinding and BugObservation models.

import {
  PerformanceFinding,
  PerformanceFindingType,
  NavigationPerformance,
  WebVitalMeasurement,
  ResourceMeasurement,
  NetworkMeasurement,
  ActionPerformance,
  ReliabilityMeasurement,
  PerformanceRegression,
  PerformancePolicyConfig,
} from './types';
import { BugObservation, BugSeverity } from '../issues/types';
import { computeBugFingerprint } from '../issues/fingerprint';
import { DEFAULT_PERFORMANCE_POLICY } from './policy';

export class PerformanceFindingAnalyzer {
  /**
   * Evaluates navigation timings and Web Vitals against thresholds to produce findings.
   */
  static analyzeNavigationAndVitals(params: {
    projectId: string;
    testRunId: string;
    navigation: NavigationPerformance;
    vitals?: WebVitalMeasurement;
    workflowId?: string;
    isCritical?: boolean;
    policy?: PerformancePolicyConfig;
  }): { findings: PerformanceFinding[]; bugObservations: BugObservation[] } {
    const { projectId, testRunId, navigation, vitals, workflowId, isCritical, policy = DEFAULT_PERFORMANCE_POLICY } = params;
    const findings: PerformanceFinding[] = [];
    const bugObservations: BugObservation[] = [];

    const url = navigation.targetUrl;
    const path = navigation.path;
    const thresh = policy.thresholds;

    const addFinding = (findingData: {
      type: PerformanceFindingType;
      severity: BugSeverity;
      metric: string;
      observedValue: number;
      thresholdValue: number;
      title: string;
      summary: string;
      whyItMatters: string;
      remediationRecommendation: string;
    }) => {
      const fingerprint = computeBugFingerprint({
        projectId,
        url: path,
        bugType: findingData.type,
        action: findingData.metric,
        errorSignature: `${findingData.metric} exceeded threshold (${findingData.observedValue} > ${findingData.thresholdValue})`,
      });

      const finding: PerformanceFinding = {
        id: `perf_find_${fingerprint.substring(0, 12)}_${Date.now()}`,
        type: findingData.type,
        severity: isCritical && findingData.severity === 'medium' ? 'high' : findingData.severity,
        confidence: 'high',
        targetUrl: url,
        targetPath: path,
        metric: findingData.metric,
        observedValue: findingData.observedValue,
        thresholdValue: findingData.thresholdValue,
        title: findingData.title,
        summary: findingData.summary,
        description: `Measured ${findingData.metric} of ${findingData.observedValue}ms on ${path} exceeded the recommended limit of ${findingData.thresholdValue}ms.`,
        whyItMatters: findingData.whyItMatters,
        remediationRecommendation: findingData.remediationRecommendation,
        evidenceSummary: `Path: ${path} | Metric: ${findingData.metric} | Observed: ${findingData.observedValue} | Threshold: ${findingData.thresholdValue}`,
        workflowId,
        viewport: navigation.viewport,
        role: navigation.role,
        fingerprint,
        detectedAt: new Date().toISOString(),
      };

      findings.push(finding);

      const bug: BugObservation = {
        id: `bug_${fingerprint.substring(0, 12)}_${Date.now()}`,
        testRunId,
        projectId,
        type: findingData.type,
        severity: finding.severity,
        confidence: 'high',
        status: 'open',
        url,
        title: finding.title,
        summary: finding.summary,
        description: finding.description,
        reproductionSteps: [
          {
            stepNumber: 1,
            action: 'NAVIGATE',
            target: path,
            url,
            expectedBehavior: `${findingData.metric} within ${findingData.thresholdValue}ms`,
            observedBehavior: `Measured ${findingData.metric} of ${findingData.observedValue}ms`,
          },
        ],
        fingerprint,
        timestamp: new Date().toISOString(),
        metadata: {
          metric: findingData.metric,
          observedValue: findingData.observedValue,
          thresholdValue: findingData.thresholdValue,
          viewport: navigation.viewport,
          role: navigation.role,
        },
      };

      bugObservations.push(bug);
    };

    // 1. TTFB check
    if (navigation.ttfbMs && navigation.ttfbMs > thresh.ttfbMs.poor) {
      addFinding({
        type: 'PERFORMANCE_TTFB_SLOW',
        severity: navigation.ttfbMs > thresh.ttfbMs.poor * 2 ? 'high' : 'medium',
        metric: 'TTFB',
        observedValue: navigation.ttfbMs,
        thresholdValue: thresh.ttfbMs.poor,
        title: `Slow Server Response Time (TTFB: ${navigation.ttfbMs}ms) on ${path}`,
        summary: `Time to First Byte (${navigation.ttfbMs}ms) exceeds the ${thresh.ttfbMs.poor}ms limit.`,
        whyItMatters: 'High TTFB indicates slow backend server processing, database queries, or unoptimized network latency.',
        remediationRecommendation: 'Profile server route handlers, optimize slow database queries, and enable edge response caching.',
      });
    }

    // 2. FCP check
    if (navigation.fcpMs && navigation.fcpMs > thresh.fcpMs.poor) {
      addFinding({
        type: 'PERFORMANCE_FCP_SLOW',
        severity: 'medium',
        metric: 'FCP',
        observedValue: navigation.fcpMs,
        thresholdValue: thresh.fcpMs.poor,
        title: `Slow First Contentful Paint (FCP: ${navigation.fcpMs}ms) on ${path}`,
        summary: `First Contentful Paint (${navigation.fcpMs}ms) exceeds the ${thresh.fcpMs.poor}ms limit.`,
        whyItMatters: 'Delayed FCP makes users perceive the application as unresponsive or frozen during initial load.',
        remediationRecommendation: 'Eliminate render-blocking resources, inline critical CSS, and defer non-critical scripts.',
      });
    }

    // 3. LCP check
    if (vitals?.lcp.value && vitals.lcp.value > thresh.lcpMs.poor) {
      addFinding({
        type: 'PERFORMANCE_LCP_SLOW',
        severity: vitals.lcp.value > thresh.lcpMs.poor * 1.5 ? 'high' : 'medium',
        metric: 'LCP',
        observedValue: vitals.lcp.value,
        thresholdValue: thresh.lcpMs.poor,
        title: `Slow Largest Contentful Paint (LCP: ${vitals.lcp.value}ms) on ${path}`,
        summary: `Largest Contentful Paint (${vitals.lcp.value}ms) exceeds the ${thresh.lcpMs.poor}ms limit.`,
        whyItMatters: 'LCP marks when the main page content has likely loaded. High LCP increases user bounce rates.',
        remediationRecommendation: 'Optimize and compress hero images, preload critical media, and improve server response times.',
      });
    }

    // 4. CLS check
    if (vitals?.cls.value && vitals.cls.value > thresh.cls.poor) {
      addFinding({
        type: 'PERFORMANCE_CLS_HIGH',
        severity: 'medium',
        metric: 'CLS',
        observedValue: vitals.cls.value,
        thresholdValue: thresh.cls.poor,
        title: `High Cumulative Layout Shift (CLS: ${vitals.cls.value}) on ${path}`,
        summary: `Cumulative Layout Shift score (${vitals.cls.value}) exceeds the ${thresh.cls.poor} limit.`,
        whyItMatters: 'Layout shifts cause visual instability, jarring user experiences, and accidental clicks.',
        remediationRecommendation: 'Always set explicit dimensions (width/height) on images and dynamic embeds; reserve layout space.',
      });
    }

    // 5. Total Page Load Duration check
    if (navigation.durationMs > thresh.pageLoadDurationMs.poor) {
      addFinding({
        type: 'PERFORMANCE_NAVIGATION_SLOW',
        severity: navigation.durationMs > thresh.pageLoadDurationMs.poor * 2 ? 'high' : 'medium',
        metric: 'PageLoad',
        observedValue: navigation.durationMs,
        thresholdValue: thresh.pageLoadDurationMs.poor,
        title: `Slow Page Load Duration (${navigation.durationMs}ms) on ${path}`,
        summary: `Total page load duration (${navigation.durationMs}ms) exceeds the ${thresh.pageLoadDurationMs.poor}ms limit.`,
        whyItMatters: 'Unresponsive page load frustrates users and diminishes perceived platform quality.',
        remediationRecommendation: 'Reduce total asset payload, defer synchronous scripts, and audit third-party tags.',
      });
    }

    return { findings, bugObservations };
  }

  /**
   * Analyzes network traffic and oversized resources.
   */
  static analyzeNetworkAndResources(params: {
    projectId: string;
    testRunId: string;
    targetUrl: string;
    network: NetworkMeasurement;
    resources: ResourceMeasurement[];
    policy?: PerformancePolicyConfig;
  }): { findings: PerformanceFinding[]; bugObservations: BugObservation[] } {
    const { projectId, testRunId, targetUrl, network, resources, policy = DEFAULT_PERFORMANCE_POLICY } = params;
    const findings: PerformanceFinding[] = [];
    const bugObservations: BugObservation[] = [];
    const path = new URL(targetUrl).pathname;
    const thresh = policy.thresholds;

    // 1. Excessive request count
    if (network.requestCount > thresh.maxTotalRequestsPerPage) {
      const fingerprint = computeBugFingerprint({
        projectId,
        url: path,
        bugType: 'PERFORMANCE_TOO_MANY_REQUESTS',
        action: 'NETWORK_COUNT',
        errorSignature: `Excessive requests (${network.requestCount} > ${thresh.maxTotalRequestsPerPage})`,
      });

      const finding: PerformanceFinding = {
        id: `perf_find_reqs_${fingerprint.substring(0, 12)}_${Date.now()}`,
        type: 'PERFORMANCE_TOO_MANY_REQUESTS',
        severity: 'medium',
        confidence: 'high',
        targetUrl,
        targetPath: path,
        metric: 'RequestCount',
        observedValue: network.requestCount,
        thresholdValue: thresh.maxTotalRequestsPerPage,
        title: `Excessive Network Requests (${network.requestCount}) on ${path}`,
        summary: `Page issued ${network.requestCount} requests, exceeding the recommended limit of ${thresh.maxTotalRequestsPerPage}.`,
        description: `Page ${path} issued ${network.requestCount} HTTP requests during load, exceeding threshold of ${thresh.maxTotalRequestsPerPage}.`,
        whyItMatters: 'Excessive network requests cause connection contention and increase battery/data usage on mobile devices.',
        remediationRecommendation: 'Bundle assets, consolidate API calls, and lazy-load below-the-fold media.',
        evidenceSummary: `Path: ${path} | Total Requests: ${network.requestCount} | Transferred: ${Math.round(network.totalTransferredBytes / 1024)} KB`,
        fingerprint,
        detectedAt: new Date().toISOString(),
      };

      findings.push(finding);
      bugObservations.push({
        id: `bug_${fingerprint.substring(0, 12)}_${Date.now()}`,
        testRunId,
        projectId,
        type: 'PERFORMANCE_TOO_MANY_REQUESTS',
        severity: 'medium',
        confidence: 'high',
        status: 'open',
        url: targetUrl,
        title: finding.title,
        summary: finding.summary,
        description: finding.description,
        reproductionSteps: [
          {
            stepNumber: 1,
            action: 'NAVIGATE',
            target: path,
            url: targetUrl,
            expectedBehavior: `Under ${thresh.maxTotalRequestsPerPage} requests`,
            observedBehavior: `${network.requestCount} requests executed`,
          },
        ],
        fingerprint,
        timestamp: new Date().toISOString(),
      });
    }

    // 2. Oversized resources
    for (const res of resources.filter((r) => r.isOversized).slice(0, 3)) {
      const sizeKb = Math.round((res.decodedBodySizeBytes || res.transferSizeBytes) / 1024);
      const fingerprint = computeBugFingerprint({
        projectId,
        url: path,
        bugType: 'PERFORMANCE_RESOURCE_LARGE',
        action: res.name,
        errorSignature: `Oversized asset ${res.name} (${sizeKb} KB)`,
      });

      const finding: PerformanceFinding = {
        id: `perf_find_res_${fingerprint.substring(0, 12)}_${Date.now()}`,
        type: 'PERFORMANCE_RESOURCE_LARGE',
        severity: sizeKb > 1000 ? 'high' : 'medium',
        confidence: 'high',
        targetUrl,
        targetPath: path,
        metric: 'ResourceSize',
        observedValue: `${sizeKb} KB`,
        thresholdValue: `${Math.round(thresh.maxResourceSizeBytes / 1024)} KB`,
        title: `Oversized Asset: "${res.name}" (${sizeKb} KB)`,
        summary: `Resource "${res.name}" (${sizeKb} KB) exceeds recommended bundle threshold.`,
        description: `Resource "${res.name}" on ${path} has a transfer size of ${sizeKb} KB, exceeding threshold of ${Math.round(thresh.maxResourceSizeBytes / 1024)} KB.`,
        whyItMatters: 'Large JS/CSS/image assets prolong page download and parse times.',
        remediationRecommendation: 'Enable gzip/brotli compression, minify code, and compress images with WebP/AVIF.',
        evidenceSummary: `URL: ${res.url} | Size: ${sizeKb} KB | Duration: ${res.durationMs}ms`,
        fingerprint,
        detectedAt: new Date().toISOString(),
      };

      findings.push(finding);
      bugObservations.push({
        id: `bug_${fingerprint.substring(0, 12)}_${Date.now()}`,
        testRunId,
        projectId,
        type: 'PERFORMANCE_RESOURCE_LARGE',
        severity: finding.severity,
        confidence: 'high',
        status: 'open',
        url: targetUrl,
        title: finding.title,
        summary: finding.summary,
        description: finding.description,
        reproductionSteps: [
          {
            stepNumber: 1,
            action: 'LOAD_RESOURCE',
            target: res.name,
            url: res.url,
            expectedBehavior: `Resource size under ${Math.round(thresh.maxResourceSizeBytes / 1024)} KB`,
            observedBehavior: `Resource size is ${sizeKb} KB`,
          },
        ],
        fingerprint,
        timestamp: new Date().toISOString(),
      });
    }

    return { findings, bugObservations };
  }

  /**
   * Analyzes multi-run reliability measurements.
   */
  static analyzeReliability(params: {
    projectId: string;
    testRunId: string;
    reliability: ReliabilityMeasurement;
    isCritical?: boolean;
    policy?: PerformancePolicyConfig;
  }): { findings: PerformanceFinding[]; bugObservations: BugObservation[] } {
    const { projectId, testRunId, reliability, isCritical, policy = DEFAULT_PERFORMANCE_POLICY } = params;
    const findings: PerformanceFinding[] = [];
    const bugObservations: BugObservation[] = [];
    const path = reliability.path;

    if (!reliability.isStable || reliability.successRate < policy.thresholds.minReliabilitySuccessRate) {
      const ratePercent = Math.round(reliability.successRate * 100);
      const fingerprint = computeBugFingerprint({
        projectId,
        url: path,
        bugType: 'PERFORMANCE_PAGE_UNRELIABLE',
        action: 'RELIABILITY',
        errorSignature: `Page load success rate ${ratePercent}% (${reliability.failedAttempts} failures)`,
      });

      const severity: BugSeverity = isCritical || ratePercent < 50 ? 'critical' : 'high';

      const finding: PerformanceFinding = {
        id: `perf_find_rel_${fingerprint.substring(0, 12)}_${Date.now()}`,
        type: 'PERFORMANCE_PAGE_UNRELIABLE',
        severity,
        confidence: 'high',
        targetUrl: reliability.targetUrl,
        targetPath: path,
        metric: 'SuccessRate',
        observedValue: `${ratePercent}%`,
        thresholdValue: `${Math.round(policy.thresholds.minReliabilitySuccessRate * 100)}%`,
        title: `Unreliable Page Load Stability on ${path} (${ratePercent}% Success Rate)`,
        summary: `Page failed ${reliability.failedAttempts} of ${reliability.totalAttempts} load attempts (${reliability.timeouts} timeouts).`,
        description: `Page ${path} experienced ${reliability.failedAttempts} failures across ${reliability.totalAttempts} load attempts (${ratePercent}% success rate).`,
        whyItMatters: 'Flaky page loads degrade core user journeys and indicate underlying race conditions or infrastructure instability.',
        remediationRecommendation: 'Investigate intermittent backend timeouts, unhandled client exceptions, and flaky dependencies.',
        evidenceSummary: `Path: ${path} | Attempts: ${reliability.totalAttempts} | Successes: ${reliability.successfulAttempts} | Timeouts: ${reliability.timeouts}`,
        fingerprint,
        detectedAt: new Date().toISOString(),
      };

      findings.push(finding);
      bugObservations.push({
        id: `bug_${fingerprint.substring(0, 12)}_${Date.now()}`,
        testRunId,
        projectId,
        type: 'PERFORMANCE_PAGE_UNRELIABLE',
        severity,
        confidence: 'high',
        status: 'open',
        url: reliability.targetUrl,
        title: finding.title,
        summary: finding.summary,
        description: finding.description,
        reproductionSteps: [
          {
            stepNumber: 1,
            action: 'RELOAD_PAGE',
            target: path,
            url: reliability.targetUrl,
            expectedBehavior: `Consistent load success rate >= ${Math.round(policy.thresholds.minReliabilitySuccessRate * 100)}%`,
            observedBehavior: `${reliability.failedAttempts} of ${reliability.totalAttempts} attempts failed`,
          },
        ],
        fingerprint,
        timestamp: new Date().toISOString(),
      });
    }

    return { findings, bugObservations };
  }

  /**
   * Analyzes baseline regression.
   */
  static analyzeRegression(params: {
    projectId: string;
    testRunId: string;
    targetUrl: string;
    regression: PerformanceRegression;
    workflowId?: string;
  }): { finding?: PerformanceFinding; bugObservation?: BugObservation } {
    const { projectId, testRunId, targetUrl, regression, workflowId } = params;
    if (!regression.isRegression) return {};

    const path = new URL(targetUrl).pathname;
    const fingerprint = computeBugFingerprint({
      projectId,
      url: path,
      bugType: 'PERFORMANCE_REGRESSION',
      action: regression.metric,
      errorSignature: `${regression.metric} degraded by +${regression.percentageDelta}% (${regression.currentValue}ms vs baseline ${regression.baselineValue}ms)`,
    });

    const finding: PerformanceFinding = {
      id: `perf_find_reg_${fingerprint.substring(0, 12)}_${Date.now()}`,
      type: 'PERFORMANCE_REGRESSION',
      severity: regression.severity,
      confidence: 'high',
      targetUrl,
      targetPath: path,
      metric: regression.metric,
      observedValue: `${regression.currentValue}ms`,
      baselineValue: `${regression.baselineValue}ms`,
      regressionPercentage: regression.percentageDelta,
      thresholdValue: `+${regression.thresholdPercentage}%`,
      title: `Performance Regression on ${path}: ${regression.metric} degraded +${regression.percentageDelta}%`,
      summary: `${regression.metric} increased from ${regression.baselineValue}ms to ${regression.currentValue}ms (+${regression.percentageDelta}% change).`,
      description: `Metric ${regression.metric} on ${path} degraded by +${regression.percentageDelta}% (${regression.currentValue}ms vs historical baseline ${regression.baselineValue}ms).`,
      whyItMatters: 'Performance regressions significantly degrade end-user conversion and indicate recent code or infrastructure bottlenecks.',
      remediationRecommendation: 'Compare recent pull requests for newly introduced dependencies, unoptimized queries, or heavy frontend components.',
      evidenceSummary: `Target: ${path} | Metric: ${regression.metric} | Baseline: ${regression.baselineValue}ms | Current: ${regression.currentValue}ms (+${regression.percentageDelta}%)`,
      workflowId,
      fingerprint,
      detectedAt: new Date().toISOString(),
    };

    const bugObservation: BugObservation = {
      id: `bug_${fingerprint.substring(0, 12)}_${Date.now()}`,
      testRunId,
      projectId,
      type: 'PERFORMANCE_REGRESSION',
      severity: regression.severity,
      confidence: 'high',
      status: 'open',
      url: targetUrl,
      title: finding.title,
      summary: finding.summary,
      description: finding.description,
      reproductionSteps: [
        {
          stepNumber: 1,
          action: 'MEASURE_PERFORMANCE',
          target: regression.metric,
          url: targetUrl,
          expectedBehavior: `${regression.metric} near baseline of ${regression.baselineValue}ms`,
          observedBehavior: `${regression.metric} degraded to ${regression.currentValue}ms (+${regression.percentageDelta}%)`,
        },
      ],
      fingerprint,
      timestamp: new Date().toISOString(),
      metadata: {
        metric: regression.metric,
        currentValue: regression.currentValue,
        baselineValue: regression.baselineValue,
        percentageDelta: regression.percentageDelta,
      },
    };

    return { finding, bugObservation };
  }
}
