// ==============================================================================
// Sculra Notification Observability & Delivery Health Telemetry
// (worker/src/notifications/telemetry.ts)
// ==============================================================================

import { AutonomousEventBuilder } from '../observability/event-builder';
import { AutonomousEventStore } from '../observability/event-store';
import {
  NotificationEvent,
  NotificationDelivery,
  NotificationIncident,
  NotificationSuppression,
} from './types';

export interface DeliveryHealthSummary {
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'INSUFFICIENT_DATA';
  configuredChannels: string[];
  totalDeliveries: number;
  successfulCount: number;
  failedCount: number;
  retryingCount: number;
  suppressedCount: number;
  successRate: number | null; // null if insufficient data
}

export class NotificationTelemetry {
  /**
   * Emits NOTIFICATION_CREATED autonomous event.
   */
  public static emitNotificationCreated(event: NotificationEvent): void {
    try {
      const builder = AutonomousEventBuilder.create('NOTIFICATION_CREATED')
        .setProject(event.projectId || 'proj-global', event.organizationId)
        .setActor('NOTIFICATION_ENGINE', 'notification-dispatcher')
        .setCategoryAndSource('OBSERVED_FACT', 'NOTIFICATION')
        .setSummary(
          `Notification created for ${event.eventType} on ${event.entityType} ${event.entityId}.`
        )
        .setMetadata({
          notificationEventId: event.id,
          eventType: event.eventType,
          severity: event.severity,
          fingerprint: event.fingerprint,
        });

      AutonomousEventStore.append(builder.build());
    } catch {
      // Non-blocking telemetry
    }
  }

  /**
   * Emits NOTIFICATION_SUPPRESSED autonomous event.
   */
  public static emitNotificationSuppressed(suppression: NotificationSuppression): void {
    try {
      const builder = AutonomousEventBuilder.create('NOTIFICATION_SUPPRESSED')
        .setProject(suppression.projectId || 'proj-global', suppression.organizationId)
        .setActor('NOTIFICATION_ENGINE', 'notification-throttler')
        .setCategoryAndSource('ACTION_RESULT', 'NOTIFICATION')
        .setSummary(
          `Notification suppressed: ${suppression.reason} for event ${suppression.eventType}.`
        )
        .setMetadata({
          reason: suppression.reason,
          eventType: suppression.eventType,
          fingerprint: suppression.eventFingerprint,
          ...suppression.details,
        });

      AutonomousEventStore.append(builder.build());
    } catch {
      // Non-blocking telemetry
    }
  }

  /**
   * Emits NOTIFICATION_DELIVERY_STARTED autonomous event.
   */
  public static emitDeliveryStarted(delivery: NotificationDelivery): void {
    try {
      const builder = AutonomousEventBuilder.create('NOTIFICATION_DELIVERY_STARTED')
        .setProject(delivery.projectId || 'proj-global', delivery.organizationId)
        .setActor('NOTIFICATION_ENGINE', `${delivery.channel.toLowerCase()}-provider`)
        .setCategoryAndSource('ACTION', 'NOTIFICATION')
        .setSummary(
          `Dispatching ${delivery.channel} notification delivery ${delivery.id}.`
        )
        .setMetadata({
          deliveryId: delivery.id,
          eventId: delivery.eventId,
          channel: delivery.channel,
          attemptsCount: delivery.attemptsCount,
        });

      AutonomousEventStore.append(builder.build());
    } catch {
      // Non-blocking telemetry
    }
  }

  /**
   * Emits NOTIFICATION_DELIVERY_SUCCEEDED autonomous event.
   */
  public static emitDeliverySucceeded(
    delivery: NotificationDelivery,
    providerMessageId?: string
  ): void {
    try {
      const builder = AutonomousEventBuilder.create('NOTIFICATION_DELIVERY_SUCCEEDED')
        .setProject(delivery.projectId || 'proj-global', delivery.organizationId)
        .setActor('NOTIFICATION_ENGINE', `${delivery.channel.toLowerCase()}-provider`)
        .setCategoryAndSource('ACTION_RESULT', 'NOTIFICATION')
        .setSummary(
          `Successfully delivered ${delivery.channel} notification ${delivery.id}.`
        )
        .setMetadata({
          deliveryId: delivery.id,
          channel: delivery.channel,
          providerMessageId,
        });

      AutonomousEventStore.append(builder.build());
    } catch {
      // Non-blocking telemetry
    }
  }

