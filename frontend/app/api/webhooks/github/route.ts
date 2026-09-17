// ==============================================================================
// Sculra GitHub Webhook Ingestion Route (frontend/app/api/webhooks/github/route.ts)
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase';
import {
  verifyGitHubSignature,
  validatePayloadSize,
  extractDeliveryId,
  extractEventType,
  MAX_WEBHOOK_PAYLOAD_BYTES,
} from '../../../../../worker/src/cicd/webhooks';
import { parseGitHubWebhook } from '../../../../../worker/src/cicd/github';
import { findProjectForRepository } from '../../../../../worker/src/cicd/mapping';
import { scheduleCICDCampaign } from '../../../../../worker/src/cicd/trigger';

export async function POST(req: NextRequest) {
  try {
    // 1. Enforce payload size limit (max 1MB)
    const contentLength = req.headers.get('content-length')
      ? parseInt(req.headers.get('content-length')!, 10)
      : undefined;

    try {
      validatePayloadSize(contentLength, MAX_WEBHOOK_PAYLOAD_BYTES);
    } catch {
      return NextResponse.json(
        { accepted: false, error: 'Payload size exceeded 1MB ceiling.' },
        { status: 413 }
      );
    }

    const rawBody = await req.text();
    if (rawBody.length > MAX_WEBHOOK_PAYLOAD_BYTES) {
      return NextResponse.json(
        { accepted: false, error: 'Payload size exceeded 1MB ceiling.' },
        { status: 413 }
      );
    }

    // 2. Extract GitHub headers
    const deliveryId = extractDeliveryId(req.headers);
    const eventType = extractEventType(req.headers);
    const signatureHeader = req.headers.get('x-hub-signature-256');

    if (!deliveryId || !eventType) {
      return NextResponse.json(
        { accepted: false, error: 'Missing required GitHub headers (x-github-delivery, x-github-event).' },
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

    const supabase = getSupabaseServiceClient();

    // 3. Delivery Idempotency Check
    const { data: existingEvent } = await supabase
      .from('cicd_webhook_events')
      .select('id, status, campaign_id')
      .eq('delivery_id', deliveryId)
      .maybeSingle();

    if (existingEvent) {
      return NextResponse.json(
        {
          accepted: false,
          status: 'already_processed',
          deliveryId,
          campaignId: existingEvent.campaign_id,
        },
        { status: 200 }
      );
    }

    // Ping event early return
    if (eventType === 'ping') {
      return NextResponse.json({ message: 'pong', deliveryId }, { status: 200 });
    }

    // 4. Resolve Target Project
    const repoRaw = payload.repository || {};
    const repoOwner = typeof repoRaw.owner === 'object' ? (repoRaw.owner.login || repoRaw.owner.name || '') : (repoRaw.owner || '');
    const repoName = repoRaw.name || '';
    const repoFullName = repoRaw.full_name || (repoOwner && repoName ? `${repoOwner}/${repoName}` : '');

    const project = await findProjectForRepository(supabase, repoOwner, repoName, repoRaw.clone_url);

    if (!project) {
      return NextResponse.json(
        {
          accepted: false,
          status: 'ignored',
          reason: 'NO_MATCHING_PROJECT',
          repository: repoFullName,
        },
        { status: 200 }
      );
    }

    // 5. Signature Verification with Constant-Time Equality
    const configuredSecret = project.ciWebhookSecret || process.env.GITHUB_WEBHOOK_SECRET;
    if (!configuredSecret) {
      console.warn(`[CI/CD Webhook Warning]: No webhook secret configured for project ${project.projectId}`);
      return NextResponse.json(
        { accepted: false, error: 'Server misconfiguration: Webhook secret not set for project.' },
        { status: 500 }
      );
    }

    const isValidSignature = verifyGitHubSignature(rawBody, signatureHeader, configuredSecret);
    if (!isValidSignature) {
      return NextResponse.json(
        { accepted: false, error: 'HMAC SHA-256 signature verification failed.' },
        { status: 401 }
      );
    }

    // 6. Check Project CI Status
    if (!project.ciEnabled) {
      await supabase.from('cicd_webhook_events').insert({
        delivery_id: deliveryId,
        provider: 'github',
        event_type: eventType,
        project_id: project.projectId,
        organization_id: project.organizationId || null,
        repository: repoFullName,
        status: 'IGNORED',
        error_code: 'CI_DISABLED',
        metadata: { reason: 'CI disabled in project settings' },
        received_at: new Date().toISOString(),
      });

      return NextResponse.json(
        { accepted: false, status: 'ignored', reason: 'CI_DISABLED' },
        { status: 200 }
      );
    }

    // 7. Filter Event Types & Actions
    if (eventType === 'push') {
      if (!project.ciTriggerOnPush) {
        return NextResponse.json(
          { accepted: false, status: 'ignored', reason: 'PUSH_TRIGGERS_DISABLED' },
          { status: 200 }
        );
      }
      if (payload.deleted === true || payload.after === '0000000000000000000000000000000000000000') {
        return NextResponse.json(
          { accepted: false, status: 'ignored', reason: 'BRANCH_DELETION' },
          { status: 200 }
        );
      }
    } else if (eventType === 'pull_request') {
      if (!project.ciTriggerOnPr) {
        return NextResponse.json(
          { accepted: false, status: 'ignored', reason: 'PR_TRIGGERS_DISABLED' },
          { status: 200 }
        );
      }
      const allowedActions = ['opened', 'synchronize', 'reopened'];
      if (!allowedActions.includes(payload.action)) {
        return NextResponse.json(
          { accepted: false, status: 'ignored', reason: `UNHANDLED_PR_ACTION_${payload.action}` },
          { status: 200 }
        );
      }
    } else {
      return NextResponse.json(
        { accepted: false, status: 'ignored', reason: `UNSUPPORTED_EVENT_TYPE_${eventType}` },
        { status: 200 }
      );
    }

    // 8. Normalize Event
    const normalizedEvent = parseGitHubWebhook(deliveryId, eventType, payload);

    // 9. Persist Webhook Event in RECEIVED / PROCESSING state
    const commitSha = normalizedEvent.commit?.sha || normalizedEvent.pullRequest?.headSha;
    const prNumber = normalizedEvent.pullRequest?.number;

    const { data: eventRow, error: eventInsertError } = await supabase
      .from('cicd_webhook_events')
      .insert({
        delivery_id: deliveryId,
        provider: 'github',
        event_type: eventType,
        project_id: project.projectId,
        organization_id: project.organizationId || null,
        repository: repoFullName,
        commit_sha: commitSha || null,
        pull_request_number: prNumber || null,
        status: 'PROCESSING',
        received_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (eventInsertError) {
      console.error('[CI/CD Webhook]: Failed persisting event record:', eventInsertError.message);
    }

    // 10. Automatically Schedule QA Campaign into Distributed Queue (status = 'QUEUED')
    const { campaignId } = await scheduleCICDCampaign(supabase, project, normalizedEvent);

    // 11. Update Webhook Event to SCHEDULED with Campaign ID
    await supabase
      .from('cicd_webhook_events')
      .update({
        status: 'SCHEDULED',
        campaign_id: campaignId,
        processed_at: new Date().toISOString(),
      })
      .eq('delivery_id', deliveryId);

    return NextResponse.json(
      {
        accepted: true,
        status: 'scheduled',
        deliveryId,
        campaignId,
        projectId: project.projectId,
        branch: normalizedEvent.commit?.branch || normalizedEvent.pullRequest?.headBranch,
      },
      { status: 202 }
    );
  } catch (err: any) {
    console.error('[GitHub Webhook Route Fatal Error]:', err);
    return NextResponse.json(
      { accepted: false, error: err.message || 'Internal webhook ingestion error' },
      { status: 500 }
    );
  }
}
