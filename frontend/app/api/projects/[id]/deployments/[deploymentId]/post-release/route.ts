// ==============================================================================
// Sculra Deployment Post-Release Intelligence API Route (GET)
// (frontend/app/api/projects/[id]/deployments/[deploymentId]/post-release/route.ts)
//
// Invariants (Prompt 64):
// - Distinguishes measured facts from unknown
// - Missing monitoring data returns INSUFFICIENT_EVIDENCE, never HEALTHY
// - Enforces Clerk auth + SIGNALS_READ / DEPLOYMENTS_READ
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireProjectPermission, PERMISSIONS } from '@/lib/authz';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { PostReleaseOrchestrator } from '../../../../../../../../worker/src/signals/post-release-orchestrator';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; deploymentId: string }> }
) {
  try {
    const { id, deploymentId } = await params;
    await requireProjectPermission(req, id, PERMISSIONS.DEPLOYMENTS_READ);

    const supabase = getSupabaseServiceClient();
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: 'Database service unavailable.' },
        { status: 503 }
      );
    }

    // 1. Fetch deployment
    const { data: deployment, error: depErr } = await supabase
      .from('deployments')
      .select('*')
      .eq('id', deploymentId)
      .eq('project_id', id)
      .maybeSingle();

    if (depErr || !deployment) {
      return NextResponse.json(
        { success: false, error: 'Deployment not found.' },
        { status: 404 }
      );
    }

    // 2. Fetch correlated signals
    const { data: correlations } = await supabase
      .from('signal_correlations')
      .select('*, production_signals(*)')
      .eq('deployment_id', deploymentId)
      .order('evaluated_at', { ascending: false });

    // Also fetch signals directly referencing this deployment_id
    const { data: directSignals } = await supabase
      .from('production_signals')
      .select('*')
      .eq('deployment_id', deploymentId)
      .order('last_observed_at', { ascending: false });

    const allSignalsMap = new Map<string, any>();
    for (const sig of directSignals || []) {
      allSignalsMap.set(sig.id, sig);
    }
    for (const corr of correlations || []) {
      if (corr.production_signals) {
        allSignalsMap.set(corr.production_signals.id, corr.production_signals);
      }
    }
    const signals = Array.from(allSignalsMap.values());

    // 3. Fetch post-release verifications
    const { data: verifications } = await supabase
      .from('post_release_verifications')
      .select('*')
      .eq('deployment_id', deploymentId)
      .order('created_at', { ascending: false });

    // Check if monitoring is configured in project/env
    const hasMonitoring = Boolean(
      process.env.SENTRY_AUTH_TOKEN ||
      process.env.SENTRY_WEBHOOK_SECRET ||
      process.env.SIGNAL_WEBHOOK_SECRET
    );

    // Evaluate health state
    const latestVerification = (verifications && verifications.length > 0) ? verifications[0] : null;
    const verificationPassed = latestVerification
      ? latestVerification.status === 'COMPLETED' && latestVerification.health_state === 'HEALTHY'
      : null;

    const evaluation = PostReleaseOrchestrator.evaluateHealthState({
      deploymentId,
      hasMonitoringConfigured: hasMonitoring,
      productionSignals: signals.map((s: any) => ({
        ...s,
        signalType: s.signal_type,
        firstObservedAt: s.first_observed_at,
        lastObservedAt: s.last_observed_at,
      })),
      verificationCampaignStatus: latestVerification?.status || null,
      verificationPassed,
      recoveryObserved: latestVerification?.health_state === 'RECOVERY_OBSERVED',
    });

    return NextResponse.json({
      success: true,
      deploymentId,
      projectId: id,
      environmentId: deployment.environment_id,
      commitSha: deployment.commit_sha,
      healthState: evaluation.healthState,
      reasons: evaluation.reasons,
      hasMonitoringConfigured: hasMonitoring,
      signalsCount: signals.length,
      signals,
      correlations: correlations || [],
      verifications: verifications || [],
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { success: false, error: err.message || 'Failed fetching post-release intelligence.', code: err.code },
      { status }
    );
  }
}
