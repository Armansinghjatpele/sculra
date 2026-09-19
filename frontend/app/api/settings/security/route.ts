// ==============================================================================
// Sculra Admin Security Dashboard Overview API Route (GET)
// (frontend/app/api/settings/security/route.ts)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthContext,
  requirePermission,
  PERMISSIONS,
  ROLE_METADATA,
} from '@/lib/authz';
import { getOrganizationMembers, getProjectHumanApprovals } from '@/services/db';

export async function GET(req: NextRequest) {
  try {
    const authContext = await getAuthContext(req);
    requirePermission(authContext, PERMISSIONS.SETTINGS_READ);

    const members = await getOrganizationMembers(authContext.clerkToken, authContext.orgId);
    const pendingApprovals = await getProjectHumanApprovals(authContext.clerkToken, 'proj-1', 'PENDING');

    return NextResponse.json({
      success: true,
      orgId: authContext.orgId,
      caller: {
        userId: authContext.userId,
        role: authContext.role,
        roleTitle: ROLE_METADATA[authContext.role].title,
        status: authContext.membershipStatus,
        permissionsCount: authContext.permissions.size,
      },
      membersSummary: {
        total: members.length,
        active: members.filter((m) => m.status === 'ACTIVE').length,
        invited: members.filter((m) => m.status === 'INVITED').length,
        ownersCount: members.filter((m) => m.role === 'OWNER' && m.status === 'ACTIVE').length,
      },
      sensitivePolicies: {
        fixAgentApprovalRequired: true,
        fixAgentAllowedBranches: ['main', 'master', 'develop'],
        ssrfHopLimit: 5,
        ssrfMaxResponseBytes: 1048576,
        ownerSafetyEnforced: true,
      },
      activeIntegrations: [
        { name: 'Clerk Authentication & Organizations', status: 'CONNECTED', type: 'IDENTITY' },
        { name: 'Supabase PostgreSQL & RLS', status: 'CONNECTED', type: 'DATABASE' },
        { name: 'GitHub OAuth & Webhooks', status: 'CONNECTED', type: 'VCS' },
      ],
      pendingApprovalsCount: pendingApprovals.length,
      // Factual data only: no fake security scores or fake compliance percentages
      complianceScore: null,
      securityRiskPercentage: null,
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { success: false, error: err.message || 'Failed loading security settings' },
      { status }
    );
  }
}
