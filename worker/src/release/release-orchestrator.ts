// ==============================================================================
// Sculra Release Orchestrator & Deployment-Aware QA Engine
// (worker/src/release/release-orchestrator.ts)
// ==============================================================================

import {
  ReleaseRecord,
  ReleasePolicyLevel,
  ReleaseCheckRecord,
  ReleaseRecommendation,
  ReleaseGateEvaluation,
} from './types';
import { DeterministicReleaseScorer, CalculateAssessmentOptions } from './scorer';
import { ReleaseCorrelator, ReleaseComparisonResult, IssueSummary } from './release-correlator';
import { ReleaseGateEvaluator } from './release-gates';

export interface PrioritizedTarget {
  targetUrl: string;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  reasons: string[];
  affectedFeatures?: string[];
  historicalFailureRate?: number;
}

export class ReleaseOrchestrator {
  /**
   * Prioritizes candidate QA targets based on factual changed files, business criticality,
   * and historical stability. Never invents changed files.
   */
  public static prioritizeTargets(params: {
    baseUrl: string;
    changedFiles?: string[];
    discoveredRoutes?: string[];
    criticalWorkflows?: string[];
    historicalFailures?: Record<string, number>; // url -> failureCount
  }): PrioritizedTarget[] {
    const targets: PrioritizedTarget[] = [];
    const changed = (params.changedFiles || []).map((f) => f.toLowerCase());
    const routes = params.discoveredRoutes || ['/'];
    const criticals = new Set((params.criticalWorkflows || []).map((w) => w.toLowerCase()));
    const failures = params.historicalFailures || {};

    for (const route of routes) {
      const fullUrl = route.startsWith('http') ? route : `${params.baseUrl.replace(/\/$/, '')}${route.startsWith('/') ? '' : '/'}${route}`;
      const pathLower = route.toLowerCase();
      const reasons: string[] = [];
      let priorityScore = 1;

      // 1. Direct code change match
      const matchingFile = changed.find((f) => pathLower !== '/' && f.includes(pathLower.replace(/^\//, '')));
      if (matchingFile) {
        priorityScore += 3;
        reasons.push(`Target changed: code modified in ${matchingFile}`);
      }

      // 2. Business critical workflow
      if (criticals.has(pathLower) || pathLower === '/' || pathLower.includes('checkout') || pathLower.includes('signup')) {
        priorityScore += 2;
        reasons.push('Business-critical user workflow affected');
      }

      // 3. Security/Auth sensitive surface
      if (pathLower.includes('login') || pathLower.includes('auth') || pathLower.includes('admin') || pathLower.includes('api/')) {
        priorityScore += 2;
        reasons.push('Security-sensitive or authentication boundary surface');
      }

      // 4. Historical instability
      const failCount = failures[route] || failures[fullUrl] || 0;
      if (failCount > 0) {
        priorityScore += 2;
        reasons.push(`Historically unstable target: ${failCount} prior test failure(s) recorded`);
      }

      if (reasons.length === 0) {
        reasons.push('Standard candidate regression surface');
      }

      let priority: PrioritizedTarget['priority'] = 'LOW';
      if (priorityScore >= 5) priority = 'CRITICAL';
      else if (priorityScore >= 4) priority = 'HIGH';
      else if (priorityScore >= 2) priority = 'MEDIUM';

      targets.push({
        targetUrl: fullUrl,
        priority,
        reasons,
        historicalFailureRate: failCount,
      });
    }

    return targets.sort((a, b) => {
      const order = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
      return order[b.priority] - order[a.priority];
    });
  }

  public static prioritizeTargetsForRelease(params: {
    commitSha?: string;
    changedFiles?: string[];
    availableTargets: Array<{ id: string; route: string; sourceFile?: string }>;
  }): Array<{ id: string; route: string; sourceFile?: string; priority: string }> {
    const changed = (params.changedFiles || []).map((f) => f.toLowerCase());
    return [...params.availableTargets].map((t) => {
      const match = changed.some((c) => t.sourceFile && c.includes(t.sourceFile.toLowerCase()));
      return {
        ...t,
        priority: match ? 'CRITICAL' : 'LOW',
      };
    }).sort((a, b) => (a.priority === 'CRITICAL' ? -1 : 1));
  }

  /**
   * Executes release gate evaluation and produces an authoritative ReleaseCheckRecord.
   * Reuses DeterministicReleaseScorer for scoring and ReleaseGateEvaluator for gates.
   */
  public static evaluateReleaseCheck(params: {
    release: ReleaseRecord;
    policyLevel: ReleasePolicyLevel;
    campaignId?: string | null;
    environment?: any;
    testRuns?: any[];
    openIssues?: any[];
    scoringOptions?: CalculateAssessmentOptions;
    currentIssues?: IssueSummary[];
    previousRelease?: ReleaseRecord | null;
    previousIssues?: IssueSummary[];
    testedDomains?: string[];
    totalTestsRun?: number;
    evidenceCount?: number;
  }): { check: ReleaseCheckRecord; checkRecord: ReleaseCheckRecord; comparison: ReleaseComparisonResult; blockers: string[] } {
    // 1. Authoritative Release Readiness Assessment
    const scoringOptions: CalculateAssessmentOptions = params.scoringOptions || ({
      testRunId: params.testRuns?.[0]?.id || `run-${Date.now()}`,
      projectId: params.release.projectId,
      targetUrl: params.environment?.baseUrl || 'https://target.local',
      journeyResults: (params.testRuns || []).map((r: any) => ({
        id: r.id,
        name: r.id,
        status: (r.status || 'passed').toLowerCase(),
        durationMs: r.duration_ms || 1000,
        steps: [],
      })),
      bugObservations: (params.openIssues || []).map((i: any) => ({
        id: i.id,
        severity: i.severity || 'medium',
        title: i.title || 'Bug',
        status: 'open',
      })),
    } as any);

    const assessment = DeterministicReleaseScorer.calculateAssessment(scoringOptions);

    const currentIssues = params.currentIssues || (params.openIssues || []).map((i: any) => ({
      id: i.id,
      fingerprint: i.fingerprint || i.title || i.id,
      title: i.title || 'Issue',
      severity: i.severity || 'MEDIUM',
    }));

    // 2. Historical Release Correlation
    const comparison = ReleaseCorrelator.correlateReleases({
      currentRelease: params.release,
      previousRelease: params.previousRelease,
      currentIssues,
      previousIssues: params.previousIssues,
    });

    const totalTestsRun = params.totalTestsRun ?? (params.testRuns ? params.testRuns.length : 3);
    const evidenceCount = params.evidenceCount ?? totalTestsRun;

    // 3. Evaluate 10 Canonical Release Gates
    const gates: ReleaseGateEvaluation[] = ReleaseGateEvaluator.evaluateAllGates({
      issues: currentIssues,
      regressions: comparison.regressions,
      categoryScores: assessment.scores,
      testedDomains: params.testedDomains || ['functional', 'security', 'accessibility', 'performance', 'visual', 'api'],
      totalTestsRun,
      evidenceCount,
    });

    // 4. Determine Release Decision
    const criticalFails = gates.filter(
      (g) => g.status === 'FAIL' && ['CRITICAL_ISSUES', 'REGRESSIONS', 'SECURITY', 'FUNCTIONAL'].includes(g.gate)
    );
    const otherFails = gates.filter((g) => g.status === 'FAIL');
    const warnings = gates.filter((g) => g.status === 'WARN');
    const insufficient = gates.filter((g) => g.status === 'INSUFFICIENT_EVIDENCE');

    let releaseDecision: ReleaseRecommendation = 'RELEASE';
    if (criticalFails.length > 0) {
      releaseDecision = 'DO_NOT_RELEASE';
    } else if (otherFails.length > 0) {
      releaseDecision = 'DO_NOT_RELEASE';
    } else if (insufficient.length > 2) {
      releaseDecision = 'INSUFFICIENT_EVIDENCE';
    } else if (warnings.length > 0) {
      releaseDecision = 'RELEASE_WITH_CAUTION';
    }

    const blockers = assessment.blockers.map((b) => b.title);
    for (const cf of criticalFails) {
      if (!blockers.includes(cf.reason)) {
        blockers.push(`Gate ${cf.gate}: ${cf.reason}`);
      }
    }

    const now = new Date().toISOString();
    const check: ReleaseCheckRecord = {
      id: `rc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      organizationId: params.release.organizationId || null,
      projectId: params.release.projectId,
      releaseId: params.release.id,
      campaignId: params.campaignId || null,
      policyLevel: params.policyLevel,
      status: 'COMPLETED',
      overallScore: assessment.overallScore,
      releaseDecision,
      gates,
      evidenceSummary: {
        scoringVersion: assessment.scoringVersion,
        confidenceLevel: assessment.confidenceLevel,
        riskLevel: assessment.riskLevel,
        blockersCount: blockers.length,
        regressionsCount: comparison.regressions.filter((r) => r.classification === 'NEW_REGRESSION').length,
        recoveredCount: comparison.recoveredCount,
        categoryScores: assessment.scores,
      },
      startedAt: now,
      completedAt: now,
      createdAt: now,
    };

    return { check, checkRecord: check, comparison, blockers };
  }
}
