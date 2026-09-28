// ==============================================================================
// Sculra Deployment Webhook Ingestion Engine (worker/src/release/webhook-ingestion.ts)
// Ingestion, Authentication, Deduplication, and Normalization of External Deployment Webhooks
// ==============================================================================

import { SupabaseClient } from '@supabase/supabase-js';
import {
  DeploymentEvent,
  DeploymentSnapshot,
  DeploymentLifecycleStatus,
} from './types';
import {
  VercelDeploymentProvider,
  RailwayDeploymentProvider,
  GenericDeploymentProvider,
  DeploymentProvider,
  verifyVercelSignature,
  verifyRailwaySignature,
  verifyGenericSignature,
} from './deployment-provider';
import { buildDeploymentSnapshot } from './deployment-snapshot';
import { redactSensitiveData } from '../change-intelligence/redaction';

export interface WebhookIngestionRequest {
  providerName: string;
  rawBody: string;
  payload: any;
  headers: Record<string, string>;
  webhookSecret?: string;
  projectId?: string;
  organizationId?: string;
}

export interface WebhookIngestionResult {
  accepted: boolean;
  statusCode: number;
  reason?: string;
  error?: string;
  isDuplicate?: boolean;
  event?: DeploymentEvent;
  snapshot?: DeploymentSnapshot;
}

export class DeploymentWebhookIngestionService {
  private static providers: Record<string, DeploymentProvider> = {
    vercel: new VercelDeploymentProvider(),
    railway: new RailwayDeploymentProvider(),
    generic: new GenericDeploymentProvider(),
    ci: new GenericDeploymentProvider(),
  };

  /**
   * Retrieves provider instance by name.
   */
  public static getProvider(providerName: string): DeploymentProvider | null {
    const key = (providerName || '').trim().toLowerCase();
    return this.providers[key] || null;
  }

  /**
   * Validates webhook signature according to provider requirements.
   */
  public static validateSignature(
    providerName: string,
    rawBody: string,
    headers: Record<string, string>,
    secret?: string
  ): { valid: boolean; reason?: string } {
    if (!secret) {
      // If secret not configured on project, cannot securely authenticate
      return { valid: false, reason: 'Webhook secret not configured for target project.' };
    }

    const key = (providerName || '').trim().toLowerCase();
    const lcHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) {
      lcHeaders[k.toLowerCase()] = v;
    }

    if (key === 'vercel') {
      const sig = lcHeaders['x-vercel-signature'];
      if (!sig) return { valid: false, reason: 'Missing x-vercel-signature header.' };
      const valid = verifyVercelSignature(rawBody, sig, secret);
      return { valid, reason: valid ? undefined : 'Vercel HMAC signature mismatch.' };
    }

    if (key === 'railway') {
      const sig = lcHeaders['x-railway-signature'] || lcHeaders['x-webhook-signature'];
      if (!sig) return { valid: false, reason: 'Missing x-railway-signature header.' };
      const valid = verifyRailwaySignature(rawBody, sig, secret);
      return { valid, reason: valid ? undefined : 'Railway signature mismatch.' };
    }

    // Generic / CI
    const sig =
      lcHeaders['x-sculra-signature'] ||
      lcHeaders['x-hub-signature-256'] ||
      lcHeaders['authorization'];
    if (!sig) {
      return { valid: false, reason: 'Missing signature or Authorization header.' };
    }
    const valid = verifyGenericSignature(rawBody, sig, secret);
    return { valid, reason: valid ? undefined : 'Webhook authentication failed.' };
  }

  /**
   * Ingests, authenticates, validates, and normalizes an incoming deployment webhook.
   * Safe against arbitrary code execution, malformed payloads, and duplicate deliveries.
   */
  public static async ingest(
    request: WebhookIngestionRequest,
    supabase?: SupabaseClient | null
  ): Promise<WebhookIngestionResult> {
    const { providerName, rawBody, payload, headers, webhookSecret, projectId, organizationId } = request;

    // 1. Validate Provider
    const provider = this.getProvider(providerName);
    if (!provider) {
      return {
        accepted: false,
        statusCode: 400,
        error: `Unsupported deployment provider: '${providerName}'. Supported: vercel, railway, generic.`,
      };
    }

    // 2. Validate Payload Structure
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return {
        accepted: false,
        statusCode: 400,
        error: 'Invalid webhook payload structure: expected non-array JSON object.',
      };
    }

    // 3. Signature Validation (if secret provided or required)
    if (webhookSecret) {
      const sigResult = this.validateSignature(providerName, rawBody, headers, webhookSecret);
      if (!sigResult.valid) {
        return {
          accepted: false,
          statusCode: 401,
          error: sigResult.reason || 'Invalid webhook signature.',
        };
      }
    }

    // 4. Normalize Deployment Event
    let event: DeploymentEvent;
    try {
      event = provider.normalizeEvent(payload, headers);
      if (projectId && !event.projectId) {
        event.projectId = projectId;
      }
      if (organizationId && !event.orgId) {
        event.orgId = organizationId;
      }
    } catch (err: any) {
      return {
        accepted: false,
        statusCode: 400,
        error: `Failed to normalize deployment event: ${err.message}`,
      };
    }

    // 5. Idempotent Deduplication Check
    if (supabase && event.providerEventId) {
      try {
        const { data: existing } = await supabase
          .from('deployment_events')
          .select('id, deployment_status, deployment_id')
          .eq('provider', event.provider)
          .eq('provider_event_id', event.providerEventId)
          .maybeSingle();

        if (existing) {
          return {
            accepted: true,
            statusCode: 200,
            isDuplicate: true,
            reason: 'DUPLICATE_EVENT_ACKNOWLEDGED',
            event,
          };
        }
      } catch (err) {
        // Table might not exist yet during initial migrations or local testing
      }
    }

    // 6. Build Deployment Snapshot (if valid projectId exists)
    let snapshot: DeploymentSnapshot | undefined;
    if (event.projectId) {
      try {
        snapshot = provider.normalizeWebhook(payload, headers);
        snapshot.projectId = event.projectId;
        if (event.orgId) snapshot.organizationId = event.orgId;
      } catch {
        // Incomplete metadata snapshot skipped
      }
    }

    // 7. Persist deployment_events record if client provided
    if (supabase && event.projectId) {
      try {
        await supabase.from('deployment_events').insert({
          id: event.eventId,
          project_id: event.projectId,
          organization_id: event.orgId || null,
          provider: event.provider,
          provider_event_id: event.providerEventId,
          deployment_id: event.deploymentId,
          environment_id: event.environmentId,
          environment_name: event.environmentName,
          environment_type: event.environmentType,
          deployment_status: event.deploymentStatus,
          commit_sha: event.commitSha,
          branch: event.branch,
          repository: event.repository,
          deployment_url: event.deploymentUrl,
          release_id: event.releaseId,
          occurred_at: event.occurredAt,
          received_at: event.receivedAt,
          source: event.source,
          confidence: event.confidence,
          raw_metadata: event.rawMetadataReference || {},
        });
      } catch (err) {
        // Ignore db insert error if table not yet migrated
      }
    }

    return {
      accepted: true,
      statusCode: 202,
      isDuplicate: false,
      event,
      snapshot,
    };
  }
}
