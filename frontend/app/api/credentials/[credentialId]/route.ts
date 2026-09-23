// ==============================================================================
// Sculra Single Credential API (GET / PATCH / DELETE)
// (frontend/app/api/credentials/[credentialId]/route.ts)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, PERMISSIONS, PolicyManager } from '@/lib/authz';
import {
  getCredentialRecord,
  updateCredentialRecord,
  deleteCredentialRecord,
} from '@/services/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ credentialId: string }> }
) {
  try {
    const { credentialId } = await params;
    const authContext = await getAuthContext(req);

    if (!authContext.permissions.has(PERMISSIONS.CREDENTIALS_READ)) {
      return NextResponse.json(
        { success: false, error: 'Permission denied to view credentials.' },
        { status: 403 }
      );
    }

    const credential = await getCredentialRecord(authContext.clerkToken, credentialId);
    if (!credential) {
      return NextResponse.json(
        { success: false, error: 'Credential not found.' },
        { status: 404 }
      );
    }

    // Tenant check
    if (credential.organizationId && authContext.orgId && credential.organizationId !== authContext.orgId) {
      return NextResponse.json(
        { success: false, error: 'Access denied: credential belongs to a different organization.' },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, credential });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { success: false, error: err.message || 'Failed fetching credential.' },
      { status }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ credentialId: string }> }
) {
  try {
    const { credentialId } = await params;
    const authContext = await getAuthContext(req);

    PolicyManager.evaluateCredentialMutation({
      callerRole: authContext.role,
      action: 'UPDATE',
    });

    const body = await req.json();
    const updated = await updateCredentialRecord(authContext.clerkToken, credentialId, {
      displayName: body.displayName,
      scope: body.scope,
      status: body.status,
      expiresAt: body.expiresAt,
    });

    return NextResponse.json({ success: true, credential: updated });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { success: false, error: err.message || 'Failed updating credential.' },
      { status }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ credentialId: string }> }
) {
  try {
    const { credentialId } = await params;
    const authContext = await getAuthContext(req);

    PolicyManager.evaluateCredentialMutation({
      callerRole: authContext.role,
      action: 'DELETE',
    });

    await deleteCredentialRecord(authContext.clerkToken, credentialId);

    return NextResponse.json({
      success: true,
      message: 'Credential permanently deleted from vault.',
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { success: false, error: err.message || 'Failed deleting credential.' },
      { status }
    );
  }
}
