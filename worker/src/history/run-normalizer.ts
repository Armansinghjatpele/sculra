// ==============================================================================
// Sculra Run & Finding Normalization Engine (worker/src/history/run-normalizer.ts)
// ==============================================================================

import { HistoricalRun, HistoricalFinding } from './types';
import {
  normalizeUrlForFingerprint,
  normalizeSelectorForFingerprint,
  normalizeErrorSignatureForFingerprint,
  computeBugFingerprint,
} from '../issues/fingerprint';
import { BugObservation } from '../issues/types';

export class RunNormalizer {
  /**
   * Normalizes raw database or memory run data into standard HistoricalRun.
   */
  static normalizeRun(rawRun: any): HistoricalRun {
    const rawScore =
      typeof rawRun.overall_score === 'number'
        ? rawRun.overall_score
        : typeof rawRun.overallScore === 'number'
        ? rawRun.overallScore
        : undefined;

    return {
      testRunId: rawRun.id || rawRun.testRunId || rawRun.test_run_id || '',
      projectId: rawRun.project_id || rawRun.projectId || '',
      organizationId: rawRun.organization_id || rawRun.organizationId || null,
      status: rawRun.status || 'passed',
      createdAt: rawRun.created_at || rawRun.createdAt || new Date().toISOString(),
      completedAt: rawRun.completed_at || rawRun.completedAt || undefined,
      durationMs: typeof rawRun.duration_ms === 'number' ? rawRun.duration_ms : rawRun.durationMs,
      environment: (rawRun.environment || rawRun.metadata?.environment || 'staging').toLowerCase(),
      branch: rawRun.branch || rawRun.metadata?.branch || null,
      commitRef: rawRun.commit_sha || rawRun.commitRef || rawRun.metadata?.commitSha || null,
      targetUrl: normalizeUrlForFingerprint(rawRun.url || rawRun.targetUrl || ''),
      overallScore: typeof rawScore === 'number' && !isNaN(rawScore) ? rawScore : undefined,
      functionalityScore:
        typeof rawRun.functionality_score === 'number'
          ? rawRun.functionality_score
          : typeof rawRun.functionalityScore === 'number'
          ? rawRun.functionalityScore
          : undefined,
      uiScore:
        typeof rawRun.ui_score === 'number'
          ? rawRun.ui_score
          : typeof rawRun.uiScore === 'number'
          ? rawRun.uiScore
          : undefined,
      responsiveScore:
        typeof rawRun.responsive_score === 'number'
          ? rawRun.responsive_score
          : typeof rawRun.responsiveScore === 'number'
          ? rawRun.responsiveScore
          : undefined,
      reliabilityScore:
        typeof rawRun.reliability_score === 'number'
          ? rawRun.reliability_score
          : typeof rawRun.reliabilityScore === 'number'
          ? rawRun.reliabilityScore
          : undefined,
      coverageScore:
        typeof rawRun.coverage_score === 'number'
          ? rawRun.coverage_score
          : typeof rawRun.coverageScore === 'number'
          ? rawRun.coverageScore
          : undefined,
      securityScore:
        typeof rawRun.security_score === 'number'
          ? rawRun.security_score
          : typeof rawRun.securityScore === 'number'
          ? rawRun.securityScore
          : undefined,
      performanceScore:
        typeof rawRun.performance_score === 'number'
          ? rawRun.performance_score
          : typeof rawRun.performanceScore === 'number'
          ? rawRun.performanceScore
          : undefined,
      accessibilityScore:
        typeof rawRun.accessibility_score === 'number'
          ? rawRun.accessibility_score
          : typeof rawRun.accessibilityScore === 'number'
          ? rawRun.accessibilityScore
          : undefined,
      releaseRecommendation: rawRun.recommendation || rawRun.releaseRecommendation || undefined,
      riskLevel: rawRun.risk_level || rawRun.riskLevel || undefined,
      confidenceLevel: rawRun.confidence_level || rawRun.confidenceLevel || undefined,
      blockersCount:
        typeof rawRun.blockers_count === 'number'
          ? rawRun.blockers_count
          : typeof rawRun.blockersCount === 'number'
          ? rawRun.blockersCount
          : undefined,
      viewport: rawRun.viewport || (rawRun.metadata?.viewport ? rawRun.metadata.viewport : undefined),
      role: rawRun.role || rawRun.metadata?.role || undefined,
      findings: Array.isArray(rawRun.findings) ? rawRun.findings : [],
      targets: Array.isArray(rawRun.targets) ? rawRun.targets : [],
      coverage: rawRun.coverage,
      metrics: rawRun.metrics || {},
    };
  }

