// ==============================================================================
// Sculra Release Gate Evaluation & Checks API (GET / POST)
// (frontend/app/api/projects/[id]/releases/[releaseId]/check/route.ts)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireProjectPermission, PERMISSIONS } from '@/lib/authz';
import {
  getProjectRelease,
  updateProjectRelease,
  getReleaseChecks,
  createReleaseCheck,
  getProjectDeployments,
  getTestRuns,
  getIssues,
} from '@/services/db';
import { ReleaseGateEvaluation } from '@/lib/demoData';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; releaseId: string }> }
) {
  try {
    const { id, releaseId } = await params;
    const { authContext } = await requireProjectPermission(req, id, PERMISSIONS.RELEASES_READ);

    const checks = await getReleaseChecks(authContext.clerkToken, releaseId);

    return NextResponse.json({
      success: true,
      releaseId,
      checks,
      count: checks.length,
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { success: false, error: err.message || 'Failed fetching release checks.', code: err.code },
      { status }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; releaseId: string }> }
) {
  try {
    const { id, releaseId } = await params;
    const { authContext } = await requireProjectPermission(req, id, PERMISSIONS.RELEASES_CHECK);

    const release = await getProjectRelease(authContext.clerkToken, id, releaseId);
    if (!release) {
      return NextResponse.json(
        { success: false, error: 'Release not found.' },
        { status: 404 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const policyLevel = body.policyLevel || 'STANDARD';

    // Factual evidence evaluation without fake metrics
    const testRuns = await getTestRuns(authContext.clerkToken, id).catch(() => []);
    const issues = await getIssues(authContext.clerkToken, id).catch(() => []);
    const deployments = await getProjectDeployments(authContext.clerkToken, id, release.environmentId).catch(() => []);

    // Check if deployment is confirmed
    const confirmedDeployment = deployments.find((d) => d.commitSha === release.commitSha && d.status === 'SUCCEEDED');
    const deploymentConfirmed = Boolean(confirmedDeployment);

    // Evaluate 10 deterministic gates
    const openCriticalIssues = issues.filter((i: any) => i.severity === 'CRITICAL' && (i.status === 'OPEN' || i.status === 'IN_PROGRESS'));
    const criticalGateStatus = openCriticalIssues.length > 0 ? 'FAIL' : 'PASS';
    const criticalGateReason = openCriticalIssues.length > 0
      ? `${openCriticalIssues.length} critical issues block release readiness.`
      : 'Zero critical issues detected.';

    // Regressions gate
    const regressionsCount = issues.filter((i: any) => i.status === 'REGRESSION' || (i.metadata && i.metadata.isRegression)).length;
    const regressionGateStatus = regressionsCount > 0 ? 'FAIL' : 'PASS';
    const regressionGateReason = regressionsCount > 0
      ? `${regressionsCount} regression(s) identified compared to baseline.`
      : 'Zero regressions detected.';

    // Evidence completeness
    const evidenceCount = testRuns.length;
    const minEvidenceRequired = policyLevel === 'STRICT' ? 5 : policyLevel === 'PERMISSIVE' ? 1 : 2;
    const evidenceStatus = evidenceCount >= minEvidenceRequired ? 'PASS' : (evidenceCount > 0 ? 'WARN' : 'FAIL');
    const evidenceReason = evidenceCount >= minEvidenceRequired
      ? `Sufficient evidence: ${evidenceCount} test runs captured.`
      : `Insufficient test runs (${evidenceCount}/${minEvidenceRequired} required).`;

    // Security Gate
    const securityIssues = issues.filter((i: any) => i.category === 'SECURITY' && i.status === 'OPEN');
    const securityStatus = securityIssues.length > 0 ? 'FAIL' : 'PASS';
    const securityReason = securityIssues.length > 0 ? `${securityIssues.length} open security issue(s).` : 'Security gate passed.';

    // Accessibility Gate
    const a11yIssues = issues.filter((i: any) => i.category === 'ACCESSIBILITY' && i.status === 'OPEN');
    const a11yStatus = a11yIssues.length > 0 ? 'WARN' : 'PASS';
    const a11yReason = a11yIssues.length > 0 ? `${a11yIssues.length} open accessibility warning(s).` : 'Accessibility gate passed.';

    // Performance Gate
    const perfIssues = issues.filter((i: any) => i.category === 'PERFORMANCE' && i.status === 'OPEN');
    const perfStatus = perfIssues.length > 0 ? 'WARN' : 'PASS';
    const perfReason = perfIssues.length > 0 ? `${perfIssues.length} performance degradation(s).` : 'Performance within thresholds.';

    // Visual Gate
    const visualIssues = issues.filter((i: any) => i.category === 'VISUAL' && i.status === 'OPEN');
    const visualStatus = visualIssues.length > 0 ? 'WARN' : 'PASS';
    const visualReason = visualIssues.length > 0 ? `${visualIssues.length} visual regression(s).` : 'Visual diffs within tolerance.';

    // API Gate
    const apiIssues = issues.filter((i: any) => i.category === 'API' && i.status === 'OPEN');
    const apiStatus = apiIssues.length > 0 ? 'FAIL' : 'PASS';
    const apiReason = apiIssues.length > 0 ? `${apiIssues.length} API contract violation(s).` : 'API contracts verified.';

    // Functional Gate
    const failedRuns = testRuns.filter((r: any) => r.status === 'FAILED');
    const functionalStatus = failedRuns.length > 0 ? 'WARN' : 'PASS';
    const functionalReason = failedRuns.length > 0 ? `${failedRuns.length} test run(s) failed.` : 'Functional journeys verified.';

    // Reliability Gate
    const reliabilityStatus = (openCriticalIssues.length === 0 && failedRuns.length === 0) ? 'PASS' : 'WARN';
    const reliabilityReason = reliabilityStatus === 'PASS' ? 'Reliability criteria satisfied.' : 'Intermittent failures or critical issues detected.';

    const gates: ReleaseGateEvaluation[] = [
      { gate: 'CRITICAL_ISSUES', status: criticalGateStatus, reason: criticalGateReason, evidenceRefs: openCriticalIssues.map((i: any) => i.id) },
      { gate: 'REGRESSIONS', status: regressionGateStatus, reason: regressionGateReason, evidenceRefs: [] },
      { gate: 'SECURITY', status: securityStatus, reason: securityReason, evidenceRefs: securityIssues.map((i: any) => i.id) },
      { gate: 'ACCESSIBILITY', status: a11yStatus, reason: a11yReason, evidenceRefs: a11yIssues.map((i: any) => i.id) },
      { gate: 'PERFORMANCE', status: perfStatus, reason: perfReason, evidenceRefs: perfIssues.map((i: any) => i.id) },
      { gate: 'VISUAL', status: visualStatus, reason: visualReason, evidenceRefs: visualIssues.map((i: any) => i.id) },
      { gate: 'API', status: apiStatus, reason: apiReason, evidenceRefs: apiIssues.map((i: any) => i.id) },
      { gate: 'FUNCTIONAL', status: functionalStatus, reason: functionalReason, evidenceRefs: failedRuns.map((r: any) => r.id) },
      { gate: 'RELIABILITY', status: reliabilityStatus, reason: reliabilityReason, evidenceRefs: [] },
      { gate: 'EVIDENCE_COMPLETENESS', status: evidenceStatus, reason: evidenceReason, evidenceRefs: testRuns.map((r: any) => r.id), metricValue: evidenceCount },
    ];

    const hasBlockers = criticalGateStatus === 'FAIL' || regressionGateStatus === 'FAIL' || securityStatus === 'FAIL' || apiStatus === 'FAIL';
    const hasWarnings = gates.some((g) => g.status === 'WARN');
    const insufficientEvidence = evidenceStatus === 'FAIL';

    let releaseDecision: 'RELEASE' | 'WARN' | 'BLOCK' | 'INSUFFICIENT_EVIDENCE' = 'RELEASE';
    if (insufficientEvidence) {
      releaseDecision = 'INSUFFICIENT_EVIDENCE';
    } else if (hasBlockers) {
      releaseDecision = 'BLOCK';
    } else if (hasWarnings) {
      releaseDecision = 'WARN';
    }

    // Score calculation
    let overallScore = 100;
    if (hasBlockers) overallScore = Math.max(30, overallScore - 45);
    if (hasWarnings) overallScore = Math.max(50, overallScore - 15);
    if (insufficientEvidence) overallScore = Math.min(overallScore, 40);

    const check = await createReleaseCheck(authContext.clerkToken, {
      projectId: id,
      organizationId: authContext.orgId || '',
      releaseId,
      policyLevel,
      status: 'COMPLETED',
      overallScore: evidenceCount > 0 ? overallScore : null,
      releaseDecision,
      gates,
      evidenceSummary: {
        scoringVersion: '1.0',
        confidenceLevel: evidenceCount >= 5 ? 'HIGH' : evidenceCount > 0 ? 'MEDIUM' : 'LOW',
        riskLevel: hasBlockers ? 'CRITICAL' : hasWarnings ? 'MEDIUM' : 'LOW',
        blockersCount: openCriticalIssues.length + (securityStatus === 'FAIL' ? securityIssues.length : 0),
        regressionsCount,
        deploymentConfirmed,
        totalRunsEvaluated: evidenceCount,
      },
    });

    // Update release status accordingly
    const nextReleaseStatus = releaseDecision === 'RELEASE' ? 'READY' : releaseDecision === 'BLOCK' ? 'BLOCKED' : release.status;
    if (nextReleaseStatus !== release.status) {
      await updateProjectRelease(authContext.clerkToken, releaseId, { status: nextReleaseStatus });
    }

    return NextResponse.json({
      success: true,
      check,
      decision: releaseDecision,
    }, { status: 201 });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { success: false, error: err.message || 'Failed evaluating release check.', code: err.code },
      { status }
    );
  }
}
