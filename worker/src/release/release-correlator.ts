// ==============================================================================
// Sculra Historical Release Intelligence & Issue Correlator (worker/src/release/release-correlator.ts)
// ==============================================================================

import { ReleaseRecord, RegressionClassification, ReleaseIssueCorrelation } from './types';

export interface IssueSummary {
  id: string;
  fingerprint: string;
  title: string;
  severity: string;
  category?: string;
  targetUrl?: string;
}

export interface ReleaseComparisonResult {
  compatible: boolean;
  hasCompatibleBaseline: boolean;
  baselineReleaseId?: string;
  regressions: ReleaseIssueCorrelation[];
  correlations: ReleaseIssueCorrelation[];
  recoveredCount: number;
  recurringCount: number;
  stableCount: number;
  notRetestedCount: number;
  summary: {
    newRegressions: number;
    recovered: number;
    recurring: number;
    stable: number;
    notRetested: number;
    incompatibilityReason?: string;
  };
  explanation: string;
}

export class ReleaseCorrelator {
  /**
   * Compares a release candidate against a prior release within the same project & environment.
   * Invariant: Never compares incompatible environments or unrelated projects.
   */
  public static correlateReleases(
    paramsOrCurrent: any,
    previousReleaseParam?: any,
    currentEnv?: any,
    previousEnv?: any,
    currentIssuesParam?: any[],
    previousIssuesParam?: any[]
  ): ReleaseComparisonResult {
    let currentRelease: ReleaseRecord;
    let previousRelease: ReleaseRecord | null | undefined;
    let currentIssues: IssueSummary[] = [];
    let previousIssues: IssueSummary[] = [];
    let retestedTargetUrls: string[] = [];

    if (paramsOrCurrent && 'version' in paramsOrCurrent && 'commitSha' in paramsOrCurrent) {
      currentRelease = paramsOrCurrent;
      previousRelease = previousReleaseParam;
      currentIssues = (currentIssuesParam || []).map((i: any) => ({
        id: i.id,
        fingerprint: i.fingerprint || i.locator || i.title || i.id,
        title: i.title,
        severity: i.severity || 'MEDIUM',
        category: i.category,
        targetUrl: i.locator || i.targetUrl,
      }));
      previousIssues = (previousIssuesParam || []).map((i: any) => ({
        id: i.id,
        fingerprint: i.fingerprint || i.locator || i.title || i.id,
        title: i.title,
        severity: i.severity || 'MEDIUM',
        category: i.category,
        targetUrl: i.locator || i.targetUrl,
      }));
    } else {
      currentRelease = paramsOrCurrent.currentRelease;
      previousRelease = paramsOrCurrent.previousRelease;
      currentIssues = paramsOrCurrent.currentIssues || [];
      previousIssues = paramsOrCurrent.previousIssues || [];
      retestedTargetUrls = paramsOrCurrent.retestedTargetUrls || [];
    }

    // Check environment compatibility if environments provided
    if (currentEnv && previousEnv) {
      if (currentEnv.type === 'PRODUCTION' && previousEnv.type === 'PREVIEW') {
        const fallbackRegs = currentIssues.map((issue) => ({
          issueId: issue.id,
          title: issue.title,
          severity: issue.severity,
          classification: 'INSUFFICIENT_HISTORY' as const,
          explanation: 'Incompatible environments: Ephemeral PREVIEW cannot baseline PRODUCTION.',
        }));
        return {
          compatible: false,
          hasCompatibleBaseline: false,
          regressions: fallbackRegs,
          correlations: fallbackRegs,
          recoveredCount: 0,
          recurringCount: 0,
          stableCount: 0,
          notRetestedCount: 0,
          summary: {
            newRegressions: 0,
            recovered: 0,
            recurring: 0,
            stable: 0,
            notRetested: 0,
            incompatibilityReason: 'Incompatible environments: Ephemeral PREVIEW cannot baseline PRODUCTION.',
          },
          explanation: 'Incompatible environments: Ephemeral PREVIEW cannot baseline PRODUCTION.',
        };
      }
    }

    // 1. Compatibility Check
    if (!previousRelease) {
      const fallbackRegs = currentIssues.map((issue) => ({
        issueId: issue.id,
        title: issue.title,
        severity: issue.severity,
        classification: 'INSUFFICIENT_HISTORY' as const,
        explanation: 'Observed in this release; no compatible prior baseline exists.',
      }));
      return {
        compatible: false,
        hasCompatibleBaseline: false,
        regressions: fallbackRegs,
        correlations: fallbackRegs,
        recoveredCount: 0,
        recurringCount: 0,
        stableCount: 0,
        notRetestedCount: 0,
        summary: {
          newRegressions: 0,
          recovered: 0,
          recurring: 0,
          stable: 0,
          notRetested: 0,
        },
        explanation: 'Initial release candidate with no prior baseline in this environment.',
      };
    }

    // Cross-environment or cross-project check
    if (!currentEnv && (
      currentRelease.projectId !== previousRelease.projectId ||
      currentRelease.environmentId !== previousRelease.environmentId
    )) {
      const fallbackRegs = currentIssues.map((issue) => ({
        issueId: issue.id,
        title: issue.title,
        severity: issue.severity,
        classification: 'INSUFFICIENT_HISTORY' as const,
        explanation: 'Incompatible baseline: cannot compare across different environments or projects.',
      }));
      return {
        compatible: false,
        hasCompatibleBaseline: false,
        regressions: fallbackRegs,
        correlations: fallbackRegs,
        recoveredCount: 0,
        recurringCount: 0,
        stableCount: 0,
        notRetestedCount: 0,
        summary: {
          newRegressions: 0,
          recovered: 0,
          recurring: 0,
          stable: 0,
          notRetested: 0,
          incompatibilityReason: 'Incompatible environments: Cannot compare across different environments or projects.',
        },
        explanation: 'Prior release belongs to a different environment; historical comparison withheld.',
      };
    }

    // 2. Map Previous Issues by Fingerprint
    const prevFingerprints = new Map<string, IssueSummary>();
    for (const p of previousIssues) {
      prevFingerprints.set(p.fingerprint || p.id, p);
    }

    const currentFingerprints = new Set(currentIssues.map((c) => c.fingerprint || c.id));
    const retestedTargets = new Set(retestedTargetUrls);

    const regressions: ReleaseIssueCorrelation[] = [];
    let recoveredCount = 0;
    let recurringCount = 0;

    // 3. Evaluate Current Issues
    for (const cur of currentIssues) {
      const key = cur.fingerprint || cur.id;
      if (prevFingerprints.has(key)) {
        recurringCount++;
        regressions.push({
          issueId: cur.id,
          title: cur.title,
          severity: cur.severity,
          classification: 'RECURRING',
          causedByCommit: false,
          explanation: `Recurring defect previously observed in baseline release ${previousRelease.version}. Issue pre-existed in baseline.`,
        });
      } else {
        const isDeploymentConfirmed = !!currentRelease.deploymentId;
        const causationExplanation = isDeploymentConfirmed
          ? `Observed after confirmed deployment ${currentRelease.deploymentId} (${currentRelease.commitSha.slice(0, 7)}).`
          : 'Observed in this release; deployment causality not established.';

        regressions.push({
          issueId: cur.id,
          title: cur.title,
          severity: cur.severity,
          classification: 'NEW_REGRESSION',
          confirmedInDeploymentId: currentRelease.deploymentId || undefined,
          firstObservedCommit: currentRelease.commitSha,
          causedByCommit: isDeploymentConfirmed,
          explanation: causationExplanation,
        });
      }
    }

    // 4. Evaluate Previous Issues that didn't appear in Current
    let notRetestedCount = 0;
    for (const prev of previousIssues) {
      const key = prev.fingerprint || prev.id;
      if (!currentFingerprints.has(key)) {
        if (prev.targetUrl && !retestedTargets.has(prev.targetUrl)) {
          notRetestedCount++;
        } else {
          recoveredCount++;
        }
      }
    }

    const newRegCount = regressions.filter((r) => r.classification === 'NEW_REGRESSION').length;

    return {
      compatible: true,
      hasCompatibleBaseline: true,
      baselineReleaseId: previousRelease.id,
      regressions,
      correlations: regressions,
      recoveredCount,
      recurringCount,
      stableCount: Math.max(0, retestedTargets.size - currentIssues.length),
      notRetestedCount,
      summary: {
        newRegressions: newRegCount,
        recovered: recoveredCount,
        recurring: recurringCount,
        stable: Math.max(0, retestedTargets.size - currentIssues.length),
        notRetested: notRetestedCount,
      },
      explanation: `Compared against baseline ${previousRelease.version}: ${newRegCount} new regression(s), ${recoveredCount} recovered defect(s), ${recurringCount} recurring issue(s).`,
    };
  }
}
