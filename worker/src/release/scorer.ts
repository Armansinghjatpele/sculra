// ==============================================================================
// Sculra Deterministic Release Readiness Scorer (worker/src/release/scorer.ts)
// ==============================================================================
// Pure deterministic mathematical engine calculating reproducible release readiness
// scores, category breakdowns, evidence confidence, risk levels, and blockers.

import { ApplicationMap } from '../types';
import { JourneyResult } from '../journeys/types';
import { BugObservation } from '../issues/types';
import { ResponsiveExecutionResult } from '../visual/types';
import { CapturedConsoleError, CapturedNetworkError } from '../types';
import { AIQAStateSummary } from '../ai-qa/state';
import {
  RELEASE_SCORING_VERSION,
  ReleaseAssessment,
  CategoryScores,
  ScoreBreakdown,
  ScoreDeduction,
  ReleaseBlocker,
  EvidenceConfidence,
  ReleaseRiskLevel,
  ReleaseRecommendation,
  HistoricalScoreComparison,
} from './types';

export interface CalculateAssessmentOptions {
  testRunId: string;
  projectId: string;
  organizationId?: string;
  testRunStatus?: string;
  targetUrl: string;
  applicationMap?: ApplicationMap;
  journeyResults?: JourneyResult[];
  bugObservations?: BugObservation[];
  visualResult?: ResponsiveExecutionResult;
  consoleErrors?: CapturedConsoleError[];
  networkErrors?: CapturedNetworkError[];
  aiQaStateSummary?: AIQAStateSummary;
  productModel?: import('../product/types').ProductModel;
  authorizationResults?: import('../auth/types').AuthorizationCheckResult[];
  apiTestResults?: import('../api-qa/types').ApiTestResult[];
  apiCoverage?: import('../api-qa/types').ApiCoverageSummary;
  securityResult?: import('../security/types').SecurityScanResult;
  securityFindings?: import('../security/types').SecurityFinding[];
  securityCoverage?: import('../security/types').SecurityCoverageSummary;
  performanceResult?: import('../performance/types').PerformanceScanResult;
  performanceFindings?: import('../performance/types').PerformanceFinding[];
  previousAssessment?: {
    overallScore: number;
    testRunId?: string;
    createdAt?: string;
  };
}

