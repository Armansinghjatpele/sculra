// ==============================================================================
// Sculra Multi-Provider Deployment Webhook Ingestion Route
// (frontend/app/api/webhooks/deployments/[provider]/route.ts)
// Supports: Vercel, Railway, Generic CI/CD
//
// Invariants (Prompt 63 & Prompt 63A):
// - Authenticates webhook signature / token with constant-time verification
// - Production webhook secret is MANDATORY in production environments
// - Persists deployment_events synchronously with processing_status = 'RECEIVED'
// - Atomically enqueues durable QA job into public.qa_campaigns (status: 'QUEUED')
// - Zero in-memory fire-and-forget Promise execution (production serverless safe)
// - Returns 202 Accepted immediately without waiting for QA execution
// - Deduplicates provider events idempotently via Postgres unique constraint
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import { DeploymentWebhookIngestionService } from '../../../../../../worker/src/release/webhook-ingestion';

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
    const candidateProjectId = headers['x-sculra-project-id'] || payload.projectId || payload.project_id;
    let webhookSecret =
      process.env[`${provider.toUpperCase()}_WEBHOOK_SECRET`] ||
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
        // Fallback below
      }
    }

    // Ingest, authenticate, deduplicate, and enqueue durable QA campaign job
    const ingestionResult = await DeploymentWebhookIngestionService.ingest(
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
          provider: ingestionResult.event?.provider,
          providerEventId: ingestionResult.event?.providerEventId,
          eventId: ingestionResult.eventId || ingestionResult.event?.eventId,
          campaignId: ingestionResult.campaignId || ingestionResult.event?.campaignId,
        },
        { status: 200 }
      );
    }

    // Durable queue job was inserted into qa_campaigns with status: 'QUEUED'.
    // Zero fire-and-forget in-memory promises remain.
    return NextResponse.json(
      {
        accepted: true,
        status: ingestionResult.status || 'QUEUED',
        provider: ingestionResult.event?.provider,
        providerEventId: ingestionResult.event?.providerEventId,
        eventId: ingestionResult.eventId || ingestionResult.event?.eventId,
        campaignId: ingestionResult.campaignId,
        idempotencyKey: ingestionResult.idempotencyKey,
        deploymentStatus: ingestionResult.event?.deploymentStatus,
      },
      { status: ingestionResult.statusCode || 202 }
    );
  } catch (err: any) {
    console.error('[Deployment Webhook Route Fatal Error]:', err);
    return NextResponse.json(
      { accepted: false, error: err.message || 'Internal webhook ingestion error.' },
      { status: 500 }
    );
  }
}
