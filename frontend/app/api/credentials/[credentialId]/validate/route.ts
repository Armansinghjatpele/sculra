// ==============================================================================
// Sculra Credential Validation API (POST)
// (frontend/app/api/credentials/[credentialId]/validate/route.ts)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, PolicyManager } from '@/lib/authz';
import { validateCredentialRecord } from '@/services/db';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ credentialId: string }> }
) {
  try {
    const { credentialId } = await params;
    const authContext = await getAuthContext(req);

    // QA_LEAD, ADMIN, OWNER can trigger validation
    PolicyManager.evaluateCredentialMutation({
      callerRole: authContext.role,
      action: 'VALIDATE',
    });

    const body = await req.json().catch(() => ({}));
    const result = await validateCredentialRecord(authContext.clerkToken, credentialId, body);

    return NextResponse.json({
      success: true,
      credentialId,
      result,
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { success: false, error: err.message || 'Credential validation failed.' },
      { status }
    );
  }
}
