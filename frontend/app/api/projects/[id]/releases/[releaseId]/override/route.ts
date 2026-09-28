// ==============================================================================
// Sculra Release Gate Override API Route (POST)
// (frontend/app/api/projects/[id]/releases/[releaseId]/override/route.ts)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getProject } from '@/services/db';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { ReleaseGateApprovalManager } from '../../../../../../../../worker/src/release/human-approval';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; releaseId: string }> }
) {
  try {
    const { userId, getToken, orgRole } = await auth();
    if (!userId) {
      return NextResponse.json({ success: false, error: 'Unauthorized.' }, { status: 401 });
    }
    const token = await getToken();
    if (!token) {
      return NextResponse.json({ success: false, error: 'Session token expired.' }, { status: 401 });
    }

    const { id, releaseId } = await params;
    const project = await getProject(token, id);
    if (!project) {
      return NextResponse.json({ success: false, error: 'Project not found.' }, { status: 404 });
    }

    // Role Permission Check: Only Owner or Admin can override release gates
    const isOwnerOrAdmin =
      orgRole === 'org:admin' ||
      orgRole === 'admin' ||
      orgRole === 'owner' ||
      project.createdBy === userId;

    if (!isOwnerOrAdmin) {
      return NextResponse.json(
        {
          success: false,
          error: "Forbidden. Explicit 'release.gates.override' permission required (Owner or Admin role required).",
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { reason, overrideDecision = 'PASS' } = body;

    if (!reason || reason.trim().length < 5) {
      return NextResponse.json(
        { success: false, error: 'A detailed justification reason (min 5 characters) is required for override.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();

    // Fetch latest gate decision for release
    const { data: decisionRow } = await supabase
      .from('release_gate_decisions')
      .select('*')
      .eq('project_id', id)
      .eq('release_id', releaseId)
      .order('evaluated_at', { ascending: false })
      .maybeSingle();

    if (!decisionRow) {
      return NextResponse.json(
        { success: false, error: 'No release gate decision found for this release.' },
        { status: 404 }
      );
    }

    const { overrideRecord, updatedDecision } = ReleaseGateApprovalManager.processOverride({
      decision: {
        id: decisionRow.id,
        releaseId: decisionRow.release_id,
        deploymentId: decisionRow.deployment_id,
        projectId: decisionRow.project_id,
        environmentId: decisionRow.environment_id,
        policyId: decisionRow.policy_id,
        policyVersion: decisionRow.policy_version,
        decision: decisionRow.decision,
        blockers: decisionRow.blockers || [],
        warnings: decisionRow.warnings || [],
        evidence: decisionRow.evidence || [],
        confidence: Number(decisionRow.confidence) || 1.0,
        evaluatedAt: decisionRow.evaluated_at,
        evaluatedBy: decisionRow.evaluated_by,
        source: decisionRow.source,
      },
      organizationId: project.organizationId || null,
      actorId: userId,
      actorRole: orgRole || 'admin',
      overrideDecision,
      reason,
      hasOverridePermission: true,
    });

    // Update Decision
    await supabase
      .from('release_gate_decisions')
      .update({
        decision: updatedDecision.decision,
        evaluated_by: updatedDecision.evaluatedBy,
        evaluated_at: updatedDecision.evaluatedAt,
      })
      .eq('id', updatedDecision.id);

    return NextResponse.json({
      success: true,
      override: overrideRecord,
      decision: updatedDecision,
    });
  } catch (err: any) {
    console.error('[API Release Override Error]:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
