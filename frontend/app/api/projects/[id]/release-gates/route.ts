// ==============================================================================
// Sculra Project Release Gate Policies API (GET, POST)
// (frontend/app/api/projects/[id]/release-gates/route.ts)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getProject } from '@/services/db';
import { getSupabaseUserClient, getSupabaseServiceClient } from '@/lib/supabase';
import { DEFAULT_CANONICAL_GATE_RULES, DEFAULT_RELEASE_GATE_POLICY_VERSION } from '../../../../../../worker/src/release/gate-policy';

export async function GET(
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

    const supabase = getSupabaseServiceClient();

    // 1. Fetch active policy
    const { data: policyData } = await supabase
      .from('release_gate_policies')
      .select('*')
      .eq('project_id', id)
      .eq('is_default', true)
      .maybeSingle();

    const policy = policyData || {
      id: `default-${id}`,
      projectId: id,
      name: 'Standard Release Gate Policy',
      version: DEFAULT_RELEASE_GATE_POLICY_VERSION,
      isDefault: true,
      rules: DEFAULT_CANONICAL_GATE_RULES,
      requireApprovalOnReview: true,
      requireApprovalOnWarn: false,
    };

    // 2. Fetch latest gate decisions
    const { data: decisions } = await supabase
      .from('release_gate_decisions')
      .select('*')
      .eq('project_id', id)
      .order('evaluated_at', { ascending: false })
      .limit(10);

    return NextResponse.json({
      success: true,
      projectId: id,
      policy,
      recentDecisions: decisions || [],
    });
  } catch (err: any) {
    console.error('[API Release Gates GET Error]:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

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
    const { name, version, rules, requireApprovalOnReview, requireApprovalOnWarn } = body;

    const supabase = getSupabaseServiceClient();

    // Insert or update policy
    const { data: newPolicy, error: insertError } = await supabase
      .from('release_gate_policies')
      .upsert({
        project_id: id,
        organization_id: project.organizationId || null,
        name: name || 'Custom Release Gate Policy',
        version: version || '1.1.0',
        is_default: true,
        rules: rules || DEFAULT_CANONICAL_GATE_RULES,
        require_approval_on_review: requireApprovalOnReview ?? true,
        require_approval_on_warn: requireApprovalOnWarn ?? false,
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (insertError) {
      return NextResponse.json({ success: false, error: insertError.message }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      policy: newPolicy,
    });
  } catch (err: any) {
    console.error('[API Release Gates POST Error]:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