  /**
   * Emits NOTIFICATION_DELIVERY_FAILED autonomous event.
   */
  public static emitDeliveryFailed(
    delivery: NotificationDelivery,
    errorCode?: string
  ): void {
    try {
      const builder = AutonomousEventBuilder.create('NOTIFICATION_DELIVERY_FAILED')
        .setProject(delivery.projectId || 'proj-global', delivery.organizationId)
        .setActor('NOTIFICATION_ENGINE', `${delivery.channel.toLowerCase()}-provider`)
        .setCategoryAndSource('ACTION_RESULT', 'NOTIFICATION')
        .setSummary(
          `Failed delivering ${delivery.channel} notification ${delivery.id}: ${errorCode || 'UNKNOWN_ERROR'}.`
        )
        .setMetadata({
          deliveryId: delivery.id,
          channel: delivery.channel,
          errorCode,
        });

      AutonomousEventStore.append(builder.build());
    } catch {
      // Non-blocking telemetry
    }
  }

  /**
   * Emits INCIDENT_CREATED autonomous event.
   */
  public static emitIncidentCreated(incident: NotificationIncident): void {
    try {
      const builder = AutonomousEventBuilder.create('INCIDENT_CREATED')
        .setProject(incident.projectId, incident.organizationId)
        .setActor('NOTIFICATION_ENGINE', 'incident-correlator')
        .setCategoryAndSource('OBSERVED_FACT', 'NOTIFICATION')
        .setSummary(
          `Incident ${incident.id} opened: ${incident.title} (Severity: ${incident.severity}).`
        )
        .setMetadata({
          incidentId: incident.id,
          severity: incident.severity,
          primaryEntityType: incident.primaryEntityType,
          primaryEntityId: incident.primaryEntityId,
        });

      AutonomousEventStore.append(builder.build());
    } catch {
      // Non-blocking telemetry
    }
  }

  /**
   * Emits INCIDENT_RESOLVED autonomous event.
   */
  public static emitIncidentResolved(incident: NotificationIncident): void {
    try {
      const builder = AutonomousEventBuilder.create('INCIDENT_RESOLVED')
        .setProject(incident.projectId, incident.organizationId)
        .setActor('NOTIFICATION_ENGINE', 'incident-correlator')
        .setCategoryAndSource('ACTION_RESULT', 'NOTIFICATION')
        .setSummary(
          `Incident ${incident.id} resolved by ${incident.resolvedBy || 'system'}.`
        )
        .setMetadata({
          incidentId: incident.id,
          resolvedAt: incident.resolvedAt,
          notes: incident.resolutionNotes,
        });

      AutonomousEventStore.append(builder.build());
    } catch {
      // Non-blocking telemetry
    }
  }

  /**
   * Computes truthful delivery health without demo data or fabricated metrics.
   */
  public static computeDeliveryHealth(params: {
    configuredChannels: string[];
    deliveries: NotificationDelivery[];
    suppressionsCount?: number;
  }): DeliveryHealthSummary {
    const { configuredChannels, deliveries, suppressionsCount = 0 } = params;

    if (deliveries.length === 0) {
      return {
        status: 'INSUFFICIENT_DATA',
        configuredChannels,
        totalDeliveries: 0,
        successfulCount: 0,
        failedCount: 0,
        retryingCount: 0,
        suppressedCount: suppressionsCount,
        successRate: null,
      };
    }

    let successfulCount = 0;
    let failedCount = 0;
    let retryingCount = 0;
    let suppressedCountTotal = suppressionsCount;

    for (const d of deliveries) {
      if (d.status === 'DELIVERED' || d.status === 'SENT') {
        successfulCount++;
      } else if (d.status === 'FAILED') {
        failedCount++;
      } else if (d.status === 'RETRYING') {
        retryingCount++;
      } else if (d.status === 'SUPPRESSED') {
        suppressedCountTotal++;
      }
    }

    const nonSuppressedDeliveries = successfulCount + failedCount + retryingCount;
    const successRate =
      nonSuppressedDeliveries > 0
        ? Math.round((successfulCount / nonSuppressedDeliveries) * 100)
        : null;

    let status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'INSUFFICIENT_DATA' = 'HEALTHY';
    if (successRate !== null) {
      if (successRate < 70) {
        status = 'UNHEALTHY';
      } else if (successRate < 95) {
        status = 'DEGRADED';
      }
    }

    return {
      status,
      configuredChannels,
      totalDeliveries: deliveries.length,
      successfulCount,
      failedCount,
      retryingCount,
      suppressedCount: suppressedCountTotal,
      successRate,
    };
  }
}
