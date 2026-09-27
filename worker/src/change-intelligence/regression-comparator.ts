// ==============================================================================
// Sculra Master Post-Execution Regression Comparator
// (worker/src/change-intelligence/regression-comparator.ts)
// Answers: "Did the change introduce a regression?" & "Did a failing issue recover?"
// ==============================================================================

import {
  RegressionComparisonResult,
  TargetRegressionComparison,
  ChangeRegressionClassification,
  ChangeSnapshot,
  ChangeDecision,
} from './types';
import { CampaignTaskResult } from '../campaign/types';
import { HistoricalRun } from '../history/types';

export interface CompareRegressionsInput {
  currentRunId?: string;
  baselineRun?: HistoricalRun;
  taskResults: CampaignTaskResult[];
  snapshot?: ChangeSnapshot;
  decisions?: ChangeDecision[];
}

export class RegressionComparator {
  /**
   * Deterministically compares current execution task results against a comparable historical baseline.
   * Categorizes each target into one of the 7 canonical regression classifications.
   */
  static compare(input: CompareRegressionsInput): RegressionComparisonResult {
    const {
      currentRunId,
      baselineRun,
      taskResults,
      snapshot,
      decisions = [],
    } = input;

    const comparisons: TargetRegressionComparison[] = [];
    let regressionsCount = 0;
    let recoveriesCount = 0;
    let persistingFailuresCount = 0;
    let newFailuresCount = 0;
    let unchangedPassCount = 0;
    let unchangedFailuresCount = 0;
    let inconclusiveCount = 0;

    for (const result of taskResults) {
      const targetIdentifier = result.target?.identifier || result.taskId;
      const targetType = result.target?.type || 'PAGE';
      const domain = result.domain || 'FUNCTIONAL';

      // 1. Determine Current Status
      let currentStatus: 'PASSED' | 'FAILED' | 'ERROR' | 'SKIPPED' = 'PASSED';
      if (result.status === 'SKIPPED') {
        currentStatus = 'SKIPPED';
      } else if (result.status === 'FAILED' || result.error) {
        currentStatus = result.error ? 'ERROR' : 'FAILED';
      } else if (result.observations && result.observations.length > 0) {
        const hasBlocker = result.observations.some(
          (o) => o.severity === 'critical' || o.severity === 'high'
        );
        currentStatus = hasBlocker ? 'FAILED' : 'PASSED';
      } else {
        currentStatus = 'PASSED';
      }

      // 2. Lookup Baseline Status
      let baselineStatus: 'PASSED' | 'FAILED' | 'UNTESTED' | 'NO_BASELINE' = 'NO_BASELINE';
      if (baselineRun) {
        // Priority 1: Direct target status in baseline run
        const matchingTarget = baselineRun.targets?.find(
          (t) =>
            t.targetIdentifier === targetIdentifier ||
            (t.url && result.target?.url && t.url === result.target.url)
        );

        if (matchingTarget) {
          baselineStatus = matchingTarget.status === 'passed' ? 'PASSED' : matchingTarget.status === 'failed' ? 'FAILED' : 'UNTESTED';
        } else {
          // Priority 2: Check matching finding with exact URL path or fingerprint
          const matchingFinding = baselineRun.findings?.find((f) => {
            if (f.fingerprint && result.observations?.some((o) => o.fingerprint === f.fingerprint)) {
              return true;
            }
            if (f.targetUrl) {
              try {
                const parsedUrl = new URL(f.targetUrl);
                if (parsedUrl.pathname === targetIdentifier) return true;
              } catch {
                if (f.targetUrl === targetIdentifier) return true;
              }
            }
            return false;
          });

          if (matchingFinding) {
            baselineStatus = 'FAILED';
          } else if (baselineRun.status === 'passed') {
            baselineStatus = 'PASSED';
          } else {
            baselineStatus = 'NO_BASELINE';
          }
        }
      }

      // 3. Determine if target is affected by recent change
      const matchingDecision = decisions.find(
        (d) =>
          d.targetIdentifier === targetIdentifier ||
          targetIdentifier.includes(d.targetIdentifier) ||
          d.targetIdentifier.includes(targetIdentifier)
      );
      const isAffectedByChange = matchingDecision
        ? matchingDecision.decision === 'TEST' && !matchingDecision.criticalOverride
        : false;

      // 4. Classify Target
      let classification: ChangeRegressionClassification = 'UNCHANGED_PASS';
      let reason = '';

      if (currentStatus === 'SKIPPED') {
        classification = 'UNCHANGED_PASS';
        reason = `Target skipped by decision engine: ${(result as any).reason || matchingDecision?.reason || 'Safe test reduction'}`;
      } else if (currentStatus === 'ERROR') {
        classification = 'INCONCLUSIVE';
        inconclusiveCount++;
        reason = `Execution encountered runtime or harness error: ${result.error || 'Unknown error'}`;
      } else if (currentStatus === 'PASSED') {
        if (baselineStatus === 'FAILED') {
          classification = 'RECOVERED';
          recoveriesCount++;
          reason = `Defect recovered! Previously failing target passed in current run.`;
        } else {
          classification = 'UNCHANGED_PASS';
          unchangedPassCount++;
          reason = `Target passed consistently across runs.`;
        }
      } else if (currentStatus === 'FAILED') {
        if (baselineStatus === 'PASSED') {
          if (isAffectedByChange || snapshot?.classifications.length) {
            classification = 'REGRESSION';
            regressionsCount++;
            reason = `REGRESSION CONFIRMED: Target previously passed in baseline, but failed after recent code changes.`;
          } else {
            classification = 'NEW_FAILURE';
            newFailuresCount++;
            reason = `New defect detected: Target failed but is not in directly touched surface.`;
          }
        } else if (baselineStatus === 'FAILED') {
          classification = 'PERSISTING_FAILURE';
          persistingFailuresCount++;
          unchangedFailuresCount++;
          reason = `Persisting defect: Target continues to fail as observed in baseline run.`;
        } else {
          classification = 'NEW_FAILURE';
          newFailuresCount++;
          reason = `Initial failure detected on target without prior baseline.`;
        }
      }

      comparisons.push({
        targetIdentifier,
        targetType,
        domain,
        baselineRunId: baselineRun?.testRunId,
        baselineStatus,
        currentStatus,
        classification,
        isAffectedByChange,
        reason,
        evidenceRefs: result.observations?.map((o) => o.fingerprint).filter(Boolean),
        visualBaselineFound: domain === 'VISUAL' ? baselineStatus !== 'NO_BASELINE' : undefined,
      });
    }

    return {
      comparedAt: new Date().toISOString(),
      baselineRunId: baselineRun?.testRunId,
      currentRunId,
      totalCompared: comparisons.length,
      regressionsCount,
      recoveriesCount,
      persistingFailuresCount,
      newFailuresCount,
      unchangedPassCount,
      unchangedFailuresCount,
      inconclusiveCount,
      targets: comparisons,
    };
  }
}
