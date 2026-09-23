// ==============================================================================
// Sculra Notification Incident Correlation Engine
// (worker/src/notifications/incident-correlator.ts)
// ==============================================================================

import {
  NotificationEvent,
  NotificationIncident,
  IncidentRelationship,
} from './types';

export interface CorrelationResult {
  action: 'CREATE_INCIDENT' | 'CORRELATE_TO_EXISTING' | 'RESOLVE_INCIDENT' | 'NONE';
  incident?: NotificationIncident;
  relationship?: IncidentRelationship;
  reason?: string;
}

export class IncidentCorrelator {
  private static CORRELATION_WINDOW_MS = 60 * 60 * 1000; // 1 hour active correlation window

  /**
   * Evaluates whether an incoming event should create a new incident,
   * correlate with an existing open incident, or resolve an incident.
   */
  public static evaluate(
    event: NotificationEvent,
    activeIncidents: NotificationIncident[] = []
  ): CorrelationResult {
    // 1. Check for Resolution Events
    if (
      event.eventType === 'ISSUE_RESOLVED' ||
      event.eventType === 'ENVIRONMENT_RECOVERED' ||
      event.eventType === 'SOURCE_RECOVERED' ||
      event.eventType === 'REGRESSION_RECOVERED'
    ) {
      const match = activeIncidents.find(
        (inc) =>
          inc.projectId === event.projectId &&
          inc.status !== 'RESOLVED' &&
          (inc.primaryEntityId === event.entityId ||
            inc.fingerprint === event.fingerprint ||
            inc.primaryEntityType === event.entityType ||
            event.entityType === 'PROJECT')
      );

      if (match) {
        return {
          action: 'RESOLVE_INCIDENT',
          incident: match,
          reason: `Resolution event ${event.eventType} matched active incident ${match.id}`,
        };
      }
    }

    // 2. Filter active incidents in the same project and within correlation window
    const now = new Date(event.occurredAt).getTime();
    const projectIncidents = activeIncidents.filter(
      (inc) =>
        inc.projectId === event.projectId &&
        inc.status !== 'RESOLVED' &&
        now - new Date(inc.lastUpdatedAt).getTime() <= this.CORRELATION_WINDOW_MS
    );

    // 3. Exact Entity / Fingerprint Match or same failure type -> Correlate
    const exactMatch = projectIncidents.find(
      (inc) =>
        inc.fingerprint === event.fingerprint ||
        inc.primaryEntityType === event.entityType ||
        inc.primaryEntityId === event.entityId
    );

    if (exactMatch) {
      return {
        action: 'CORRELATE_TO_EXISTING',
        incident: exactMatch,
        relationship: 'CORRELATED',
        reason: 'Matched exact entity or issue fingerprint in active incident.',
      };
    }

    // 4. Deployment / Release Temporal Correlation
    // If a deployment or release occurred recently in the project, correlate as POSSIBLY_RELATED
    const recentDeploymentIncident = projectIncidents.find(
      (inc) =>
        inc.primaryEntityType === 'DEPLOYMENT' ||
        inc.primaryEntityType === 'RELEASE' ||
        inc.metadata?.deploymentId ||
        inc.metadata?.releaseId
    );

    if (recentDeploymentIncident) {
      return {
        action: 'CORRELATE_TO_EXISTING',
        incident: recentDeploymentIncident,
        relationship: 'POSSIBLY_RELATED',
        reason: 'Occurred in proximity to active deployment/release window.',
      };
    }

    // 5. High / Critical Failure Events Trigger New Incident
    if (
      event.severity === 'CRITICAL' ||
      event.severity === 'HIGH' ||
      event.eventType === 'SECURITY_BLOCKER_CREATED' ||
      event.eventType === 'RELEASE_BLOCKED' ||
      event.eventType === 'ENVIRONMENT_UNREACHABLE' ||
      event.eventType === 'CI_GATE_FAILED'
    ) {
      return {
        action: 'CREATE_INCIDENT',
        reason: `New high/critical event ${event.eventType} warrants incident creation.`,
      };
    }

    return {
      action: 'NONE',
      reason: 'Low-priority event does not meet incident threshold.',
    };
  }
}
