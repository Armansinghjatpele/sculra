// ==============================================================================
// Sculra Credential Revocation API (POST)
// (frontend/app/api/credentials/[credentialId]/revoke/route.ts)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, PolicyManager } from '@/lib/authz';
import { revokeCredentialRecord } from '@/services/db';

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
      action: 'UPDATE',
    });

    const revoked = await revokeCredentialRecord(authContext.clerkToken, credentialId);

    return NextResponse.json({
      success: true,
      credential: revoked,
      message: 'Credential revoked immediately.',
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { success: false, error: err.message || 'Revocation failed.' },
      { status }
    );
  }
}
