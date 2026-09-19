// ==============================================================================
// Sculra Project Source Preflight Validation API (POST)
// (frontend/app/api/projects/[id]/sources/[sourceId]/validate/route.ts)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { requireProjectPermission, PERMISSIONS } from '@/lib/authz';
import { getProjectSource, validateProjectSource } from '@/services/db';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; sourceId: string }> }
) {
  try {
    const { id, sourceId } = await params;
    const { authContext } = await requireProjectPermission(req, id, PERMISSIONS.SOURCES_VALIDATE);

    const source = await getProjectSource(authContext.clerkToken, sourceId);
    if (!source || source.projectId !== id) {
      return NextResponse.json(
        { success: false, error: 'Source not found in project.' },
        { status: 404 }
      );
    }

    const result = await validateProjectSource(
      authContext.clerkToken,
      source.type,
      source.locator,
      source.configuration
    );

    return NextResponse.json({
      success: true,
      sourceId,
      validation: result,
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { success: false, error: err.message || 'Failed validating source.', code: err.code },
      { status }
    );
  }
}
