// ==============================================================================
// Sculra Notification Incident Model & Lifecycle Engine
// (worker/src/notifications/incident.ts)
// ==============================================================================

import {
  NotificationIncident,
  NotificationIncidentEvent,
  IncidentStatus,
  IncidentRelationship,
  NotificationEvent,
  NotificationUrgency,
} from './types';
import { NOTIFICATION_LIMITS } from './policy';

export class IncidentManager {
  /**
   * Initializes a new incident from a trigger notification event.
   */
  public static createIncident(event: NotificationEvent): NotificationIncident {
    const now = new Date().toISOString();
    return {
      id: `inc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      organizationId: event.organizationId || null,
      projectId: event.projectId || 'proj-unknown',
      status: 'OPEN',
      severity: event.severity,
      title: `Incident: ${event.title}`,
      summary: `Automated incident tracking initiated following ${event.eventType}. ${event.summary}`,
      fingerprint: event.fingerprint,
      primaryEntityType: event.entityType,
      primaryEntityId: event.entityId,
      startedAt: event.occurredAt || now,
      lastUpdatedAt: now,
      metadata: {
        initialEventId: event.id,
        initialEventType: event.eventType,
        ...event.metadata,
      },
      createdAt: now,
    };
  }

  /**
   * Attaches a correlated event to the incident timeline with strict bounds.
   */
  public static attachEvent(
    incident: NotificationIncident,
    event: NotificationEvent,
    relationship: IncidentRelationship = 'CORRELATED',
    existingEvents: NotificationIncidentEvent[] = []
  ): { incident: NotificationIncident; event: NotificationIncidentEvent } | null {
    if (existingEvents.length >= NOTIFICATION_LIMITS.MAX_INCIDENT_EVENTS) {
      return null; // Bounded incident timeline ceiling reached
    }

    const now = new Date().toISOString();

    const incidentEvent: NotificationIncidentEvent = {
      id: `inc-evt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      incidentId: incident.id,
      eventId: event.id,
      eventType: event.eventType,
      relationship,
      entityType: event.entityType,
      entityId: event.entityId,
      occurredAt: event.occurredAt || now,
      summary: event.summary,
      metadata: event.metadata || {},
      createdAt: now,
    };

    // Update incident lastUpdatedAt and upgrade severity if correlated event is more severe
    const updatedIncident: NotificationIncident = {
      ...incident,
      lastUpdatedAt: now,
      severity: this.resolveHigherSeverity(incident.severity, event.severity),
    };

    return { incident: updatedIncident, event: incidentEvent };
  }

  /**
   * Transitions an incident to ACKNOWLEDGED state.
   */
  public static acknowledge(
    incident: NotificationIncident,
    acknowledgedBy: string
  ): NotificationIncident {
    return {
      ...incident,
      status: 'ACKNOWLEDGED',
      acknowledgedAt: new Date().toISOString(),
      acknowledgedBy,
      lastUpdatedAt: new Date().toISOString(),
    };
  }

  /**
   * Transitions an incident to RESOLVED state upon issue recovery or manual resolution.
   */
  public static resolve(
    incident: NotificationIncident,
    resolvedBy: string,
    notes?: string
  ): NotificationIncident {
    const now = new Date().toISOString();
    return {
      ...incident,
      status: 'RESOLVED',
      resolvedAt: now,
      resolvedBy,
      resolutionNotes: notes || 'Resolved following system recovery verification.',
      lastUpdatedAt: now,
    };
  }

  private static resolveHigherSeverity(
    current: NotificationUrgency,
    incoming: NotificationUrgency
  ): NotificationUrgency {
    const ranks: Record<NotificationUrgency, number> = {
      INFO: 1,
      LOW: 2,
      MEDIUM: 3,
      HIGH: 4,
      CRITICAL: 5,
    };
    return ranks[incoming] > ranks[current] ? incoming : current;
  }
}
