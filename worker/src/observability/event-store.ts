// ==============================================================================
// Sculra Append-Only Event Store (worker/src/observability/event-store.ts)
// ==============================================================================

import { AutonomousEvent, TimelineFilter } from './types';
import { ObservabilityRedactor } from './redaction';

export class AutonomousEventStore {
  // In-memory ring buffer for fallback and deterministic local execution
  private static memoryBuffer: AutonomousEvent[] = [];
  private static MAX_MEMORY_EVENTS = 5000;

  /**
   * Appends an event to the immutable store.
   * Modifying existing events is strictly forbidden.
   */
  public static async append(
    event: AutonomousEvent,
    supabaseClient?: any
  ): Promise<AutonomousEvent> {
    const sanitizedEvent: AutonomousEvent = {
      ...event,
      summary: ObservabilityRedactor.maskSecrets(event.summary),
      reason: event.reason ? ObservabilityRedactor.maskSecrets(event.reason) : null,
      metadata: ObservabilityRedactor.boundMetadata(event.metadata),
    };

    // Append to in-memory store
    this.memoryBuffer.unshift(sanitizedEvent);
    if (this.memoryBuffer.length > this.MAX_MEMORY_EVENTS) {
      this.memoryBuffer.pop();
    }

    // Persist to database if Supabase client is available
    if (supabaseClient) {
      try {
        const { error } = await supabaseClient.from('autonomous_events').insert({
          id: sanitizedEvent.id.startsWith('evt-') ? undefined : sanitizedEvent.id,
          organization_id: sanitizedEvent.organizationId,
          project_id: sanitizedEvent.projectId,
          campaign_id: sanitizedEvent.campaignId,
          test_run_id: sanitizedEvent.testRunId,
          issue_id: sanitizedEvent.issueId,
          remediation_id: sanitizedEvent.remediationId,
          actor_type: sanitizedEvent.actorType,
          actor_id: sanitizedEvent.actorId,
          event_type: sanitizedEvent.eventType,
          stage: sanitizedEvent.stage,
          status: sanitizedEvent.status,
          summary: sanitizedEvent.summary,
          reason: sanitizedEvent.reason,
          confidence: sanitizedEvent.confidence,
          source: sanitizedEvent.source,
          fact_category: sanitizedEvent.factCategory,
          evidence_ids: sanitizedEvent.evidenceIds,
          related_entity_ids: sanitizedEvent.relatedEntityIds,
          metadata: sanitizedEvent.metadata,
        });

        if (error) {
          console.warn('[AutonomousEventStore] Database insert error:', error.message);
        }
      } catch (err: any) {
        console.warn('[AutonomousEventStore] Failed to write event to DB:', err.message);
      }
    }

    return sanitizedEvent;
  }

  /**
   * Queries events for a given project with filtering and pagination.
   */
  public static queryProjectEvents(
    projectId: string,
    filter: TimelineFilter = {}
  ): AutonomousEvent[] {
    let matches = this.memoryBuffer.filter((e) => e.projectId === projectId);

    if (filter.actorType) {
      matches = matches.filter((e) => e.actorType === filter.actorType);
    }
    if (filter.factCategory) {
      matches = matches.filter((e) => e.factCategory === filter.factCategory);
    }
    if (filter.eventType) {
      matches = matches.filter((e) => e.eventType === filter.eventType);
    }
    if (filter.stage) {
      matches = matches.filter((e) => e.stage === filter.stage);
    }
    if (filter.source) {
      matches = matches.filter((e) => e.source === filter.source);
    }
    if (filter.since) {
      const sinceTime = new Date(filter.since).getTime();
      matches = matches.filter((e) => new Date(e.createdAt).getTime() >= sinceTime);
    }
    if (filter.until) {
      const untilTime = new Date(filter.until).getTime();
      matches = matches.filter((e) => new Date(e.createdAt).getTime() <= untilTime);
    }

    const offset = filter.offset || 0;
    const limit = filter.limit || 50;

    return matches.slice(offset, offset + limit);
  }

  /**
   * Clears memory buffer (intended for testing isolation only).
   */
  public static clearMemoryForTest(): void {
    this.memoryBuffer = [];
  }
}
