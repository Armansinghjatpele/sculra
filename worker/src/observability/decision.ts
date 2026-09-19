// ==============================================================================
// Sculra Autonomous Decision Recorder (worker/src/observability/decision.ts)
// ==============================================================================

import {
  DecisionRecord,
  DecisionType,
  ActorType,
  EventSource,
  ConfidenceLevel,
  SkipReason,
} from './types';
import { ObservabilityRedactor } from './redaction';

export class DecisionManager {
  private static decisionsMemory: DecisionRecord[] = [];

  public static async recordDecision(
    params: {
      projectId: string;
      organizationId?: string | null;
      campaignId?: string | null;
      testRunId?: string | null;
      entityType: string;
      entityId: string;
      decisionType: DecisionType;
      actorType: ActorType;
      actorId: string;
      decision: string;
      reason: string;
      skipReason?: SkipReason | null;
      evidenceIds?: string[];
      policyChecks?: Array<{ policy: string; passed: boolean; message?: string }>;
      confidence?: ConfidenceLevel;
      source?: EventSource;
      result?: string | null;
      nextAction?: string | null;
      metadata?: Record<string, any>;
    },
    supabaseClient?: any
  ): Promise<DecisionRecord> {
    if (!params.reason || params.reason.trim().length === 0) {
      throw new Error('DecisionRecord must provide a non-empty explanation of why.');
    }

    const record: DecisionRecord = {
      id: `dec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      organizationId: params.organizationId || null,
      projectId: params.projectId,
      campaignId: params.campaignId || null,
      testRunId: params.testRunId || null,
      entityType: params.entityType,
      entityId: params.entityId,
      decisionType: params.decisionType,
      actorType: params.actorType,
      actorId: params.actorId,
      decision: ObservabilityRedactor.maskSecrets(params.decision),
      reason: ObservabilityRedactor.maskSecrets(params.reason),
      skipReason: params.skipReason || null,
      evidenceIds: params.evidenceIds || [],
      policyChecks: params.policyChecks || [],
      confidence: params.confidence || 'HIGH',
      source: params.source || 'DETERMINISTIC',
      result: params.result || null,
      nextAction: params.nextAction || null,
      metadata: ObservabilityRedactor.boundMetadata(params.metadata || {}),
      createdAt: new Date().toISOString(),
    };

    this.decisionsMemory.unshift(record);
    if (this.decisionsMemory.length > 2000) {
      this.decisionsMemory.pop();
    }

    if (supabaseClient) {
      try {
        await supabaseClient.from('autonomous_decisions').insert({
          organization_id: record.organizationId,
          project_id: record.projectId,
          campaign_id: record.campaignId,
          test_run_id: record.testRunId,
          entity_type: record.entityType,
          entity_id: record.entityId,
          decision_type: record.decisionType,
          actor_type: record.actorType,
          actor_id: record.actorId,
          decision: record.decision,
          reason: record.reason,
          skip_reason: record.skipReason,
          evidence_ids: record.evidenceIds,
          policy_checks: record.policyChecks,
          confidence: record.confidence,
          source: record.source,
          result: record.result,
          next_action: record.nextAction,
          metadata: record.metadata,
        });
      } catch (err: any) {
        console.warn('[DecisionManager] Failed persisting decision to database:', err.message);
      }
    }

    return record;
  }

  public static queryDecisions(
    projectId: string,
    filter: {
      campaignId?: string;
      decisionType?: DecisionType;
      entityId?: string;
      limit?: number;
    } = {}
  ): DecisionRecord[] {
    let matches = this.decisionsMemory.filter((d) => d.projectId === projectId);

    if (filter.campaignId) {
      matches = matches.filter((d) => d.campaignId === filter.campaignId);
    }
    if (filter.decisionType) {
      matches = matches.filter((d) => d.decisionType === filter.decisionType);
    }
    if (filter.entityId) {
      matches = matches.filter((d) => d.entityId === filter.entityId);
    }

    return matches.slice(0, filter.limit || 50);
  }

  public static clearMemoryForTest(): void {
    this.decisionsMemory = [];
  }
}
