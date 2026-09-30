// ==============================================================================
// Sculra Production Signal Webhook Ingestion Service
// (worker/src/signals/webhook-ingestion.ts)
//
// Invariants (Prompt 64):
// - Timing-safe HMAC signature verification
// - Mandatory secret in production
// - Replay protection & deduplication
// - Synchronous persistence of signals and correlations
// - Zero in-memory fire-and-forget promises
// - Returns 202 Accepted immediately with status details
// ==============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ProductionSignal,
  ProductionSignalProvider,
  SignalCorrelation,
} from './types';
import { SignalProviderAdapter } from './adapters/adapter';
import { SentrySignalAdapter } from './adapters/sentry';
import { GenericSignalAdapter } from './adapters/generic';
import { PostHogSignalAdapter } from './adapters/posthog';
import { SignalNormalizer } from './normalizer';
import { DeploymentCandidate, DeploymentCorrelationEngine } from './correlation-engine';
import { PostReleaseOrchestrator } from './post-release-orchestrator';
import { QAFeedbackEngine } from './qa-feedback-engine';

export interface SignalWebhookRequest {
  providerName: string;
  rawBody: string;
  payload: any;
  headers: Record<string, string>;
  webhookSecret?: string;
  projectId?: string;
  organizationId?: string;
}

export interface SignalWebhookResult {
  accepted: boolean;
  statusCode: number;
  status?: string;
  isDuplicate?: boolean;
  error?: string;
  signalsCount?: number;
  signals?: ProductionSignal[];
  correlations?: SignalCorrelation[];
}

export class ProductionSignalWebhookIngestionService {
  private static adapters: Record<string, SignalProviderAdapter> = {
    sentry: new SentrySignalAdapter(),
    generic: new GenericSignalAdapter(),
    posthog: new PostHogSignalAdapter(),
  };

  public static getAdapter(name: string): SignalProviderAdapter | null {
    const key = (name || '').trim().toLowerCase();
    return this.adapters[key] || null;
  }

