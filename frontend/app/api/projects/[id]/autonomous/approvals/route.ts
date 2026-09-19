// ==============================================================================
// Sculra Project Human Approvals API (GET, POST)
// (frontend/app/api/projects/[id]/autonomous/approvals/route.ts)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getProject, getProjectHumanApprovals } from '@/services/db';
import { getSupabaseUserClient } from '@/lib/supabase';
import { mockApprovals } from '@/lib/demoData';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, getToken } = await auth();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Sign in required.' },
        { status: 401 }
      );
    }

    const token = await getToken();
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Session token expired or missing.' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const project = await getProject(token, id);
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'Project not found or access denied.' },
        { status: 404 }
      );
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || undefined;

    const approvals = await getProjectHumanApprovals(token, id, status);

    return NextResponse.json({
      success: true,
      projectId: id,
      count: approvals.length,
      approvals,
    });
  } catch (err: any) {
    console.error('[API Project Human Approvals GET Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed fetching human approvals.' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId, getToken } = await auth();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized. Sign in required.' },
        { status: 401 }
      );
    }

    const token = await getToken();
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Session token expired or missing.' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await req.json();

    const {
      remediationId,
      sourceSha,
      fixPlanVersion = 1,
      issueId,
      issueTitle,
      diffSummary,
      patchUnified,
      verificationPassed = true,
      securityChecksPassed = true,
    } = body;

    if (!remediationId || !sourceSha) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: remediationId, sourceSha' },
        { status: 400 }
      );
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(); // 24h limit

    const supabase = getSupabaseUserClient(token);
    const { data, error } = await supabase
      .from('human_approvals')
      .insert({
        project_id: id,
        remediation_id: remediationId,
        source_sha: sourceSha,
        fix_plan_version: fixPlanVersion,
        status: 'PENDING',
        requested_by: userId,
        requested_at: now.toISOString(),
        expires_at: expiresAt,
        issue_id: issueId,
        issue_title: issueTitle,
        diff_summary: diffSummary,
        patch_unified: patchUnified,
        verification_passed: verificationPassed,
        security_checks_passed: securityChecksPassed,
      })
      .select()
      .maybeSingle();

    if (error || !data) {
      // Demo fallback
      const newMockApproval = {
        id: `appr-${Date.now()}`,
        projectId: id,
        remediationId,
        sourceSha,
        fixPlanVersion,
        status: 'PENDING' as const,
        requestedBy: userId,
        requestedAt: now.toISOString(),
        expiresAt,
        issueId,
        issueTitle,
        diffSummary,
        patchUnified,
        verificationPassed,
        securityChecksPassed,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
      mockApprovals.unshift(newMockApproval);

      return NextResponse.json({
        success: true,
        approval: newMockApproval,
      });
    }

    return NextResponse.json({
      success: true,
      approval: data,
    });
  } catch (err: any) {
    console.error('[API Project Human Approvals POST Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed creating human approval request.' },
      { status: 500 }
    );
  }
}
