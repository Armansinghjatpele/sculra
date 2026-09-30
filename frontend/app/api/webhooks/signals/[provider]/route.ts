// ==============================================================================
// Sculra Production Signal Webhook Ingestion API Route
// (frontend/app/api/webhooks/signals/[provider]/route.ts)
//
// Invariants (Prompt 64):
// - Authenticates webhook signature / token with constant-time verification
// - Production webhook secret is MANDATORY in production
// - Persists production_signals synchronously
// - Replay protection & deduplication via Postgres unique index
// - Synchronous correlation and QA memory recording
// - Zero in-memory fire-and-forget Promise execution
// - Returns 202 Accepted immediately without blocking on campaign execution
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { ProductionSignalWebhookIngestionService } from '../../../../../../worker/src/signals/webhook-ingestion';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider } = await params;
    const rawBody = await req.text();

    if (!rawBody || rawBody.trim().length === 0) {
      return NextResponse.json(
        { accepted: false, error: 'Empty webhook payload body.' },
        { status: 400 }
      );
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { accepted: false, error: 'Invalid JSON payload structure.' },
        { status: 400 }
      );
    }

    // Convert headers to record
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    const supabase = getSupabaseServiceClient();

    // Look up webhook secret from environment or project configuration
    const candidateProjectId =
      headers['x-sculra-project-id'] || payload.projectId || payload.project_id;
    let webhookSecret =
      process.env[`${provider.toUpperCase()}_WEBHOOK_SECRET`] ||
      process.env.SIGNAL_WEBHOOK_SECRET ||
      process.env.DEPLOYMENT_WEBHOOK_SECRET;

    if (supabase && candidateProjectId && !webhookSecret) {
      try {
        const { data: proj } = await supabase
          .from('projects')
          .select('webhook_secret')
          .eq('id', candidateProjectId)
          .maybeSingle();

        if (proj?.webhook_secret) {
          webhookSecret = proj.webhook_secret;
        }
      } catch {
        // Fallback
      }
    }

    const result = await ProductionSignalWebhookIngestionService.ingest(
      {
        providerName: provider,
        rawBody,
        payload,
        headers,
        webhookSecret,
        projectId: candidateProjectId,
        organizationId: headers['x-sculra-org-id'] || payload.organizationId || payload.orgId,
      },
      supabase
    );

    if (!result.accepted) {
      return NextResponse.json(
        { accepted: false, error: result.error || 'Signal webhook rejected.' },
        { status: result.statusCode }
      );
    }

    if (result.isDuplicate) {
      return NextResponse.json(
        {
          accepted: true,
          status: 'DUPLICATE_UPDATED',
          signalsCount: result.signalsCount,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        accepted: true,
        status: result.status || 'INGESTED',
        signalsCount: result.signalsCount,
        signals: (result.signals || []).map((s) => ({
          id: s.id,
          title: s.title,
          signalType: s.signalType,
          severity: s.severity,
          fingerprint: s.fingerprint,
        })),
        correlations: result.correlations,
      },
      { status: 202 }
    );
  } catch (err: any) {
    console.error('[Signal Webhook Route Error]:', err);
    return NextResponse.json(
      { accepted: false, error: err.message || 'Internal webhook ingestion error.' },
      { status: 500 }
    );
  }
}
