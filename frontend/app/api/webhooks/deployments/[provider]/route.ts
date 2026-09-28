// ==============================================================================
// Sculra Multi-Provider Deployment Webhook Ingestion Route
// (frontend/app/api/webhooks/deployments/[provider]/route.ts)
// Supports: Vercel, Railway, Generic CI/CD
//
// Invariants (Prompt 63):
// - Authenticates webhook signature / token
// - Lightweight & asynchronous: never blocks webhook request waiting for QA
// - Zero arbitrary code execution from webhook payloads
// - Deduplicates provider events idempotently
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { DeploymentWebhookIngestionService } from '../../../../../../worker/src/release/webhook-ingestion';
import { CDOrchestrator } from '../../../../../../worker/src/release/cd-orchestrator';

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

    // Ingest and authenticate webhook
    const ingestionResult = await DeploymentWebhookIngestionService.ingest(
      {
        providerName: provider,
        rawBody,
        payload,
        headers,
        projectId: headers['x-sculra-project-id'] || payload.projectId || payload.project_id,
        organizationId: headers['x-sculra-org-id'] || payload.organizationId || payload.orgId,
      },
      supabase
    );

    if (!ingestionResult.accepted) {
      return NextResponse.json(
        { accepted: false, error: ingestionResult.error || 'Webhook rejected.' },
        { status: ingestionResult.statusCode }
      );
    }

    if (ingestionResult.isDuplicate) {
      return NextResponse.json(
        {
          accepted: true,
          status: 'DUPLICATE_ACKNOWLEDGED',
          providerEventId: ingestionResult.event?.providerEventId,
          eventId: ingestionResult.event?.eventId,
        },
        { status: 200 }
      );
    }

    // Asynchronous Execution Handover:
    // Process CD Orchestrator in background without blocking HTTP response
    if (ingestionResult.event) {
      const event = ingestionResult.event;
      // Trigger orchestration asynchronously
      Promise.resolve().then(async () => {
        try {
          await CDOrchestrator.orchestrate({
            event,
            supabaseClient: supabase,
          });
        } catch (bgErr) {
          console.error('[CD Webhook Background Orchestration Error]:', bgErr);
        }
      });
    }

    return NextResponse.json(
      {
        accepted: true,
        status: 'PROCESSING',
        provider: ingestionResult.event?.provider,
        providerEventId: ingestionResult.event?.providerEventId,
        eventId: ingestionResult.event?.eventId,
        deploymentStatus: ingestionResult.event?.deploymentStatus,
      },
      { status: 202 }
    );
  } catch (err: any) {
    console.error('[Deployment Webhook Route Fatal Error]:', err);
    return NextResponse.json(
      { accepted: false, error: err.message || 'Internal webhook ingestion error.' },
      { status: 500 }
    );
  }
}
