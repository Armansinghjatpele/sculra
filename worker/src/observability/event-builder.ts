// ==============================================================================
// Sculra Strongly Typed Autonomous Event Builder
// (worker/src/observability/event-builder.ts)
// ==============================================================================

import {
  AutonomousEvent,
  AutonomousEventType,
  ActorType,
  EventSource,
  FactCategory,
  ConfidenceLevel,
} from './types';
import { ObservabilityRedactor } from './redaction';
import { OBSERVABILITY_POLICY } from './policy';

export class AutonomousEventBuilder {
  private event: Partial<AutonomousEvent> = {
    evidenceIds: [],
    relatedEntityIds: [],
    metadata: {},
  };

  public static create(eventType: AutonomousEventType): AutonomousEventBuilder {
    const builder = new AutonomousEventBuilder();
    builder.event.eventType = eventType;
    builder.event.createdAt = new Date().toISOString();
    return builder;
  }

  public setProject(projectId: string, organizationId?: string | null): this {
    this.event.projectId = projectId;
    this.event.organizationId = organizationId || null;
    return this;
  }

  public setScope(scope: {
    campaignId?: string | null;
    testRunId?: string | null;
    issueId?: string | null;
    remediationId?: string | null;
  }): this {
    if (scope.campaignId) this.event.campaignId = scope.campaignId;
    if (scope.testRunId) this.event.testRunId = scope.testRunId;
    if (scope.issueId) this.event.issueId = scope.issueId;
    if (scope.remediationId) this.event.remediationId = scope.remediationId;
    return this;
  }

  public setActor(actorType: ActorType, actorId: string): this {
    this.event.actorType = actorType;
    this.event.actorId = actorId;
    return this;
  }

  public setStageAndStatus(stage: string, status: string): this {
    this.event.stage = stage;
    this.event.status = status;
    return this;
  }

  public setSummary(summary: string, reason?: string | null): this {
    this.event.summary = ObservabilityRedactor.maskSecrets(summary).slice(
      0,
      OBSERVABILITY_POLICY.MAX_SUMMARY_LENGTH
    );
    if (reason) {
      this.event.reason = ObservabilityRedactor.maskSecrets(reason).slice(
        0,
        OBSERVABILITY_POLICY.MAX_REASON_LENGTH
      );
    }
    return this;
  }

  public setCategoryAndSource(factCategory: FactCategory, source: EventSource): this {
    this.event.factCategory = factCategory;
    this.event.source = source;
    return this;
  }

  public setConfidence(confidence?: ConfidenceLevel | null): this {
    this.event.confidence = confidence || null;
    return this;
  }

  public addEvidenceIds(ids: string[]): this {
    const combined = [...(this.event.evidenceIds || []), ...ids];
    this.event.evidenceIds = combined.slice(0, OBSERVABILITY_POLICY.MAX_EVIDENCE_IDS);
    return this;
  }

  public addRelatedEntityIds(ids: string[]): this {
    const combined = [...(this.event.relatedEntityIds || []), ...ids];
    this.event.relatedEntityIds = combined.slice(0, OBSERVABILITY_POLICY.MAX_RELATED_ENTITY_IDS);
    return this;
  }

  public setMetadata(metadata: Record<string, any>): this {
    this.event.metadata = ObservabilityRedactor.boundMetadata(metadata);
    return this;
  }

  public build(): AutonomousEvent {
    if (!this.event.projectId) {
      throw new Error('AutonomousEvent must specify a valid projectId.');
    }
    if (!this.event.eventType) {
      throw new Error('AutonomousEvent must specify an eventType.');
    }
    if (!this.event.actorType || !this.event.actorId) {
      throw new Error('AutonomousEvent must specify actorType and actorId.');
    }
    if (!this.event.stage || !this.event.status) {
      throw new Error('AutonomousEvent must specify stage and status.');
    }
    if (!this.event.summary) {
      throw new Error('AutonomousEvent must specify a summary.');
    }
    if (!this.event.factCategory) {
      throw new Error('AutonomousEvent must specify a factCategory.');
    }
    if (!this.event.source) {
      throw new Error('AutonomousEvent must specify an event source.');
    }

    return {
      id: this.event.id || `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      organizationId: this.event.organizationId || null,
      projectId: this.event.projectId,
      campaignId: this.event.campaignId || null,
      testRunId: this.event.testRunId || null,
      issueId: this.event.issueId || null,
      remediationId: this.event.remediationId || null,
      actorType: this.event.actorType,
      actorId: this.event.actorId,
      eventType: this.event.eventType,
      stage: this.event.stage,
      status: this.event.status,
      summary: this.event.summary,
      reason: this.event.reason || null,
      confidence: this.event.confidence || null,
      source: this.event.source,
      factCategory: this.event.factCategory,
      evidenceIds: this.event.evidenceIds || [],
      relatedEntityIds: this.event.relatedEntityIds || [],
      metadata: this.event.metadata || {},
      createdAt: this.event.createdAt || new Date().toISOString(),
    };
  }
}
