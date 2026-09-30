// ==============================================================================
// Sculra QA Feedback Memory Engine (worker/src/signals/qa-feedback-engine.ts)
//
// Invariants (Prompt 64):
// - Records strictly factual relationships
// - No unsupported causal statements stored as facts
// - Captures evidence references, timestamps, correlation state, and confidence
// ==============================================================================

import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { CorrelationState, QAFeedbackMemoryRecord } from './types';

export interface CreateMemoryRecordInput {
  projectId: string;
  organizationId?: string | null;
  entityType:
    | 'DEPLOYMENT_TEST_FAILURE'
    | 'DEPLOYMENT_PRODUCTION_SIGNAL'
    | 'ISSUE_PRODUCTION_SIGNAL'
    | 'ISSUE_REGRESSION'
    | 'ISSUE_RECOVERY'
    | 'WORKFLOW_PRODUCTION_FAILURE'
    | 'ROUTE_PRODUCTION_FAILURE'
    | 'API_PRODUCTION_FAILURE';
  entityId: string;
  relationshipType:
    | 'CORRELATED_SIGNAL'
    | 'CONFIRMED_REGRESSION'
    | 'TEMPORAL_INCIDENT'
    | 'VERIFIED_RECOVERY'
    | 'RECURRING_FAILURE';
  signalId?: string | null;
  deploymentId?: string | null;
  correlationState?: CorrelationState;
  evidenceSummary: Record<string, any>;
  confidence?: number;
}

export class QAFeedbackEngine {
  /**
   * Constructs a factual memory record.
   */
  public static buildRecord(input: CreateMemoryRecordInput): QAFeedbackMemoryRecord {
    if (!input.projectId) {
      throw new Error('QAFeedbackEngine: projectId is required.');
    }
    if (!input.entityType || !input.entityId) {
      throw new Error('QAFeedbackEngine: entityType and entityId are required.');
    }

    const confidence = typeof input.confidence === 'number'
      ? Math.max(0, Math.min(1, input.confidence))
      : 1.0;

    return {
      id: crypto.randomUUID(),
      projectId: input.projectId,
      organizationId: input.organizationId || null,
      entityType: input.entityType,
      entityId: input.entityId,
      relationshipType: input.relationshipType,
      signalId: input.signalId || null,
      deploymentId: input.deploymentId || null,
      evidenceSummary: {
        ...input.evidenceSummary,
        correlationState: input.correlationState || 'INSUFFICIENT_EVIDENCE',
        recordedAt: new Date().toISOString(),
      },
      confidence,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Persists a factual feedback memory record into Supabase.
   */
  public static async persistRecord(
    record: QAFeedbackMemoryRecord,
    supabase?: SupabaseClient | null
  ): Promise<boolean> {
    if (!supabase) return false;
    try {
      const { error } = await supabase.from('qa_feedback_memory').insert({
        id: record.id,
        project_id: record.projectId,
        organization_id: record.organizationId,
        entity_type: record.entityType,
        entity_id: record.entityId,
        relationship_type: record.relationshipType,
        signal_id: record.signalId,
        deployment_id: record.deploymentId,
        evidence_summary: record.evidenceSummary,
        confidence: record.confidence,
        created_at: record.createdAt,
      });

      if (error) {
        console.error('[QAFeedbackEngine] Failed to persist memory record:', error);
        return false;
      }
      return true;
    } catch (err) {
      console.error('[QAFeedbackEngine] Persistence error:', err);
      return false;
    }
  }

  /**
   * Queries historical feedback memory for an entity (e.g. route, workflow, deployment).
   */
  public static async getEntityMemory(
    projectId: string,
    entityType: string,
    entityId: string,
    supabase?: SupabaseClient | null
  ): Promise<QAFeedbackMemoryRecord[]> {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase
        .from('qa_feedback_memory')
        .select('*')
        .eq('project_id', projectId)
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false });

      if (error || !data) return [];
      return data.map((row) => ({
        id: row.id,
        projectId: row.project_id,
        organizationId: row.organization_id,
        entityType: row.entity_type,
        entityId: row.entity_id,
        relationshipType: row.relationship_type,
        signalId: row.signal_id,
        deploymentId: row.deployment_id,
        evidenceSummary: row.evidence_summary || {},
        confidence: Number(row.confidence) || 1.0,
        createdAt: row.created_at,
      }));
    } catch {
      return [];
    }
  }
}
