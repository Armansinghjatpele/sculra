// ==============================================================================
// Sculra Master Performance Scanner & Orchestrator (worker/src/performance/scanner.ts)
// ==============================================================================
// Coordinates deterministic performance target discovery, browser navigation timings,
// Core Web Vitals, resource/network tracking, API responsiveness, reliability probes,
// baseline comparisons, and performance readiness scoring.

import { Page } from 'playwright';
import {
  PerformanceTarget,
  PerformanceFinding,
  NavigationPerformance,
  WebVitalMeasurement,
  ResourceMeasurement,
  NetworkMeasurement,
  ActionPerformance,
  ReliabilityMeasurement,
  PerformanceBaseline,
  PerformanceCoverageSummary,
  PerformanceScanResult,
  PerformancePolicyConfig,
} from './types';
import { DEFAULT_PERFORMANCE_POLICY } from './policy';
import { PerformanceTargetDiscovery } from './discovery';
import { NavigationPerformanceEvaluator } from './navigation';
import { WebVitalsEvaluator } from './web-vitals';
import { NetworkPerformanceTracker } from './network';
import { ResourcePerformanceEvaluator } from './resources';
import { PageReliabilityEvaluator } from './reliability';
import { PerformanceBaselineManager } from './baseline';
import { PerformanceFindingAnalyzer } from './analyzer';
import { ApplicationMap, CancellationToken } from '../types';
import { ProductModel } from '../product/types';
import { RoleContext } from '../auth/types';
import { ApiEndpoint, ApiResponseObservation } from '../api-qa/types';
import { ApiExecutor } from '../api-qa/executor';
import { BugObservation } from '../issues/types';
import { computeBugFingerprint } from '../issues/fingerprint';
import { WorkerLogger } from '../logger';
import { ViewportName } from '../visual/types';
import { BrowserContext } from 'playwright';

export interface PerformanceScannerParams {
  testRunId: string;
  projectId: string;
  targetUrl: string;
  page?: Page;
  browserContext?: BrowserContext;
  applicationMap?: ApplicationMap;
  journeyResults?: any[];
  productModel?: ProductModel;
  roleContexts?: RoleContext[];
  apiEndpoints?: ApiEndpoint[];
  apiObservations?: ApiResponseObservation[];
  previousBaselines?: PerformanceBaseline[];
  explicitTargets?: Array<{ path: string; method?: string; workflowId?: string; isCritical?: boolean }>;
  policy?: Partial<PerformancePolicyConfig>;
  allowLocalhost?: boolean;
  viewport?: ViewportName;
  logger?: WorkerLogger;
  cancellationToken?: CancellationToken;
}

export class PerformanceScanner {
  private policy: PerformancePolicyConfig;
  private logger?: WorkerLogger;

  constructor(policy: Partial<PerformancePolicyConfig> = {}, logger?: WorkerLogger) {
    this.policy = {
      ...DEFAULT_PERFORMANCE_POLICY,
      ...policy,
      thresholds: {
        ...DEFAULT_PERFORMANCE_POLICY.thresholds,
        ...(policy.thresholds || {}),
      },
    };
    this.logger = logger;
  }