  /**
   * Securely ingests, authenticates, normalizes, deduplicates, and correlates incoming signals.
   */
  public static async ingest(
    request: SignalWebhookRequest,
    supabase?: SupabaseClient | null
  ): Promise<SignalWebhookResult> {
    const { providerName, rawBody, payload, headers, webhookSecret, projectId, organizationId } = request;

    // 1. Validate Provider
    const adapter = this.getAdapter(providerName);
    if (!adapter) {
      return {
        accepted: false,
        statusCode: 400,
        error: `Unsupported production signal provider: '${providerName}'. Supported: sentry, generic.`,
      };
    }

    // 2. Validate Payload Structure & Size
    if (!payload || typeof payload !== 'object') {
      return {
        accepted: false,
        statusCode: 400,
        error: 'Invalid webhook payload structure: expected JSON object.',
      };
    }

    if (rawBody && rawBody.length > 2 * 1024 * 1024) {
      return {
        accepted: false,
        statusCode: 413,
        error: 'Payload size exceeds maximum allowed limit (2MB).',
      };
    }

    // 3. Verify Signature
    const sigCheck = adapter.verifySignature(rawBody, headers, webhookSecret);
    if (!sigCheck.valid) {
      return {
        accepted: false,
        statusCode: 401,
        error: sigCheck.reason || 'Webhook signature validation failed.',
      };
    }

    // 4. Parse Payload
    const targetProjectId = projectId || headers['x-sculra-project-id'] || payload.projectId || payload.project_id;
    if (!targetProjectId) {
      return {
        accepted: false,
        statusCode: 400,
        error: 'Missing project identification (x-sculra-project-id or payload.projectId required).',
      };
    }

    const targetOrgId = organizationId || headers['x-sculra-org-id'] || payload.organizationId || null;

    const parseResult = adapter.parsePayload(payload, headers, targetProjectId, targetOrgId);
    if (!parseResult.supported) {
      return {
        accepted: false,
        statusCode: 400,
        error: parseResult.error || 'Provider payload parsing is not supported.',
      };
    }

    if (parseResult.signals.length === 0) {
      return {
        accepted: true,
        statusCode: 200,
        status: 'IGNORED_NO_SIGNALS',
        signalsCount: 0,
      };
    }

    // 5. Normalize Signals
    const normalizedSignals: ProductionSignal[] = [];
    for (const rawSig of parseResult.signals) {
      try {
        const norm = SignalNormalizer.normalize(rawSig);
        normalizedSignals.push(norm);
      } catch (err: any) {
        return {
          accepted: false,
          statusCode: 422,
          error: `Signal validation failed: ${err.message}`,
        };
      }
    }

    // 6. Deduplication & Persistence
    const insertedSignals: ProductionSignal[] = [];
    const correlations: SignalCorrelation[] = [];

    // Query candidate deployments for correlation if Supabase available
    let candidateDeployments: DeploymentCandidate[] = [];
    if (supabase) {
      try {
        const { data: deps } = await supabase
          .from('deployments')
          .select('id, project_id, organization_id, environment_id, commit_sha, branch, deployment_url, status, created_at, started_at, completed_at')
          .eq('project_id', targetProjectId)
          .order('created_at', { ascending: false })
          .limit(20);

        if (deps && deps.length > 0) {
          candidateDeployments = deps.map((d: any) => ({
            id: d.id,
            projectId: d.project_id,
            organizationId: d.organization_id,
            environmentId: d.environment_id,
            commitSha: d.commit_sha,
            branch: d.branch,
            deploymentUrl: d.deployment_url,
            status: d.status,
            deployedAt: d.completed_at || d.started_at || d.created_at,
            createdAt: d.created_at,
          }));
        }
      } catch {
        // Fallback: candidateDeployments remains empty
      }
    }

    for (const signal of normalizedSignals) {
      // Check deduplication
      if (supabase && signal.providerSignalId) {
        const { data: existing } = await supabase
          .from('production_signals')
          .select('id, occurrence_count')
          .eq('provider', signal.provider)
          .eq('provider_signal_id', signal.providerSignalId)
          .maybeSingle();

        if (existing) {
          // Increment occurrence count idempotently
          await supabase
            .from('production_signals')
            .update({
              occurrence_count: (existing.occurrence_count || 1) + 1,
              last_observed_at: signal.lastObservedAt,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);

          return {
            accepted: true,
            statusCode: 200,
            isDuplicate: true,
            status: 'DUPLICATE_UPDATED',
            signalsCount: 1,
          };
        }
      }

      // Persist signal
      if (supabase) {
        await supabase.from('production_signals').insert({
          id: signal.id,
          organization_id: signal.organizationId,
          project_id: signal.projectId,
          environment_id: signal.environmentId,
          deployment_id: signal.deploymentId,
          release_id: signal.releaseId,
          provider: signal.provider,
          provider_signal_id: signal.providerSignalId,
          signal_type: signal.signalType,
          severity: signal.severity,
          status: signal.status,
          title: signal.title,
          description: signal.description,
          fingerprint: signal.fingerprint,
          first_observed_at: signal.firstObservedAt,
          last_observed_at: signal.lastObservedAt,
          affected_url: signal.affectedUrl,
          affected_route: signal.affectedRoute,
          affected_service: signal.affectedService,
          affected_version: signal.affectedVersion,
          affected_commit: signal.affectedCommit,
          affected_branch: signal.affectedBranch,
          occurrence_count: signal.occurrenceCount,
          raw_reference: signal.rawReference,
          confidence: signal.confidence,
          created_at: signal.createdAt,
          updated_at: signal.updatedAt,
        });
      }

      insertedSignals.push(signal);

      // Perform Correlation
      const correlation = DeploymentCorrelationEngine.correlate(signal, candidateDeployments);
      correlations.push(correlation);

      if (supabase) {
        await supabase.from('signal_correlations').insert({
          id: correlation.id,
          signal_id: correlation.signalId,
          project_id: correlation.projectId,
          organization_id: correlation.organizationId,
          deployment_id: correlation.deploymentId,
          release_id: correlation.releaseId,
          correlation_state: correlation.correlationState,
          confidence: correlation.confidence,
          reasons: correlation.reasons,
          evidence_details: correlation.evidenceDetails,
          evaluated_at: correlation.evaluatedAt,
        });

        // Store QA Feedback Memory Record
        if (correlation.deploymentId) {
          const memoryRecord = QAFeedbackEngine.buildRecord({
            projectId: signal.projectId,
            organizationId: signal.organizationId,
            entityType: 'DEPLOYMENT_PRODUCTION_SIGNAL',
            entityId: correlation.deploymentId,
            relationshipType: correlation.correlationState === 'EXACT_MATCH'
              ? 'CONFIRMED_REGRESSION'
              : 'CORRELATED_SIGNAL',
            signalId: signal.id,
            deploymentId: correlation.deploymentId,
            correlationState: correlation.correlationState,
            evidenceSummary: {
              signalType: signal.signalType,
              severity: signal.severity,
              fingerprint: signal.fingerprint,
              reasons: correlation.reasons,
            },
            confidence: correlation.confidence,
          });
          await QAFeedbackEngine.persistRecord(memoryRecord, supabase);
        }
      }
    }

    return {
      accepted: true,
      statusCode: 202,
      status: 'INGESTED',
      signalsCount: insertedSignals.length,
      signals: insertedSignals,
      correlations,
    };
  }
}
