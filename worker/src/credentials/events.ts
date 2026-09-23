// ==============================================================================
// Sculra Credential Vault Observability Events (worker/src/credentials/events.ts)
// ==============================================================================
// Invariants:
// - Never includes plaintext, ciphertext, auth headers, API keys, or passwords.
// - Metadata is strictly sanitized with CredentialRedactor.

import { AutonomousEvent, AutonomousEventType } from '../observability/types';
import { CredentialRedactor } from './redactor';

export class CredentialEventEmitter {
  private static eventSink: ((event: AutonomousEvent) => void) | null = null;

  public static setEventSink(sink: (event: AutonomousEvent) => void): void {
    this.eventSink = sink;
  }

  public static emit(params: {
    eventType: AutonomousEventType;
    credentialId: string;
    organizationId?: string | null;
    projectId?: string | null;
    provider: string;
    scope?: string;
    actor: string;
    purpose?: string;
    result?: 'SUCCESS' | 'DENIED' | 'FAILED';
    durationMs?: number;
    errorCode?: string;
    details?: Record<string, any>;
  }): AutonomousEvent {
    // Strictly sanitize all details
    const sanitizedDetails = CredentialRedactor.deepSanitize(params.details || {});

    const event: AutonomousEvent = {
      id: `evt-cred-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      organizationId: params.organizationId || null,
      projectId: params.projectId || 'vault',
      campaignId: null,
      testRunId: null,
      actorType: 'VAULT',
      actorId: params.actor,
      eventType: params.eventType,
      stage: 'VAULT',
      status: params.result || 'SUCCESS',
      summary: `Credential ${params.credentialId} [${params.provider}]: ${params.eventType}`,
      source: 'VAULT',
      factCategory: 'ACTION',
      confidence: 'HIGH',
      evidenceIds: [],
      relatedEntityIds: [params.credentialId],
      metadata: {
        credentialId: params.credentialId,
        provider: params.provider,
        scope: params.scope,
        actor: params.actor,
        purpose: params.purpose,
        result: params.result,
        durationMs: params.durationMs,
        errorCode: params.errorCode,
        ...sanitizedDetails,
      },
      createdAt: new Date().toISOString(),
    };

    if (this.eventSink) {
      try {
        this.eventSink(event);
      } catch {
        // Observability sink errors must not break security operations
      }
    }

    return event;
  }
}