  /**
   * Executes the full deterministic performance scan suite across discovered targets.
   */
  async scan(params: PerformanceScannerParams): Promise<PerformanceScanResult> {
    const startTime = Date.now();
    const {
      testRunId,
      projectId,
      targetUrl,
      page,
      applicationMap,
      productModel,
      roleContexts = [],
      apiEndpoints = [],
      apiObservations = [],
      previousBaselines = [],
      explicitTargets = [],
      allowLocalhost = false,
      viewport = 'desktop',
      cancellationToken,
    } = params;

    this.logger?.log('performance_scan_started', { targetUrl, projectId });

    // 1. Discover representative performance targets
    const targets = PerformanceTargetDiscovery.discoverTargets({
      targetUrl,
      applicationMap,
      productModel,
      roleContexts,
      apiEndpoints,
      explicitTargets,
      policy: this.policy,
      logger: this.logger,
    });

    const navigations: NavigationPerformance[] = [];
    const webVitals: WebVitalMeasurement[] = [];
    const resources: ResourceMeasurement[] = [];
    const network: NetworkMeasurement[] = [];
    const actions: ActionPerformance[] = [];
    const reliability: ReliabilityMeasurement[] = [];
    const findings: PerformanceFinding[] = [];
    const bugObservations: BugObservation[] = [];
    const baselines: PerformanceBaseline[] = [];

    const testedTargetIds = new Set<string>();
    let pagesMeasuredCount = 0;
    let apisMeasuredCount = 0;

    // 2. Measure Page Navigation, Web Vitals, Network, and Resources
    if (page && !cancellationToken?.isCancelled) {
      const pageTargets = targets.filter((t) => t.type === 'PAGE').slice(0, this.policy.maxPerformancePages);

      for (const pt of pageTargets) {
        if (cancellationToken?.isCancelled) break;
        testedTargetIds.add(pt.id);

        const tracker = new NetworkPerformanceTracker(page, pt.url, {
          viewport,
          policy: this.policy,
        });

        try {
          tracker.start();

          await page.goto(pt.url, {
            timeout: this.policy.requestTimeoutMs,
            waitUntil: 'domcontentloaded',
          });

          // Allow pending micro-tasks and paint events to resolve
          await page.waitForTimeout(300);

          const netMeasurement = tracker.stop();
          network.push(netMeasurement);

          // Extract navigation timing
          if (this.policy.enableNavigationChecks) {
            const navPerf = await NavigationPerformanceEvaluator.evaluatePageNavigation(page, pt.url, {
              viewport,
              role: pt.role,
              policy: this.policy,
            });
            navigations.push(navPerf);
            pagesMeasuredCount++;

            // Extract Web Vitals
            let vitalsPerf: WebVitalMeasurement | undefined;
            if (this.policy.enableWebVitals) {
              vitalsPerf = await WebVitalsEvaluator.evaluateWebVitals(page, pt.url, {
                viewport,
                role: pt.role,
                policy: this.policy,
              });
              webVitals.push(vitalsPerf);
            }

            // Extract Resources
            let resMeasurements: ResourceMeasurement[] = [];
            if (this.policy.enableResourceChecks) {
              resMeasurements = await ResourcePerformanceEvaluator.evaluatePageResources(
                page,
                pt.url,
                this.policy
              );
              resources.push(...resMeasurements);
            }

            // Analyze findings
            const navAnalysis = PerformanceFindingAnalyzer.analyzeNavigationAndVitals({
              projectId,
              testRunId,
              navigation: navPerf,
              vitals: vitalsPerf,
              workflowId: pt.workflowId,
              isCritical: pt.isCritical,
              policy: this.policy,
            });
            findings.push(...navAnalysis.findings);
            bugObservations.push(...navAnalysis.bugObservations);

            const netAnalysis = PerformanceFindingAnalyzer.analyzeNetworkAndResources({
              projectId,
              testRunId,
              targetUrl: pt.url,
              network: netMeasurement,
              resources: resMeasurements,
              policy: this.policy,
            });
            findings.push(...netAnalysis.findings);
            bugObservations.push(...netAnalysis.bugObservations);

            // Baseline & Regression Analysis
            const targetKey = PerformanceBaselineManager.generateTargetKey({
              type: 'PAGE',
              path: pt.path,
              viewport,
              role: pt.role,
            });

            // Compare against historical baseline if available
            if (this.policy.enableBaselineComparison) {
              const matchingBaseline = previousBaselines.find((b) => b.targetKey === targetKey);
              if (matchingBaseline && matchingBaseline.metrics.pageLoadDurationMs) {
                const reg = PerformanceBaselineManager.evaluateRegression({
                  metric: 'PageLoad',
                  currentValue: navPerf.durationMs,
                  baselineValue: matchingBaseline.metrics.pageLoadDurationMs,
                  isCriticalWorkflow: pt.isCritical,
                  policy: this.policy,
                });

                if (reg.isRegression) {
                  const regAnalysis = PerformanceFindingAnalyzer.analyzeRegression({
                    projectId,
                    testRunId,
                    targetUrl: pt.url,
                    regression: reg,
                    workflowId: pt.workflowId,
                  });
                  if (regAnalysis.finding) findings.push(regAnalysis.finding);
                  if (regAnalysis.bugObservation) bugObservations.push(regAnalysis.bugObservation);
                }
              }
            }

            // Record new baseline
            const newBaseline = PerformanceBaselineManager.createBaseline({
              projectId,
              testRunId,
              targetKey,
              targetUrl: pt.url,
              path: pt.path,
              viewport,
              role: pt.role,
              metrics: {
                ttfbMs: navPerf.ttfbMs || undefined,
                fcpMs: navPerf.fcpMs || undefined,
                lcpMs: vitalsPerf?.lcp.value || undefined,
                cls: vitalsPerf?.cls.value || undefined,
                inpMs: vitalsPerf?.inp.value || undefined,
                pageLoadDurationMs: navPerf.durationMs,
                totalTransferredBytes: netMeasurement.totalTransferredBytes,
                requestCount: netMeasurement.requestCount,
              },
            });
            baselines.push(newBaseline);
          }
        } catch (err: any) {
          tracker.stop();
          this.logger?.warn('performance_page_eval_error', { url: pt.url, error: err.message });
        }
      }

      // 3. Multi-Run Page Reliability Evaluation (On critical pages)
      if (this.policy.enableReliabilityChecks && !cancellationToken?.isCancelled) {
        const reliabilityTargets = pageTargets.filter((t) => t.isCritical).slice(0, 2);
        for (const rt of reliabilityTargets) {
          if (cancellationToken?.isCancelled) break;
          try {
            const relMeasurement = await PageReliabilityEvaluator.evaluatePageReliability(
              page,
              rt.url,
              this.policy
            );
            reliability.push(relMeasurement);

            const relAnalysis = PerformanceFindingAnalyzer.analyzeReliability({
              projectId,
              testRunId,
              reliability: relMeasurement,
              isCritical: rt.isCritical,
              policy: this.policy,
            });
            findings.push(...relAnalysis.findings);
            bugObservations.push(...relAnalysis.bugObservations);
          } catch (err: any) {
            this.logger?.warn('performance_reliability_eval_error', { url: rt.url, error: err.message });
          }
        }
      }
    }

    // 4. API Performance Evaluation
    if (this.policy.enableApiChecks && !cancellationToken?.isCancelled) {
      const apiExecutor = new ApiExecutor({
        allowLocalhost,
        logger: this.logger,
        limits: {
          requestTimeoutMs: this.policy.requestTimeoutMs,
          maxResponseBytes: this.policy.maxResponseBytes,
        },
      });

      // Analyze existing API observations from previous phases first
      const processedEndpointIds = new Set<string>();
      for (const obs of apiObservations) {
        processedEndpointIds.add(obs.endpointId);
        apisMeasuredCount++;
        this.evaluateApiLatency(obs, projectId, testRunId, findings, bugObservations);
      }

      // Probe remaining safe API endpoints up to cap
      const apiTargets = targets
        .filter((t) => t.type === 'API' && !processedEndpointIds.has(t.id))
        .slice(0, this.policy.maxPerformanceApis);

      for (const at of apiTargets) {
        if (cancellationToken?.isCancelled) break;
        testedTargetIds.add(at.id);

        try {
          const obs = await apiExecutor.execute(
            {
              endpointId: at.id,
              method: at.method || 'GET',
              url: at.url,
            },
            { allowLocalhost, explicitlySafe: true, logger: this.logger, cancellationToken }
          );

          apisMeasuredCount++;
          this.evaluateApiLatency(obs, projectId, testRunId, findings, bugObservations);
        } catch (err: any) {
          this.logger?.warn('performance_api_probe_error', { url: at.url, error: err.message });
        }
      }
    }

    // 5. Compute Coverage Summary & Authoritative Score
    const durationMs = Date.now() - startTime;
    const criticalFindings = findings.filter((f) => f.severity === 'critical').length;
    const highFindings = findings.filter((f) => f.severity === 'high').length;
    const mediumFindings = findings.filter((f) => f.severity === 'medium').length;
    const lowFindings = findings.filter((f) => f.severity === 'low').length;
    const regressionsCount = findings.filter((f) => f.type === 'PERFORMANCE_REGRESSION').length;

    const totalMeasurements =
      navigations.length + webVitals.length + resources.length + network.length + actions.length + reliability.length + apisMeasuredCount;

    // Mathematical Performance Score Calculation (0-100)
    // Only compute a score if measurements or findings were actually evaluated; otherwise undefined
    let performanceScore: number | undefined;
    if (totalMeasurements > 0 || findings.length > 0) {
      let rawScore = 100;
      rawScore -= criticalFindings * 35;
      rawScore -= highFindings * 15;
      rawScore -= mediumFindings * 6;
      rawScore -= lowFindings * 2;
      rawScore -= regressionsCount * 10;
      performanceScore = Math.max(0, Math.min(100, rawScore));
    }

    const coverage: PerformanceCoverageSummary = {
      targetsDiscovered: targets.length,
      targetsTested: testedTargetIds.size,
      pagesMeasured: pagesMeasuredCount,
      apisMeasured: apisMeasuredCount,
      actionsMeasured: actions.length,
      totalMeasurements,
      findingsCount: findings.length,
      criticalFindings,
      highFindings,
      mediumFindings,
      lowFindings,
      regressionsCount,
      performanceScore,
      durationMs,
    };

    this.logger?.log('performance_scan_completed', {
      targetsDiscovered: targets.length,
      totalMeasurements,
      findingsCount: findings.length,
      criticalFindings,
      highFindings,
      performanceScore,
      durationMs,
    });

    return {
      testRunId,
      projectId,
      targetUrl,
      coverage,
      navigations,
      webVitals,
      resources,
      network,
      actions,
      reliability,
      findings,
      bugObservations,
      baselines,
    };
  }