export class DeterministicReleaseScorer {
  /**
   * Evaluates all deterministic test evidence and calculates a reproducible ReleaseAssessment.
   */
  static calculateAssessment(options: CalculateAssessmentOptions): ReleaseAssessment {
    const {
      testRunId,
      projectId,
      organizationId,
      testRunStatus = 'passed',
      targetUrl,
      applicationMap,
      journeyResults = [],
      bugObservations = [],
      visualResult,
      consoleErrors = [],
      networkErrors = [],
      aiQaStateSummary,
      previousAssessment,
    } = options;

    const evaluatedAt = new Date().toISOString();

    // 1. Filter Open Issues (Resolved/Ignored issues do not deduct points)
    const openIssues = bugObservations.filter(
      (b) => b.status !== 'resolved' && b.status !== 'ignored'
    );

    // Deduplicate open issues by fingerprint while tracking recurrence count
    const uniqueIssuesMap = new Map<string, { issue: BugObservation; count: number }>();
    for (const iss of openIssues) {
      const existing = uniqueIssuesMap.get(iss.fingerprint);
      if (existing) {
        existing.count++;
      } else {
        uniqueIssuesMap.set(iss.fingerprint, { issue: iss, count: 1 });
      }
    }
    const uniqueOpenIssues = Array.from(uniqueIssuesMap.values());

    // 2. Compute Functional Score (Weight: 35%)
    const functionalDeductions: ScoreDeduction[] = [];
    let confirmedIssuesCount = 0;
    let suspectedIssuesCount = 0;

    for (const { issue, count } of uniqueOpenIssues) {
      if (issue.confidence === 'high' || issue.confidence === 'medium') {
        confirmedIssuesCount++;
        if (issue.severity === 'critical') {
          functionalDeductions.push({
            category: 'functional',
            points: 35,
            reason: `Critical functional defect: [${issue.type}] ${issue.title}`,
            evidenceRef: issue.fingerprint,
          });
        } else if (issue.severity === 'high') {
          functionalDeductions.push({
            category: 'functional',
            points: 15,
            reason: `High severity issue: [${issue.type}] ${issue.title}`,
            evidenceRef: issue.fingerprint,
          });
        } else if (issue.severity === 'medium') {
          functionalDeductions.push({
            category: 'functional',
            points: 6,
            reason: `Medium severity defect: [${issue.type}] ${issue.title}`,
            evidenceRef: issue.fingerprint,
          });
        } else if (issue.severity === 'low') {
          functionalDeductions.push({
            category: 'functional',
            points: 2,
            reason: `Low severity UI anomaly: [${issue.type}] ${issue.title}`,
            evidenceRef: issue.fingerprint,
          });
        }

        // Recurrence penalty (capped at 5 pts per issue)
        if (count > 1) {
          const recurPenalty = Math.min(5, count - 1);
          functionalDeductions.push({
            category: 'functional',
            points: recurPenalty,
            reason: `Recurring defect penalty (${count} occurrences): ${issue.title}`,
            evidenceRef: issue.fingerprint,
          });
        }
      } else {
        // Suspected / low confidence anomaly
        suspectedIssuesCount++;
        if (issue.severity === 'critical' || issue.severity === 'high') {
          functionalDeductions.push({
            category: 'functional',
            points: 3,
            reason: `Suspected high-risk anomaly: [${issue.type}] ${issue.title}`,
            evidenceRef: issue.fingerprint,
          });
        } else if (issue.severity === 'medium') {
          functionalDeductions.push({
            category: 'functional',
            points: 1,
            reason: `Suspected medium anomaly: [${issue.type}] ${issue.title}`,
            evidenceRef: issue.fingerprint,
          });
        }
      }
    }

    // Journey-level functional failures
    let failedJourneysCount = 0;
    for (const journey of journeyResults) {
      if (journey.status === 'FAILED') {
        failedJourneysCount++;
        functionalDeductions.push({
          category: 'functional',
          points: 10,
          reason: `Failed User Journey workflow: "${journey.name}" (${journey.actionsFailed} actions failed)`,
          evidenceRef: journey.journeyId,
        });
      }
    }

    const totalFunctionalDeduction = functionalDeductions.reduce((sum, d) => sum + d.points, 0);
    const finalFunctionalScore = Math.max(0, Math.min(100, 100 - totalFunctionalDeduction));

    // 3. Compute Visual Score (Weight: 20%)
    const visualDeductions: ScoreDeduction[] = [];
    let regressionsCount = 0;
    let missingBaselinesCount = 0;

    if (visualResult) {
      for (const comp of visualResult.comparisons) {
        if (comp.status === 'HIGH' || comp.pixelDifferenceRatio > 0.05) {
          regressionsCount++;
          visualDeductions.push({
            category: 'visual',
            points: 20,
            reason: `Severe visual regression on ${comp.viewport.name} (${(comp.pixelDifferenceRatio * 100).toFixed(1)}% diff): ${comp.pageUrl}`,
            evidenceRef: comp.id,
          });
        } else if (comp.status === 'MEDIUM' || (comp.pixelDifferenceRatio >= 0.01 && comp.pixelDifferenceRatio <= 0.05)) {
          regressionsCount++;
          visualDeductions.push({
            category: 'visual',
            points: 10,
            reason: `Moderate visual regression on ${comp.viewport.name} (${(comp.pixelDifferenceRatio * 100).toFixed(1)}% diff): ${comp.pageUrl}`,
            evidenceRef: comp.id,
          });
        } else if (comp.status === 'BASELINE_MISSING') {
          // BASELINE_MISSING is an informational baseline establishment, NOT a visual bug!
          missingBaselinesCount++;
        }
      }

      for (const obs of visualResult.observations) {
        if (obs.type === 'ELEMENT_OVERLAP') {
          visualDeductions.push({
            category: 'visual',
            points: 8,
            reason: `Geometric element overlap on ${obs.viewport.name}: ${obs.description.substring(0, 80)}`,
          });
        } else if (obs.type === 'LAYOUT_SHIFT') {
          visualDeductions.push({
            category: 'visual',
            points: 5,
            reason: `Unexpected layout shift after interaction on ${obs.viewport.name}: ${obs.pageUrl}`,
          });
        }
      }
    }

    const totalVisualDeduction = visualDeductions.reduce((sum, d) => sum + d.points, 0);
    const finalVisualScore = Math.max(0, Math.min(100, 100 - totalVisualDeduction));

    // 4. Compute Responsive Score (Weight: 20%)
    const responsiveDeductions: ScoreDeduction[] = [];
    let overflowCount = 0;
    let clippingCount = 0;
    let overlapCount = 0;
    const viewportsTestedSet = new Set<string>(['desktop']);

    for (const j of journeyResults) {
      if (j.viewport?.name) viewportsTestedSet.add(j.viewport.name);
    }

    if (visualResult) {
      for (const vp of visualResult.viewports || (visualResult as any).viewportsTested || []) {
        viewportsTestedSet.add(vp.name);
      }
      for (const snap of visualResult.snapshots || []) {
        viewportsTestedSet.add(snap.viewport.name);
      }
      for (const comp of visualResult.comparisons || []) {
        viewportsTestedSet.add(comp.viewport.name);
      }
      for (const obs of visualResult.observations || []) {
        viewportsTestedSet.add(obs.viewport.name);
        if (obs.type === 'HORIZONTAL_OVERFLOW') {
          overflowCount++;
          responsiveDeductions.push({
            category: 'responsive',
            points: obs.viewport.name === 'mobile' ? 15 : 10,
            reason: `Horizontal layout overflow on ${obs.viewport.name} (${obs.pageUrl})`,
          });
        } else if (obs.type === 'CONTENT_CLIPPED') {
          clippingCount++;
          responsiveDeductions.push({
            category: 'responsive',
            points: 10,
            reason: `Content clipped by overflow boundary on ${obs.viewport.name}: ${obs.pageUrl}`,
          });
        } else if (obs.type === 'TEXT_OVERFLOW') {
          responsiveDeductions.push({
            category: 'responsive',
            points: 5,
            reason: `Text truncation / overflow on ${obs.viewport.name}: ${obs.pageUrl}`,
          });
        } else if (obs.type === 'ELEMENT_OVERLAP' && (obs.viewport.name === 'mobile' || obs.viewport.name === 'tablet')) {
          overlapCount++;
          responsiveDeductions.push({
            category: 'responsive',
            points: 10,
            reason: `Touch target / element collision on ${obs.viewport.name}: ${obs.pageUrl}`,
          });
        }
      }
    }

    const totalResponsiveDeduction = responsiveDeductions.reduce((sum, d) => sum + d.points, 0);
    const finalResponsiveScore = Math.max(0, Math.min(100, 100 - totalResponsiveDeduction));

    // 5. Compute Reliability & Execution Score (Weight: 10%)
    const reliabilityDeductions: ScoreDeduction[] = [];

    // Unique console errors
    const uniqueConsoleMsgs = new Set(consoleErrors.map((e) => e.message.substring(0, 120)));
    if (uniqueConsoleMsgs.size > 0) {
      const cPoints = Math.min(25, uniqueConsoleMsgs.size * 5);
      reliabilityDeductions.push({
        category: 'reliability',
        points: cPoints,
        reason: `${uniqueConsoleMsgs.size} unhandled console error signature(s) detected during execution`,
      });
    }

    // Network failures
    const uniqueNetworkErrors = new Set(networkErrors.map((n) => `${n.method} ${n.url}`));
    if (uniqueNetworkErrors.size > 0) {
      const nPoints = Math.min(25, uniqueNetworkErrors.size * 5);
      reliabilityDeductions.push({
        category: 'reliability',
        points: nPoints,
        reason: `${uniqueNetworkErrors.size} network request failure(s) observed`,
      });
    }

    // Journey action failure rate
    let totalActionsAttempted = 0;
    let totalActionsFailed = 0;
    for (const j of journeyResults) {
      totalActionsAttempted += j.actionsAttempted;
      totalActionsFailed += j.actionsFailed;
    }

    const actionFailureRate = totalActionsAttempted > 0 ? totalActionsFailed / totalActionsAttempted : 0;
    if (actionFailureRate > 0) {
      const actionFailPoints = Math.min(30, Math.round(30 * actionFailureRate));
      reliabilityDeductions.push({
        category: 'reliability',
        points: actionFailPoints,
        reason: `Action failure rate of ${(actionFailureRate * 100).toFixed(1)}% (${totalActionsFailed}/${totalActionsAttempted} actions failed)`,
      });
    }

    // Fatal navigation failure
    if (testRunStatus === 'failed' && (journeyResults.length === 0 || failedJourneysCount === journeyResults.length)) {
      reliabilityDeductions.push({
        category: 'reliability',
        points: 30,
        reason: 'Target navigation failed fatally or zero successful workflows completed',
      });
    }

    const totalReliabilityDeduction = reliabilityDeductions.reduce((sum, d) => sum + d.points, 0);
    const finalReliabilityScore = Math.max(0, Math.min(100, 100 - totalReliabilityDeduction));

    // 6. Compute Coverage Score (Weight: 15%)
    const appPages = applicationMap?.pages || [];
    const discoveredPagesCount = appPages.length;

    // Determine visited pages from applicationMap, journey traces, and stateSummary
    const visitedPagesSet = new Set<string>();
    for (const j of journeyResults) {
      for (const p of j.pagesVisited || []) {
        visitedPagesSet.add(p.replace(/\/$/, ''));
      }
    }
    if (aiQaStateSummary) {
      for (let i = 0; i < aiQaStateSummary.coverage.pages.visited; i++) {
        visitedPagesSet.add(`page-state-${i}`);
      }
    }
    if (appPages.length > 0 && visitedPagesSet.size === 0 && journeyResults.length > 0) {
      visitedPagesSet.add(targetUrl.replace(/\/$/, ''));
    }

    const visitedPagesCount = Math.max(
      visitedPagesSet.size,
      aiQaStateSummary?.coverage.pages.visited || 0
    );

    let totalFormsDiscovered = 0;
    let totalButtonsDiscovered = 0;
    let totalLinksDiscovered = 0;

    for (const page of appPages) {
      totalFormsDiscovered += (page.forms || []).length;
      totalButtonsDiscovered += (page.elements || []).filter((e) => e.type === 'button' || e.role === 'button').length;
      totalLinksDiscovered += (page.links || []).length;
    }

    const exercisedFormsCount = aiQaStateSummary?.coverage.forms.exercised || (totalFormsDiscovered > 0 && journeyResults.length > 0 ? 1 : 0);
    const exercisedButtonsCount = aiQaStateSummary?.coverage.buttons.exercised || (totalButtonsDiscovered > 0 && journeyResults.length > 0 ? Math.min(totalButtonsDiscovered, journeyResults.length * 2) : 0);
    const exercisedLinksCount = aiQaStateSummary?.coverage.links.exercised || (totalLinksDiscovered > 0 && journeyResults.length > 0 ? Math.min(totalLinksDiscovered, journeyResults.length) : 0);

    const pageRatio = discoveredPagesCount > 0 ? Math.min(1.0, visitedPagesCount / discoveredPagesCount) : visitedPagesCount > 0 ? 1.0 : 0;
    const formRatio = totalFormsDiscovered > 0 ? Math.min(1.0, exercisedFormsCount / totalFormsDiscovered) : 1.0;
    const buttonRatio = totalButtonsDiscovered > 0 ? Math.min(1.0, exercisedButtonsCount / totalButtonsDiscovered) : 1.0;
    const linkRatio = totalLinksDiscovered > 0 ? Math.min(1.0, exercisedLinksCount / totalLinksDiscovered) : 1.0;
    const viewportRatio = Math.min(1.0, viewportsTestedSet.size / 3);

    const weightedCoverage =
      0.35 * pageRatio +
      0.20 * formRatio +
      0.15 * buttonRatio +
      0.15 * linkRatio +
      0.15 * viewportRatio;

    const finalCoverageScore = Math.max(0, Math.min(100, Math.round(weightedCoverage * 100)));

    // 7. Determine Evidence Confidence Level
    const hasApiEvidence = (options.apiTestResults && options.apiTestResults.length > 0) || (options.apiCoverage && options.apiCoverage.endpointsTested > 0);
    const hasSecurityEvidence = (options.securityResult && (options.securityResult.coverage?.checksExecuted || 0) > 0) || ((options.securityFindings?.length || 0) > 0);
    const hasPerformanceEvidence = (options.performanceResult && (options.performanceResult.coverage?.totalMeasurements || 0) > 0) || ((options.performanceFindings?.length || 0) > 0);
    let confidenceLevel: EvidenceConfidence = 'HIGH';
    if (testRunStatus === 'cancelled') {
      confidenceLevel = 'INSUFFICIENT';
    } else if (discoveredPagesCount <= 1 && journeyResults.length === 0 && !hasApiEvidence && !hasSecurityEvidence && !hasPerformanceEvidence) {
      confidenceLevel = 'INSUFFICIENT';
    } else if ((discoveredPagesCount <= 1 && !hasApiEvidence && !hasSecurityEvidence && !hasPerformanceEvidence) || (journeyResults.length <= 0 && !hasApiEvidence && !hasSecurityEvidence && !hasPerformanceEvidence) || viewportsTestedSet.size < 2 || finalCoverageScore < 30) {
      confidenceLevel = 'LOW';
    } else if (discoveredPagesCount < 3 || viewportsTestedSet.size < 3 || journeyResults.length < 2 || finalCoverageScore < 70) {
      confidenceLevel = 'MEDIUM';
    } else {
      confidenceLevel = 'HIGH';
    }

    // 8. Identify Release Blockers
    const blockers: ReleaseBlocker[] = [];

    // Blocker 1: Open Critical Issues
    const criticalIssues = uniqueOpenIssues.filter(({ issue }) => issue.severity === 'critical' && issue.confidence !== 'low');
    for (const { issue } of criticalIssues) {
      blockers.push({
        id: `blocker-crit-${issue.fingerprint.substring(0, 8)}`,
        title: `Critical Bug: ${issue.title}`,
        reason: `Open critical functional defect on route ${issue.url || targetUrl}.`,
        category: 'functional',
        severity: 'critical',
        evidenceSummary: issue.summary || issue.description,
        relatedIssueFingerprints: [issue.fingerprint],
      });
    }

    // Blocker 2: Fatal Root Navigation / 500 Crash
    if (testRunStatus === 'failed' && (statusCodeCheck(options) || (journeyResults.length === 0 && functionalDeductions.length > 0))) {
      blockers.push({
        id: 'blocker-nav-fatal',
        title: 'Target Application Startup / Route Failure',
        reason: 'Target application returned an unrecoverable server error or failed initial page navigation.',
        category: 'reliability',
        severity: 'critical',
        evidenceSummary: `Test execution marked failed with reason: ${options.testRunStatus}`,
      });
    }

    // Blocker 3: Multiple High-Severity Failures on Primary User Flows
    const highIssues = uniqueOpenIssues.filter(({ issue }) => issue.severity === 'high' && issue.confidence !== 'low');
    if (highIssues.length >= 3) {
      blockers.push({
        id: 'blocker-high-accumulated',
        title: 'Widespread High-Severity Failures',
        reason: `Accumulated ${highIssues.length} high-severity functional/visual defects across core workflows.`,
        category: 'functional',
        severity: 'high',
        evidenceSummary: highIssues.map((h) => h.issue.title).slice(0, 3).join('; '),
        relatedIssueFingerprints: highIssues.map((h) => h.issue.fingerprint),
      });
    }

    // Blocker 4: Systemic Mobile Responsive Layout Failure
    if (overflowCount >= 3) {
      blockers.push({
        id: 'blocker-mobile-systemic',
        title: 'Systemic Mobile Responsive Overflow',
        reason: `Horizontal layout overflow detected on ${overflowCount} routes on mobile viewport profile.`,
        category: 'responsive',
        severity: 'high',
        evidenceSummary: `${overflowCount} pages suffer from mobile viewport clipping or horizontal scrolling.`,
      });
    }

    // Blocker 5: Business-Critical Workflow Failure
    if (options.productModel && options.productModel.coverage.criticalWorkflowsWithFailures > 0) {
      const failedCriticalWorkflows = options.productModel.workflows.filter(
        (w) => w.executionStatus === 'FAILED' && (w.criticality.level === 'CRITICAL' || w.criticality.level === 'HIGH')
      );
      if (failedCriticalWorkflows.length > 0) {
        blockers.push({
          id: 'blocker-product-workflow-critical',
          title: `Broken Business-Critical Workflow (${failedCriticalWorkflows[0].name})`,
          reason: `Business-critical user workflow "${failedCriticalWorkflows[0].name}" failed execution. Goal: ${failedCriticalWorkflows[0].goal}`,
          category: 'functional',
          severity: 'critical',
          evidenceSummary: `Criticality score ${failedCriticalWorkflows[0].criticality.score}/100 with ${failedCriticalWorkflows[0].steps.length} steps.`,
        });
      }
    }

    // Blocker 6: Unauthorized Access Violation
    if (options.authorizationResults) {
      const unauthorizedViolations = options.authorizationResults.filter((a) => a.isUnauthorizedAccess);
      for (const unauth of unauthorizedViolations) {
        blockers.push({
          id: `blocker-auth-violation-${unauth.path.replace(/[^a-z0-9]/gi, '_')}`,
          title: `Security Violation: Unauthorized Access (${unauth.role} -> ${unauth.path})`,
          reason: `Role "${unauth.role}" was granted access to restricted route "${unauth.path}" violating authorization boundary.`,
          category: 'functional',
          severity: 'critical',
          evidenceSummary: unauth.evidence.join('; '),
        });
      }
    }

    // Blocker 7: API Unauthorized Access & Critical 5xx Server Crashes
    if (options.apiTestResults) {
      const apiUnauth = options.apiTestResults.filter((r) => r.isUnauthorizedAccess);
      for (const unauth of apiUnauth) {
        blockers.push({
          id: `blocker-api-unauth-${unauth.testCaseId}`,
          title: `Security Violation: Unauthorized API Access (${unauth.role || 'ROLE'} -> ${unauth.method} ${unauth.url})`,
          reason: `Role "${unauth.role || 'ROLE'}" was granted unauthorized access to restricted API endpoint "${unauth.url}".`,
          category: 'functional',
          severity: 'critical',
          evidenceSummary: unauth.errorMessage || 'Unauthorized API access granted.',
        });
      }

      const criticalApi5xx = options.apiTestResults.filter(
        (r) => r.status === 'FAILED' && r.observation?.status && r.observation.status >= 500
      );
      if (criticalApi5xx.length > 0) {
        blockers.push({
          id: `blocker-api-5xx-${criticalApi5xx[0].testCaseId}`,
          title: `Critical API Server Error (HTTP ${criticalApi5xx[0].observation?.status})`,
          reason: `API endpoint "${criticalApi5xx[0].method} ${criticalApi5xx[0].url}" returned internal server error HTTP ${criticalApi5xx[0].observation?.status}.`,
          category: 'reliability',
          severity: 'critical',
          evidenceSummary: criticalApi5xx[0].errorMessage || 'API 5xx server error',
        });
      }
    }

    // Security Deductions (Deterministic Security QA)
    const securityDeductions: ScoreDeduction[] = [];
    let secCritCount = 0;
    let secHighCount = 0;
    let secMedCount = 0;
    let secAuthViolationsCount = 0;
    let secSecretExposuresCount = 0;

    if (options.securityResult) {
      for (const finding of options.securityResult.findings) {
        if (finding.severity === 'critical') {
          secCritCount++;
          if (finding.type === 'SECRET_EXPOSURE' || finding.type === 'TOKEN_EXPOSURE') secSecretExposuresCount++;
          if (finding.type === 'AUTHENTICATION_BYPASS' || finding.type === 'PRIVILEGE_ESCALATION') secAuthViolationsCount++;
          securityDeductions.push({
            category: 'security',
            points: 35,
            reason: `Critical security defect: [${finding.type}] ${finding.title}`,
            evidenceRef: finding.id,
          });
        } else if (finding.severity === 'high') {
          secHighCount++;
          if (finding.type === 'SENSITIVE_DATA_EXPOSURE') secSecretExposuresCount++;
          if (
            finding.type === 'PUBLICLY_ACCESSIBLE_PROTECTED_ROUTE' ||
            finding.type === 'PUBLICLY_ACCESSIBLE_PROTECTED_API' ||
            finding.type === 'VERTICAL_ACCESS_VIOLATION' ||
            finding.type === 'HORIZONTAL_ACCESS_VIOLATION' ||
            finding.type === 'AUTHORIZATION_UNEXPECTED_ACCESS'
          ) {
            secAuthViolationsCount++;
          }
          securityDeductions.push({
            category: 'security',
            points: 15,
            reason: `High severity security finding: [${finding.type}] ${finding.title}`,
            evidenceRef: finding.id,
          });
        } else if (finding.severity === 'medium') {
          secMedCount++;
          securityDeductions.push({
            category: 'security',
            points: 6,
            reason: `Medium security finding: [${finding.type}] ${finding.title}`,
            evidenceRef: finding.id,
          });
        } else if (finding.severity === 'low') {
          securityDeductions.push({
            category: 'security',
            points: 2,
            reason: `Low security finding: [${finding.type}] ${finding.title}`,
            evidenceRef: finding.id,
          });
        }
      }
    }

    const totalSecurityDeduction = securityDeductions.reduce((sum, d) => sum + d.points, 0);
    const finalSecurityScore = Math.max(0, Math.min(100, 100 - totalSecurityDeduction));

    // Performance Deductions (Deterministic Performance QA)
    const performanceDeductions: ScoreDeduction[] = [];
    let perfCritCount = 0;
    let perfHighCount = 0;
    let perfMedCount = 0;
    let perfSlowPagesCount = 0;
    let perfSlowApisCount = 0;
    let perfRegressionsCount = 0;
    let perfReliabilityFailuresCount = 0;

    if (options.performanceResult) {
      for (const finding of options.performanceResult.findings) {
        if (finding.type === 'PERFORMANCE_NAVIGATION_SLOW') perfSlowPagesCount++;
        if (finding.type === 'PERFORMANCE_API_SLOW' || finding.type === 'PERFORMANCE_API_TIMEOUT') perfSlowApisCount++;
        if (finding.type === 'PERFORMANCE_REGRESSION') perfRegressionsCount++;
        if (finding.type === 'PERFORMANCE_PAGE_UNRELIABLE' || finding.type === 'PERFORMANCE_RUNTIME_UNSTABLE') perfReliabilityFailuresCount++;

        if (finding.severity === 'critical') {
          perfCritCount++;
          performanceDeductions.push({
            category: 'performance',
            points: 35,
            reason: `Critical performance failure: [${finding.type}] ${finding.title}`,
            evidenceRef: finding.id,
          });
        } else if (finding.severity === 'high') {
          perfHighCount++;
          performanceDeductions.push({
            category: 'performance',
            points: 15,
            reason: `High performance issue: [${finding.type}] ${finding.title}`,
            evidenceRef: finding.id,
          });
        } else if (finding.severity === 'medium') {
          perfMedCount++;
          performanceDeductions.push({
            category: 'performance',
            points: 6,
            reason: `Medium performance issue: [${finding.type}] ${finding.title}`,
            evidenceRef: finding.id,
          });
        } else if (finding.severity === 'low') {
          performanceDeductions.push({
            category: 'performance',
            points: 2,
            reason: `Low performance anomaly: [${finding.type}] ${finding.title}`,
            evidenceRef: finding.id,
          });
        }
      }
    }

    const totalPerformanceDeduction = performanceDeductions.reduce((sum, d) => sum + d.points, 0);
    const finalPerformanceScore = Math.max(0, Math.min(100, 100 - totalPerformanceDeduction));

    // Blocker 8: Security Defects (Deterministic Security QA)
    if (options.securityResult) {
      const critSecFindings = options.securityResult.findings.filter((f) => f.severity === 'critical');
      for (const finding of critSecFindings) {
        blockers.push({
          id: `blocker-sec-${finding.id}`,
          title: `Security Blocker: ${finding.title}`,
          reason: `Critical security defect: ${finding.description}`,
          category: 'security',
          severity: 'critical',
          evidenceSummary: finding.remediationRecommendation || finding.description,
          relatedIssueFingerprints: [finding.id],
        });
      }
    }

    // Blocker 9: Performance & Reliability Failures
    if (options.performanceResult) {
      const critPerfFindings = options.performanceResult.findings.filter((f) => f.severity === 'critical');
      for (const finding of critPerfFindings) {
        blockers.push({
          id: `blocker-perf-${finding.id}`,
          title: `Performance Blocker: ${finding.title}`,
          reason: `Critical performance failure: ${finding.description}`,
          category: 'performance',
          severity: 'critical',
          evidenceSummary: finding.remediationRecommendation || finding.description,
          relatedIssueFingerprints: [finding.id],
        });
      }
    }

    // 9. Calculate Overall Composite Score & Apply Blocker Bounds
    const rawOverallScore =
      0.35 * finalFunctionalScore +
      0.20 * finalVisualScore +
      0.20 * finalResponsiveScore +
      0.10 * finalReliabilityScore +
      0.15 * finalCoverageScore;

    let overallScore = Math.round(rawOverallScore);

    // Apply Blocker Caps
    const hasCriticalBlocker = blockers.some((b) => b.severity === 'critical');
    const highBlockersCount = blockers.filter((b) => b.severity === 'high').length;

    if (hasCriticalBlocker) {
      overallScore = Math.min(59, overallScore);
    } else if (highBlockersCount >= 2) {
      overallScore = Math.min(69, overallScore);
    }

    // If evidence is insufficient, score cannot claim production readiness
    if (confidenceLevel === 'INSUFFICIENT') {
      overallScore = Math.min(50, overallScore);
    }

    overallScore = Math.max(0, Math.min(100, overallScore));

    // 10. Determine Release Recommendation & Risk Level
    let recommendation: ReleaseRecommendation = 'RELEASE';
    if (confidenceLevel === 'INSUFFICIENT' || testRunStatus === 'cancelled') {
      recommendation = 'INSUFFICIENT_EVIDENCE';
    } else if (overallScore >= 85 && blockers.length === 0 && criticalIssues.length === 0 && confidenceLevel !== 'LOW') {
      recommendation = 'RELEASE';
    } else if (overallScore >= 70 && !hasCriticalBlocker && highIssues.length <= 2) {
      recommendation = 'RELEASE_WITH_CAUTION';
    } else {
      recommendation = 'DO_NOT_RELEASE';
    }

    let riskLevel: ReleaseRiskLevel = 'LOW';
    if (confidenceLevel === 'INSUFFICIENT') {
      riskLevel = 'UNKNOWN';
    } else if (hasCriticalBlocker || criticalIssues.length > 0) {
      riskLevel = 'CRITICAL';
    } else if (highBlockersCount > 0 || highIssues.length >= 2 || overallScore < 70) {
      riskLevel = 'HIGH';
    } else if (openIssues.length > 0 || overallScore < 85) {
      riskLevel = 'MEDIUM';
    } else {
      riskLevel = 'LOW';
    }

    // 11. Compute Historical Score Comparison
    let historicalComparison: HistoricalScoreComparison | undefined;
    if (previousAssessment && typeof previousAssessment.overallScore === 'number') {
      historicalComparison = {
        previousScore: previousAssessment.overallScore,
        currentScore: overallScore,
        change: overallScore - previousAssessment.overallScore,
        previousTestRunId: previousAssessment.testRunId,
        previousCreatedAt: previousAssessment.createdAt,
      };
    }

    const scores: CategoryScores = {
      overall: overallScore,
      functional: finalFunctionalScore,
      visual: finalVisualScore,
      responsive: finalResponsiveScore,
      reliability: finalReliabilityScore,
      coverage: finalCoverageScore,
      security: options.securityResult ? finalSecurityScore : undefined,
      performance:
        options.performanceResult &&
        (options.performanceResult.coverage.totalMeasurements > 0 ||
          options.performanceResult.findings.length > 0)
          ? finalPerformanceScore
          : undefined,
    };

    const breakdown: ScoreBreakdown = {
      categoryWeights: {
        functional: 0.35,
        visual: 0.20,
        responsive: 0.20,
        reliability: 0.10,
        coverage: 0.15,
        security: options.securityResult ? 0.20 : undefined,
        performance:
          options.performanceResult &&
          (options.performanceResult.coverage.totalMeasurements > 0 ||
            options.performanceResult.findings.length > 0)
            ? 0.15
            : undefined,
      },
      functional: {
        base: 100,
        final: finalFunctionalScore,
        deductions: functionalDeductions,
        confirmedIssuesCount,
        suspectedIssuesCount,
        failedJourneysCount,
      },
      visual: {
        base: 100,
        final: finalVisualScore,
        deductions: visualDeductions,
        regressionsCount,
        missingBaselinesCount,
      },
      responsive: {
        base: 100,
        final: finalResponsiveScore,
        deductions: responsiveDeductions,
        viewportsTested: viewportsTestedSet.size,
        overflowCount,
        clippingCount,
        overlapCount,
      },
      reliability: {
        base: 100,
        final: finalReliabilityScore,
        deductions: reliabilityDeductions,
        consoleErrorsCount: uniqueConsoleMsgs.size,
        networkErrorsCount: uniqueNetworkErrors.size,
        actionFailureRate,
      },
      coverage: {
        final: finalCoverageScore,
        pages: {
          discovered: discoveredPagesCount,
          visited: visitedPagesCount,
          ratio: pageRatio,
        },
        forms: {
          discovered: totalFormsDiscovered,
          exercised: exercisedFormsCount,
          ratio: formRatio,
        },
        buttons: {
          discovered: totalButtonsDiscovered,
          exercised: exercisedButtonsCount,
          ratio: buttonRatio,
        },
        links: {
          discovered: totalLinksDiscovered,
          exercised: exercisedLinksCount,
          ratio: linkRatio,
        },
        viewports: {
          tested: viewportsTestedSet.size,
          total: 3,
          ratio: viewportRatio,
        },
      },
      security: options.securityResult
        ? {
            base: 100,
            final: finalSecurityScore,
            deductions: securityDeductions,
            criticalFindingsCount: secCritCount,
            highFindingsCount: secHighCount,
            mediumFindingsCount: secMedCount,
            authViolationsCount: secAuthViolationsCount,
            secretExposuresCount: secSecretExposuresCount,
          }
        : undefined,
      performance:
        options.performanceResult &&
        (options.performanceResult.coverage.totalMeasurements > 0 ||
          options.performanceResult.findings.length > 0)
          ? {
              base: 100,
              final: finalPerformanceScore,
              deductions: performanceDeductions,
              slowPagesCount: perfSlowPagesCount,
              slowApisCount: perfSlowApisCount,
              regressionsCount: perfRegressionsCount,
              reliabilityFailuresCount: perfReliabilityFailuresCount,
            }
          : undefined,
      historicalComparison,
    };

    return {
      testRunId,
      projectId,
      organizationId,
      scoringVersion: RELEASE_SCORING_VERSION,
      overallScore,
      scores,
      recommendation,
      riskLevel,
      confidenceLevel,
      blockers,
      breakdown,
      evaluatedAt,
    };
  }
}

function statusCodeCheck(options: CalculateAssessmentOptions): boolean {
  if (options.testRunStatus === 'failed') {
    const is5xx = (options.networkErrors || []).some((n) => n.status && n.status >= 500);
    return is5xx;
  }
  return false;
}
