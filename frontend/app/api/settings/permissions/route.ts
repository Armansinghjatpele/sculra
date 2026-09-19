// ==============================================================================
// Sculra Permission Explorer Metadata API Route (GET)
// (frontend/app/api/settings/permissions/route.ts)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthContext,
  requirePermission,
  PERMISSIONS,
  ALL_ROLES,
  ROLE_METADATA,
  PERMISSION_CATEGORIES,
  ROLE_PERMISSIONS,
} from '@/lib/authz';

export async function GET(req: NextRequest) {
  try {
    const authContext = await getAuthContext(req);
    requirePermission(authContext, PERMISSIONS.SETTINGS_READ);

    // Build serialized matrix
    const matrix: Record<string, string[]> = {};
    for (const role of ALL_ROLES) {
      matrix[role] = Array.from(ROLE_PERMISSIONS[role]);
    }

    return NextResponse.json({
      success: true,
      roles: ALL_ROLES,
      roleMetadata: ROLE_METADATA,
      categories: PERMISSION_CATEGORIES,
      matrix,
      callerRole: authContext.role,
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { success: false, error: err.message || 'Failed loading permissions metadata' },
      { status }
    );
  }
}
