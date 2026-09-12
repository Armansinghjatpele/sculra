// ==============================================================================
// Sculra Historical QA Memory & Regression Analyzer (worker/src/history/analyzer.ts)
// ==============================================================================
// Master orchestrator coordinating cross-run compatibility, fingerprint matching,
// regression detection, recovery evaluation, recurrence tracking, stability signals,
// coverage & metric trends, priority boosting, and AI interpretation.

import {
  HistoricalRun,
  RunComparison,
  QASignalRecord,
  HistoricalSummary,
  RegressionEvent,
  RecoveryEvent,
  RecurrenceEvent,
  StabilitySignal,
  CoverageTrend,
  HistoricalMetricDelta,
  HistoricalFinding,
  HistoricalSignalType,
} from './types';
import { HistoricalPolicyConfig, DEFAULT_HISTORICAL_POLICY } from './policy';
import { RunNormalizer } from './run-normalizer';
import { RunComparator } from './comparator';
import { FindingMatcher } from './matcher';
import { RegressionDetector } from './regression';
import { RecoveryDetector, RetestedTargetCoverage } from './recovery';
import { RecurrenceTracker } from './recurrence';
import { StabilityAnalyzer, TargetObservationHistory } from './stability';
import { TrendAnalyzer } from './trends';
import { CoverageTrendTracker } from './coverage';
import { HistoricalAIInterpreter } from './ai-interpreter';
import { ProductModel } from '../product/types';
import OpenAI from 'openai';

export interface HistoricalAnalysisInput {
  currentRun: HistoricalRun;
  historicalRuns: HistoricalRun[];
  policyConfig?: Partial<HistoricalPolicyConfig>;
  productModel?: ProductModel;
  enableAI?: boolean;
  aiClient?: OpenAI;
  apiKey?: string;
  aiModel?: string;
}

