// ==============================================================================
// Sculra Credential Encryption Key Rotation API (POST)
// (frontend/app/api/credentials/[credentialId]/rotate/route.ts)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, PolicyManager } from '@/lib/authz';
import { rotateCredentialRecordKey } from '@/services/db';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ credentialId: string }> }
) {
  try {
    const { credentialId } = await params;
    const authContext = await getAuthContext(req);

    // ADMIN or OWNER only
    PolicyManager.evaluateCredentialMutation({
      callerRole: authContext.role,
      action: 'ROTATE',
    });

    const body = await req.json().catch(() => ({}));
    const targetKeyVersion = body.targetKeyVersion || 'v1';

    const rotation = await rotateCredentialRecordKey(
      authContext.clerkToken,
      credentialId,
      targetKeyVersion,
      authContext.role
    );

    return NextResponse.json({
      success: true,
      credentialId,
      rotation,
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { success: false, error: err.message || 'Key rotation failed.' },
      { status }
    );
  }
}