  /**
   * Normalizes a BugObservation into a HistoricalFinding.
   */
  static normalizeBugObservation(
    bug: BugObservation,
    runId: string,
    projectId: string
  ): HistoricalFinding {
    const normUrl = normalizeUrlForFingerprint(bug.url || '');
    const normSelector = normalizeSelectorForFingerprint(bug.selector);
    const normError = normalizeErrorSignatureForFingerprint(bug.errorSignature);

    const fp =
      bug.fingerprint ||
      computeBugFingerprint({
        projectId,
        url: normUrl,
        bugType: bug.type,
        selector: normSelector,
        action: bug.action,
        errorSignature: normError,
      });

    return {
      id: bug.id,
      fingerprint: fp,
      title: bug.title,
      type: bug.type,
      severity: bug.severity,
      category: bug.metadata?.category || 'functional',
      targetUrl: normUrl,
      selector: normSelector || undefined,
      action: bug.action,
      errorSignature: normError || undefined,
      method: bug.metadata?.method ? bug.metadata.method.toUpperCase() : undefined,
      role: bug.metadata?.role || undefined,
      viewport: bug.metadata?.viewport || undefined,
      firstSeenRunId: runId,
      lastSeenRunId: runId,
      firstSeenAt: bug.timestamp || new Date().toISOString(),
      lastSeenAt: bug.timestamp || new Date().toISOString(),
      occurrenceCount: 1,
      consecutiveRunCount: 1,
      historicalStatus: 'CURRENT',
      metadata: bug.metadata || {},
    };
  }

  /**
   * Normalizes database issue record into HistoricalFinding.
   */
  static normalizeDbIssue(issue: any, runId?: string): HistoricalFinding {
    const meta = issue.metadata || {};
    const normUrl = normalizeUrlForFingerprint(issue.url || meta.url || '');
    const normSelector = normalizeSelectorForFingerprint(issue.selector || meta.selector);
    const normError = normalizeErrorSignatureForFingerprint(issue.error_signature || meta.errorSignature);

    return {
      id: issue.id,
      fingerprint: issue.fingerprint,
      title: issue.title,
      type: meta.type || issue.category || 'GENERIC_ISSUE',
      severity: issue.severity || 'medium',
      category: issue.category || 'functional',
      targetUrl: normUrl,
      selector: normSelector || undefined,
      action: meta.action,
      errorSignature: normError || undefined,
      method: meta.method ? meta.method.toUpperCase() : undefined,
      role: meta.role || undefined,
      viewport: meta.viewport || undefined,
      firstSeenRunId: meta.firstSeenRunId || issue.test_run_id,
      lastSeenRunId: runId || issue.test_run_id,
      firstSeenAt: issue.first_seen_at || issue.created_at || new Date().toISOString(),
      lastSeenAt: issue.last_seen_at || issue.created_at || new Date().toISOString(),
      occurrenceCount: issue.occurrence_count || 1,
      consecutiveRunCount: issue.consecutive_count || issue.occurrence_count || 1,
      historicalStatus: issue.status === 'resolved' ? 'RECOVERED' : 'HISTORICAL',
      metadata: meta,
    };
  }

  /**
   * Normalizes finding type names into a canonical format.
   */
  static normalizeFindingType(type: string): string {
    return (type || '').trim().toUpperCase().replace(/[-\s]+/g, '_');
  }

