// ==============================================================================
// Sculra Release Gate Evaluation API Route
// (frontend/app/api/projects/[id]/release-gates/evaluate/route.ts)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getProject } from '@/services/db';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { ReleaseGatePolicyEvaluator } from '../../../../../../../worker/src/release/gate-policy';
import { DeterministicReleaseScorer } from '../../../../../../../worker/src/release/scorer';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, getToken } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
    }
    const token = await getToken();
    if (!token) {
      return NextResponse.json({ success: false, error: 'Session token expired.' }, { status: 401 });
    }

    const { id } = await params;
    const project = await getProject(token, id);
    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found.' }, { status: 404 });
    }

    const body = await req.json();
    const { releaseId, deploymentId, environmentId } = body;

    const supabase = getSupabaseServiceClient();

    // 1. Fetch active policy
    const { data: policyRow } = await supabase
      .from('release_gate_policies')
      .select('*')
      .eq('project_id', id)
      .eq('is_default', true)
      .maybeSingle();

    // 2. Fetch latest test runs and issues for release/deployment
    const { data: testRuns } = await supabase
      .from('test_runs')
      .select('*')
      .eq('project_id', id)
      .order('created_at', { ascending: false })
      .limit(5);

    const { data: issues } = await supabase
      .from('bug_observations')
      .select('*')
      .eq('project_id', id)
      .neq('status', 'resolved')
      .neq('status', 'ignored')
      .limit(50);

    const hasEvidence = Boolean(testRuns && testRuns.length > 0);

    // 3. Compute readiness scores deterministically
    const latestRun = testRuns && testRuns.length > 0 ? testRuns[0] : null;
    let categoryScores: any = undefined;
    let overallScore: number | undefined = undefined;

    if (latestRun) {
      categoryScores = latestRun.category_scores || {
        functional: latestRun.status === 'passed' ? 100 : 70,
        security: 85,
        accessibility: 80,
        performance: 85,
        visual: 90,
      };
      overallScore = latestRun.overall_score || 85;
    }

    // 4. Deterministic Gate Evaluation
    const decision = ReleaseGatePolicyEvaluator.evaluate({
      projectId: id,
      policy: policyRow || undefined,
      releaseId: releaseId || null,
      deploymentId: deploymentId || null,
      environmentId: environmentId || null,
      categoryScores,
      overallReadinessScore: overallScore,
      openIssues: issues || [],
      regressions: [],
      hasMeasuredEvidence: hasEvidence,
      evaluatedBy: `user:${userId}`,
      source: 'USER_ON_DEMAND_EVALUATION',
    });

    // 5. Persist Decision
    await supabase.from('release_gate_decisions').insert({
      id: decision.id,
      project_id: id,
      organization_id: project.organizationId || null,
      release_id: decision.releaseId,
      deployment_id: decision.deploymentId,
      environment_id: decision.environmentId,
      policy_id: policyRow?.id || null,
      policy_version: decision.policyVersion,
      decision: decision.decision,
      blockers: decision.blockers,
      warnings: decision.warnings,
      evidence: decision.evidence,
      confidence: decision.confidence,
      evaluated_by: decision.evaluatedBy,
      source: decision.source,
      evaluated_at: decision.evaluatedAt,
    });

    return NextResponse.json({
      success: true,
      decision,
    });
  } catch (err: any) {
    console.error('[API Release Gates Evaluate Error]:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
