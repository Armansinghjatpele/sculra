// ==============================================================================
// Sculra Credentials API (GET / POST)
// (frontend/app/api/credentials/route.ts)
// ==============================================================================
// Invariants:
// - Plaintext secrets are write-only.
// - Plaintext secrets are NEVER returned in GET or POST responses.
// - Enforces organization multi-tenant isolation and role-based policies.

import { NextRequest, NextResponse } from 'next/server';
import { getAuthContext, PERMISSIONS, PolicyManager } from '@/lib/authz';
import {
  getCredentialRecords,
  createCredentialRecord,
} from '@/services/db';

export async function GET(req: NextRequest) {
  try {
    const authContext = await getAuthContext(req);

    if (!authContext.permissions.has(PERMISSIONS.CREDENTIALS_READ)) {
      return NextResponse.json(
        { success: false, error: 'Permission denied to view credentials.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const orgId = searchParams.get('orgId') || authContext.orgId || undefined;
    const projectId = searchParams.get('projectId') || undefined;

    const credentials = await getCredentialRecords(authContext.clerkToken, orgId, projectId);

    return NextResponse.json({
      success: true,
      credentials,
      count: credentials.length,
    });
  } catch (err: any) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { success: false, error: err.message || 'Failed fetching credentials.' },
      { status }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const authContext = await getAuthContext(req);

    // Evaluate mutation role requirements (OWNER or ADMIN only)
    PolicyManager.evaluateCredentialMutation({
      callerRole: authContext.role,
      action: 'CREATE',
    });

    const body = await req.json();
    const {
      provider,
      credentialType,
      displayName,
      secret,
      scope,
      expiresAt,
      projectId,
      organizationId,
      metadata,
    } = body;

    if (!provider || !credentialType || !displayName || !secret) {
      return NextResponse.json(
        { success: false, error: 'provider, credentialType, displayName, and secret are required.' },
        { status: 400 }
      );
    }

    // Secret is encrypted server-side immediately
    const created = await createCredentialRecord(authContext.clerkToken, {
      organizationId: organizationId || authContext.orgId || null,
      projectId: projectId || null,
      provider,
      credentialType,
      displayName,
      secret,
      scope: scope || 'READ_ONLY',
      expiresAt: expiresAt || null,
      metadata: metadata || {},
    });

    // Notice: plaintext secret is omitted from the response
    return NextResponse.json(
      {
        success: true,
        credential: created,
        message: 'Credential saved securely. The secret will not be displayed again.',
      },
      { status: 201 }
    );
  } catch (err: any) {
    const status = err.statusCode || 500;
    return NextResponse.json(
      { success: false, error: err.message || 'Failed storing credential.' },
      { status }
    );
  }
}