  /**
   * Normalizes metric names across performance / accessibility / security domains.
   */
  static normalizeMetricName(name: string): string {
    return (name || '').trim().toLowerCase().replace(/[\s_-]+/g, '_');
  }

  /**
   * Constructs a HistoricalRun from TestExecutionResult and optional ReleaseAssessment.
   */
  static fromExecutionResult(params: {
    testRunId: string;
    projectId: string;
    organizationId?: string | null;
    targetUrl: string;
    result: any;
    assessment?: any;
    environment?: string;
    viewport?: string;
    role?: string;
  }): HistoricalRun {
    const { testRunId, projectId, organizationId, targetUrl, result, assessment, environment, viewport, role } = params;

    const findings: HistoricalFinding[] = [];

    // Functional & Visual bug observations
    if (Array.isArray(result.bugObservations)) {
      for (const bug of result.bugObservations) {
        findings.push(this.normalizeBugObservation(bug, testRunId, projectId));
      }
    }

    // Security findings
    const secFindings = result.securityFindings || result.securityResult?.findings || [];
    for (const sf of secFindings) {
      const normUrl = normalizeUrlForFingerprint(sf.targetUrl || targetUrl);
      const fp = sf.fingerprint || computeBugFingerprint({
        projectId,
        url: normUrl,
        bugType: sf.type || 'SECURITY_FINDING',
        selector: sf.selector,
        errorSignature: sf.title,
      });
      findings.push({
        id: sf.id,
        fingerprint: fp,
        title: sf.title,
        type: sf.type || 'SECURITY_FINDING',
        severity: sf.severity || 'high',
        category: 'security',
        targetUrl: normUrl,
        selector: sf.selector,
        errorSignature: sf.evidence?.signature,
        firstSeenRunId: testRunId,
        lastSeenRunId: testRunId,
        firstSeenAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
        occurrenceCount: 1,
        consecutiveRunCount: 1,
        historicalStatus: 'CURRENT',
        metadata: sf,
      });
    }

    // Performance findings
    const perfFindings = result.performanceFindings || result.performanceResult?.findings || [];
    for (const pf of perfFindings) {
      const normUrl = normalizeUrlForFingerprint(pf.targetUrl || targetUrl);
      const fp = pf.fingerprint || computeBugFingerprint({
        projectId,
        url: normUrl,
        bugType: pf.type || 'PERFORMANCE_FINDING',
        selector: pf.selector,
        errorSignature: pf.title,
      });
      findings.push({
        id: pf.id,
        fingerprint: fp,
        title: pf.title,
        type: pf.type || 'PERFORMANCE_FINDING',
        severity: pf.severity || 'medium',
        category: 'performance',
        targetUrl: normUrl,
        selector: pf.selector,
        errorSignature: pf.evidence?.signature,
        firstSeenRunId: testRunId,
        lastSeenRunId: testRunId,
        firstSeenAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
        occurrenceCount: 1,
        consecutiveRunCount: 1,
        historicalStatus: 'CURRENT',
        metadata: pf,
      });
    }

    // Accessibility findings
    const a11yFindings = result.accessibilityFindings || result.accessibilityResult?.findings || [];
    for (const af of a11yFindings) {
      const normUrl = normalizeUrlForFingerprint(af.targetUrl || targetUrl);
      const normSel = normalizeSelectorForFingerprint(af.selector);
      const fp = af.fingerprint || computeBugFingerprint({
        projectId,
        url: normUrl,
        bugType: af.type || 'ACCESSIBILITY_FINDING',
        selector: normSel,
        errorSignature: af.title,
      });
      findings.push({
        id: af.id,
        fingerprint: fp,
        title: af.title,
        type: af.type || 'ACCESSIBILITY_FINDING',
        severity: af.severity || 'medium',
        category: 'accessibility',
        targetUrl: normUrl,
        selector: normSel,
        errorSignature: af.evidence?.signature,
        firstSeenRunId: testRunId,
        lastSeenRunId: testRunId,
        firstSeenAt: new Date().toISOString(),
        lastSeenAt: new Date().toISOString(),
        occurrenceCount: 1,
        consecutiveRunCount: 1,
        historicalStatus: 'CURRENT',
        metadata: af,
      });
    }

    // Targets discovered & tested
    const targets: import('./types').HistoricalTarget[] = [];
    const testedUrls = new Set<string>();

    if (result.applicationMap?.pages) {
      for (const p of result.applicationMap.pages) {
        testedUrls.add(p.url);
        targets.push({
          targetType: 'page',
          targetIdentifier: normalizeUrlForFingerprint(p.url),
          url: p.url,
          tested: true,
          status: 'passed',
        });
      }
    }
    if (testedUrls.size === 0 && targetUrl) {
      targets.push({
        targetType: 'page',
        targetIdentifier: normalizeUrlForFingerprint(targetUrl),
        url: targetUrl,
        tested: true,
        status: result.status === 'passed' ? 'passed' : 'failed',
      });
    }

    // Extract coverage
    const coverage: import('./types').HistoricalCoverage = {
      pagesDiscovered: result.applicationMap?.totalPages || testedUrls.size || 1,
      pagesTested: testedUrls.size || 1,
      formsDiscovered: result.applicationMap?.totalForms || 0,
      formsTested: result.applicationMap?.totalForms || 0,
      buttonsDiscovered: result.applicationMap?.totalButtons || 0,
      buttonsTested: result.applicationMap?.totalButtons || 0,
      linksDiscovered: result.applicationMap?.totalLinks || 0,
      linksTested: result.applicationMap?.totalLinks || 0,
      apiEndpointsDiscovered: result.apiCoverage?.endpointsDiscovered,
      apiEndpointsTested: result.apiCoverage?.endpointsTested,
      securityChecksCount: result.securityCoverage?.checksExecuted,
      performanceAuditsCount: result.performanceCoverage?.totalMeasurements,
      accessibilityChecksCount: result.accessibilityCoverage?.totalChecks,
    };

    // Extract metrics
    const metrics: Record<string, number> = {};
    if (result.performanceCoverage?.averageLcp) metrics.lcp = result.performanceCoverage.averageLcp;
    if (result.performanceCoverage?.averageCls) metrics.cls = result.performanceCoverage.averageCls;
    if (result.performanceCoverage?.averageTtfb) metrics.ttfb = result.performanceCoverage.averageTtfb;
    if (result.performanceCoverage?.performanceScore !== undefined) metrics.performance_score = result.performanceCoverage.performanceScore;
    if (result.accessibilityCoverage?.accessibilityScore !== undefined) metrics.accessibility_score = result.accessibilityCoverage.accessibilityScore;
    if (result.securityCoverage?.securityScore !== undefined) metrics.security_score = result.securityCoverage.securityScore;
    if (assessment?.overallScore !== undefined) metrics.release_score = assessment.overallScore;

    return {
      testRunId,
      projectId,
      organizationId: organizationId || null,
      status: result.status,
      createdAt: new Date().toISOString(),
      durationMs: result.durationMs,
      environment: environment || 'staging',
      targetUrl: normalizeUrlForFingerprint(targetUrl),
      overallScore: assessment?.overallScore,
      functionalityScore: assessment?.scores?.functional,
      uiScore: assessment?.scores?.visual,
      responsiveScore: assessment?.scores?.responsive,
      reliabilityScore: assessment?.scores?.reliability,
      coverageScore: assessment?.scores?.coverage,
      securityScore: assessment?.scores?.security,
      performanceScore: assessment?.scores?.performance,
      accessibilityScore: assessment?.scores?.accessibility,
      releaseRecommendation: assessment?.recommendation,
      riskLevel: assessment?.riskLevel,
      confidenceLevel: assessment?.confidenceLevel,
      blockersCount: assessment?.blockers?.length,
      viewport,
      role,
      findings,
      targets,
      coverage,
      metrics,
    };
  }
}
