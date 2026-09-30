// ==============================================================================
// Sculra Project Production Signals API (GET / POST)
// (frontend/app/api/projects/[id]/signals/route.ts)
//
// Invariants (Prompt 64):
// - Clerk authenticated
// - Tenant & project isolation enforced
// - RBAC: SIGNALS_READ for GET, SIGNALS_INGEST for POST
// - Empty string fields normalized to null
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireProjectPermission, PERMISSIONS } from '@/lib/authz';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { SignalNormalizer } from '../../../../../../worker/src/signals/normalizer';
import { DeploymentCorrelationEngine, DeploymentCandidate } from '../../../../../../worker/src/signals/correlation-engine';
import { QAFeedbackEngine } from '../../../../../../worker/src/signals/qa-feedback-engine';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { authContext } = await requireProjectPermission(req, id, PERMISSIONS.SIGNALS_READ);

    const searchParams = req.nextUrl.searchParams;
    const severity = searchParams.get('severity');
    const status = searchParams.get('status');
    const signalType = searchParams.get('signalType');
    const deploymentId = searchParams.get('deploymentId');

    const supabase = getSupabaseServiceClient();
    if (!supabase) {
      return NextResponse.json({ success: true, signals: [], count: 0 });
    }

    let query = supabase
      .from('production_signals')
      .select('*')
      .eq('project_id', id)
      .order('last_observed_at', { ascending: false });

    if (severity) query = query.eq('severity', severity);
    if (status) query = query.eq('status', status);
    if (signalType) query = query.eq('signal_type', signalType);
    if (deploymentId) query = query.eq('deployment_id', deploymentId);

    const { data, error } = await query.limit(100);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      projectId: id,
      signals: data || [],
      count: (data || []).length,
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { success: false, error: err.message || 'Failed fetching production signals.', code: err.code },
      { status }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { authContext } = await requireProjectPermission(req, id, PERMISSIONS.SIGNALS_INGEST);

    const body = await req.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Invalid signal payload.' },
        { status: 400 }
      );
    }

    const normalized = SignalNormalizer.normalize({
      ...body,
      projectId: id,
      organizationId: authContext.orgId || body.organizationId || null,
      provider: body.provider || 'MANUAL',
    });

    const supabase = getSupabaseServiceClient();

    // Look up candidate deployments for correlation
    let candidateDeployments: DeploymentCandidate[] = [];
    if (supabase) {
      const { data: deps } = await supabase
        .from('deployments')
        .select('id, project_id, organization_id, environment_id, commit_sha, branch, deployment_url, status, created_at, started_at, completed_at')
        .eq('project_id', id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (deps) {
        candidateDeployments = deps.map((d: any) => ({
          id: d.id,
          projectId: d.project_id,
          organizationId: d.organization_id,
          environmentId: d.environment_id,
          commitSha: d.commit_sha,
          branch: d.branch,
          deploymentUrl: d.deployment_url,
          status: d.status,
          deployedAt: d.completed_at || d.started_at || d.created_at,
          createdAt: d.created_at,
        }));
      }

      await supabase.from('production_signals').insert({
        id: normalized.id,
        organization_id: normalized.organizationId,
        project_id: normalized.projectId,
        environment_id: normalized.environmentId,
        deployment_id: normalized.deploymentId,
        release_id: normalized.releaseId,
        provider: normalized.provider,
        provider_signal_id: normalized.providerSignalId,
        signal_type: normalized.signalType,
        severity: normalized.severity,
        status: normalized.status,
        title: normalized.title,
        description: normalized.description,
        fingerprint: normalized.fingerprint,
        first_observed_at: normalized.firstObservedAt,
        last_observed_at: normalized.lastObservedAt,
        affected_url: normalized.affectedUrl,
        affected_route: normalized.affectedRoute,
        affected_service: normalized.affectedService,
        affected_version: normalized.affectedVersion,
        affected_commit: normalized.affectedCommit,
        affected_branch: normalized.affectedBranch,
        occurrence_count: normalized.occurrenceCount,
        raw_reference: normalized.rawReference,
        confidence: normalized.confidence,
        created_at: normalized.createdAt,
        updated_at: normalized.updatedAt,
      });
    }

    const correlation = DeploymentCorrelationEngine.correlate(normalized, candidateDeployments);

    if (supabase) {
      await supabase.from('signal_correlations').insert({
        id: correlation.id,
        signal_id: correlation.signalId,
        project_id: correlation.projectId,
        organization_id: correlation.organizationId,
        deployment_id: correlation.deploymentId,
        release_id: correlation.releaseId,
        correlation_state: correlation.correlationState,
        confidence: correlation.confidence,
        reasons: correlation.reasons,
        evidence_details: correlation.evidenceDetails,
        evaluated_at: correlation.evaluatedAt,
      });

      if (correlation.deploymentId) {
        const memoryRecord = QAFeedbackEngine.buildRecord({
          projectId: id,
          organizationId: authContext.orgId,
          entityType: 'DEPLOYMENT_PRODUCTION_SIGNAL',
          entityId: correlation.deploymentId,
          relationshipType: correlation.correlationState === 'EXACT_MATCH'
            ? 'CONFIRMED_REGRESSION'
            : 'CORRELATED_SIGNAL',
          signalId: normalized.id,
          deploymentId: correlation.deploymentId,
          correlationState: correlation.correlationState,
          evidenceSummary: {
            signalType: normalized.signalType,
            severity: normalized.severity,
            reasons: correlation.reasons,
          },
          confidence: correlation.confidence,
        });
        await QAFeedbackEngine.persistRecord(memoryRecord, supabase);
      }
    }

    return NextResponse.json(
      {
        success: true,
        signal: normalized,
        correlation,
      },
      { status: 201 }
    );
  } catch (err: any) {
    const status = err.statusCode || (err.message?.includes('validation') ? 422 : 500);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed recording production signal.', code: err.code },
      { status }
    );
  }
}