  /**
   * Helper evaluating single API latency against thresholds.
   */
  private evaluateApiLatency(
    obs: ApiResponseObservation,
    projectId: string,
    testRunId: string,
    findings: PerformanceFinding[],
    bugObservations: BugObservation[]
  ): void {
    const thresh = this.policy.thresholds;
    const path = new URL(obs.url).pathname;

    if (obs.durationMs > thresh.apiDurationMs.poor) {
      const isExtreme = obs.durationMs > thresh.apiDurationMs.poor * 2;
      const fingerprint = computeBugFingerprint({
        projectId,
        url: path,
        bugType: 'PERFORMANCE_API_SLOW',
        action: obs.method,
        errorSignature: `Slow API endpoint ${obs.method} ${path} (${obs.durationMs}ms > ${thresh.apiDurationMs.poor}ms)`,
      });

      const finding: PerformanceFinding = {
        id: `perf_find_api_${fingerprint.substring(0, 12)}_${Date.now()}`,
        type: 'PERFORMANCE_API_SLOW',
        severity: isExtreme ? 'high' : 'medium',
        confidence: 'high',
        targetUrl: obs.url,
        targetPath: path,
        metric: 'ApiDuration',
        observedValue: `${obs.durationMs}ms`,
        thresholdValue: `${thresh.apiDurationMs.poor}ms`,
        title: `Slow API Response (${obs.durationMs}ms) on ${obs.method} ${path}`,
        summary: `API endpoint ${obs.method} ${path} responded in ${obs.durationMs}ms, exceeding the ${thresh.apiDurationMs.poor}ms threshold.`,
        description: `API endpoint ${obs.method} ${path} responded in ${obs.durationMs}ms, exceeding threshold of ${thresh.apiDurationMs.poor}ms.`,
        whyItMatters: 'Slow API endpoints delay client data rendering and degrade application responsiveness.',
        remediationRecommendation: 'Optimize database indexes, profile backend query execution, and implement caching.',
        evidenceSummary: `Endpoint: ${obs.method} ${path} | Duration: ${obs.durationMs}ms | Status: ${obs.status}`,
        fingerprint,
        detectedAt: new Date().toISOString(),
      };

      findings.push(finding);
      bugObservations.push({
        id: `bug_${fingerprint.substring(0, 12)}_${Date.now()}`,
        testRunId,
        projectId,
        type: 'PERFORMANCE_API_SLOW',
        severity: finding.severity,
        confidence: 'high',
        status: 'open',
        url: obs.url,
        title: finding.title,
        summary: finding.summary,
        description: finding.description,
        reproductionSteps: [
          {
            stepNumber: 1,
            action: obs.method,
            target: path,
            url: obs.url,
            expectedBehavior: `API response within ${thresh.apiDurationMs.poor}ms`,
            observedBehavior: `Responded in ${obs.durationMs}ms`,
          },
        ],
        fingerprint,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