export class HistoricalAnalyzer {
  /**
   * Main entry point to perform cross-run intelligence and regression analysis.
   */
  public static async analyze(input: HistoricalAnalysisInput): Promise<RunComparison> {
    const startTime = Date.now();
    const policy: HistoricalPolicyConfig = {
      ...DEFAULT_HISTORICAL_POLICY,
      ...input.policyConfig,
    };

    // 1. Normalize current run and history
    const normalizedCurrent = RunNormalizer.normalizeRun(input.currentRun);
    const normalizedHistory = (input.historicalRuns || [])
      .map((r) => RunNormalizer.normalizeRun(r))
      .filter((r) => r.testRunId !== normalizedCurrent.testRunId)
      .slice(0, policy.maxHistoricalRuns);

    // 2. Select best comparable run
    const compResult = RunComparator.selectBestComparableRun(normalizedCurrent, normalizedHistory);
    const bestComparable = compResult.bestMatch?.run;
    const compatibleRuns = compResult.compatibleRuns.map((c) => c.run);
    const compatibleHistoryCount = compatibleRuns.length;
    const isComparable = compResult.status === 'COMPARABLE' && !!bestComparable;
    const comparisonStatus = compResult.status;

    let regressions: RegressionEvent[] = [];
    let recoveries: RecoveryEvent[] = [];
    let recurrences: RecurrenceEvent[] = [];
    let notRetestedFindings: HistoricalFinding[] = [];
    let stabilitySignals: StabilitySignal[] = [];
    let coverageTrends: CoverageTrend[] = [];
    let metricDeltas: HistoricalMetricDelta[] = [];
    let scoreDelta: number | undefined = undefined;
    let releaseTrend = TrendAnalyzer.classifySeriesTrend([]);

    const currentFindings = normalizedCurrent.findings || [];
    const previousFindings = bestComparable?.findings || [];

    if (isComparable && bestComparable) {
      // 3. Match Findings (Fingerprint & Secondary Signature)
      const matchResult = FindingMatcher.matchFindings(currentFindings, previousFindings);

      // 4. Detect Regressions
      regressions = RegressionDetector.detectRegressions(
        matchResult.unmatchedCurrent,
        bestComparable,
        input.productModel
      );

      // 5. Evaluate Recoveries vs Not Retested
      const visitedUrls = new Set<string>();
      const testedSelectors = new Set<string>();
      const testedApiEndpoints = new Set<string>();
      const testedWorkflows = new Set<string>();

      if (normalizedCurrent.targets) {
        for (const t of normalizedCurrent.targets) {
          if (t.url) visitedUrls.add(t.url.toLowerCase());
          if (t.selector) testedSelectors.add(t.selector.toLowerCase());
          if (t.targetType === 'api' || t.targetType === 'API_ENDPOINT') {
            testedApiEndpoints.add(t.targetIdentifier.toLowerCase());
          }
        }
      }
      if (normalizedCurrent.targetUrl) {
        visitedUrls.add(normalizedCurrent.targetUrl.toLowerCase());
      }

      const retestCoverage: RetestedTargetCoverage = {
        visitedUrls,
        testedSelectors,
        testedApiEndpoints,
        executedSecurityChecks: (normalizedCurrent.coverage?.securityChecksCount || 0) > 0,
        executedPerformanceChecks: (normalizedCurrent.coverage?.performanceAuditsCount || 0) > 0,
        executedAccessibilityChecks: (normalizedCurrent.coverage?.accessibilityChecksCount || 0) > 0,
        testedWorkflows,
      };

      const recoveryResult = RecoveryDetector.evaluateRecoveries(
        matchResult.unmatchedPrevious,
        retestCoverage,
        normalizedCurrent.testRunId
      );
      recoveries = recoveryResult.recoveries;
      notRetestedFindings = recoveryResult.notRetested;

      // 6. Track Recurrences
      recurrences = RecurrenceTracker.trackRecurrences(
        matchResult.matchedPairs,
        compatibleHistoryCount
      );

      // 7. Analyze Score & Metric Trends
      const trendResult = TrendAnalyzer.analyzeScoreTrends(normalizedCurrent, compatibleRuns);
      scoreDelta = trendResult.scoreDelta;
      releaseTrend = trendResult.trend;
      metricDeltas = trendResult.categoryDeltas;

      // 8. Coverage Trends
      coverageTrends = CoverageTrendTracker.evaluateCoverageTrends(
        normalizedCurrent.coverage,
        bestComparable.coverage
      );
    } else {
      // Baseline run
      const trendResult = TrendAnalyzer.analyzeScoreTrends(normalizedCurrent, []);
      scoreDelta = trendResult.scoreDelta;
      releaseTrend = trendResult.trend;
      metricDeltas = trendResult.categoryDeltas;
    }

    // 9. Stability Analysis across compatible runs
    const allRunsForStability = isComparable
      ? [normalizedCurrent, ...compatibleRuns].reverse() // chronological: oldest to newest
      : [normalizedCurrent];

    const targetHistoriesMap = new Map<string, TargetObservationHistory>();

    for (const run of allRunsForStability) {
      const runFailedTargetIds = new Set<string>();
      for (const f of run.findings || []) {
        const id = f.selector || f.targetUrl || f.fingerprint;
        if (id) runFailedTargetIds.add(id.toLowerCase());
      }

      // Collect all known targets from this run
      const runTargets = run.targets && run.targets.length > 0
        ? run.targets
        : [{ targetType: 'page', targetIdentifier: run.targetUrl, tested: true, status: run.status }];

      for (const t of runTargets) {
        const id = (t.targetIdentifier || (t as any).url || run.targetUrl).toLowerCase();
        let hist = targetHistoriesMap.get(id);
        if (!hist) {
          hist = {
            targetId: id,
            targetType: t.targetType || 'page',
            targetIdentifier: t.targetIdentifier || (t as any).url || run.targetUrl,
            outcomes: [],
          };
          targetHistoriesMap.set(id, hist);
        }
        const outcome: 'PASS' | 'FAIL' = runFailedTargetIds.has(id) || run.status === 'failed' ? 'FAIL' : 'PASS';
        hist.outcomes.push(outcome);
      }
    }

    stabilitySignals = StabilityAnalyzer.analyzeStability(Array.from(targetHistoriesMap.values()));

    // 10. Build QASignalRecords for database persistence
    const generatedSignals: QASignalRecord[] = [];
    const nowIso = new Date().toISOString();
    const env = normalizedCurrent.environment || 'staging';
    const viewportStr = typeof normalizedCurrent.viewport === 'string'
      ? normalizedCurrent.viewport
      : normalizedCurrent.viewport
      ? `${normalizedCurrent.viewport.width}x${normalizedCurrent.viewport.height}`
      : undefined;

    // Regressions
    for (const reg of regressions) {
      let signalType: HistoricalSignalType = 'NEW_REGRESSION';
      if (reg.category === 'security') signalType = 'SECURITY_REGRESSION';
      else if (reg.category === 'accessibility') signalType = 'ACCESSIBILITY_REGRESSION';
      else if (reg.category === 'performance') signalType = 'PERFORMANCE_REGRESSION';
      else if (reg.category === 'api') signalType = 'API_REGRESSION';
      else if (reg.category === 'visual') signalType = 'VISUAL_REGRESSION';

      generatedSignals.push({
        projectId: normalizedCurrent.projectId,
        organizationId: normalizedCurrent.organizationId,
        testRunId: normalizedCurrent.testRunId,
        signalType,
        targetType: reg.category || 'page',
        targetIdentifier: reg.targetUrl || normalizedCurrent.targetUrl,
        fingerprint: reg.fingerprint,
        severity: reg.severity,
        confidence: 'high',
        occurrenceCount: 1,
        consecutiveCount: 1,
        environment: env,
        viewport: viewportStr,
        role: normalizedCurrent.role,
        metadata: {
          previousRunId: bestComparable?.testRunId,
          findingTitle: reg.title,
          workflowId: reg.workflowId,
          businessCriticality: reg.businessCriticality,
          reason: reg.reason,
        },
        firstSeenAt: nowIso,
        lastSeenAt: nowIso,
      });
    }

    // Recoveries
    for (const rec of recoveries) {
      generatedSignals.push({
        projectId: normalizedCurrent.projectId,
        organizationId: normalizedCurrent.organizationId,
        testRunId: normalizedCurrent.testRunId,
        signalType: 'RECOVERED_DEFECT',
        targetType: rec.category || 'page',
        targetIdentifier: rec.targetUrl,
        fingerprint: rec.fingerprint,
        severity: rec.severity,
        confidence: 'high',
        occurrenceCount: 1,
        consecutiveCount: 0,
        environment: env,
        viewport: viewportStr,
        role: normalizedCurrent.role,
        metadata: {
          previousRunId: bestComparable?.testRunId,
          findingTitle: rec.title,
          reason: rec.reason,
        },
        firstSeenAt: nowIso,
        lastSeenAt: nowIso,
      });
    }

    // Recurrences
    for (const recur of recurrences) {
      generatedSignals.push({
        projectId: normalizedCurrent.projectId,
        organizationId: normalizedCurrent.organizationId,
        testRunId: normalizedCurrent.testRunId,
        signalType: 'RECURRING_DEFECT',
        targetType: recur.category || 'page',
        targetIdentifier: recur.targetUrl,
        fingerprint: recur.fingerprint,
        severity: recur.severity,
        confidence: 'high',
        occurrenceCount: recur.occurrenceCount,
        consecutiveCount: recur.consecutiveRunCount,
        environment: env,
        viewport: viewportStr,
        role: normalizedCurrent.role,
        metadata: {
          recurrenceRate: recur.recurrenceRate,
          stabilityState: recur.stabilityState,
          findingTitle: recur.title,
        },
        firstSeenAt: recur.firstSeenAt,
        lastSeenAt: nowIso,
      });
    }

    // Stability signals
    for (const stab of stabilitySignals) {
      if (stab.stability === 'INSUFFICIENT_HISTORY') continue;
      const signalType: HistoricalSignalType =
        stab.stability === 'STABLE_PASS'
          ? 'STABLE_PASS'
          : stab.stability === 'STABLE_FAILURE'
          ? 'STABLE_FAILURE'
          : 'INTERMITTENT_TARGET';

      generatedSignals.push({
        projectId: normalizedCurrent.projectId,
        organizationId: normalizedCurrent.organizationId,
        testRunId: normalizedCurrent.testRunId,
        signalType,
        targetType: stab.targetType,
        targetIdentifier: stab.targetIdentifier,
        severity: stab.stability === 'STABLE_FAILURE' ? 'high' : stab.stability === 'INTERMITTENT' ? 'medium' : 'low',
        confidence: 'high',
        occurrenceCount: stab.totalEvaluations,
        consecutiveCount: stab.consecutiveFailCount,
        environment: env,
        viewport: viewportStr,
        role: normalizedCurrent.role,
        metadata: {
          stability: stab.stability,
          flakeRate: stab.flakeRate,
          passCount: stab.passCount,
          failCount: stab.failCount,
          reasons: stab.reasons,
        },
        firstSeenAt: nowIso,
        lastSeenAt: nowIso,
      });
    }

    const summary: HistoricalSummary = {
      currentRunId: normalizedCurrent.testRunId,
      previousRunId: bestComparable?.testRunId,
      isComparable,
      comparisonStatus,
      scoreDelta,
      releaseTrend,
      newRegressionsCount: regressions.length,
      recoveredFindingsCount: recoveries.length,
      recurringFindingsCount: recurrences.length,
      notRetestedCount: notRetestedFindings.length,
      unstableTargetsCount: stabilitySignals.filter((s) => s.stability === 'INTERMITTENT' || s.stability === 'STABLE_FAILURE').length,
      totalTestedTargetsCount: (normalizedCurrent.targets || []).length || 1,
    };

    // 11. AI Historical Summary (Explanatory layer)
    let aiInterpretation = undefined;
    if (input.enableAI !== false) {
      aiInterpretation = await HistoricalAIInterpreter.interpret({
        summary,
        regressions,
        recoveries,
        recurrences,
        notRetested: notRetestedFindings,
        stabilitySignals,
        coverageTrends,
        metricDeltas,
        client: input.aiClient,
        apiKey: input.apiKey,
        model: input.aiModel,
      });
      summary.narrativeSummary = aiInterpretation.executiveSummary;
    }

    const durationMs = Date.now() - startTime;

    return {
      isComparable,
      currentRun: normalizedCurrent,
      previousComparableRun: bestComparable,
      compatibleHistoryCount,
      summary,
      regressions,
      recoveries,
      recurrences,
      notRetestedFindings,
      stabilitySignals,
      coverageTrends,
      metricDeltas,
      generatedSignals,
      aiInterpretation,
      durationMs,
    };
  }
}

