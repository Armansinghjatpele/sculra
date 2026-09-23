// ==============================================================================
// Sculra Enterprise Notification & Alerting Dispatcher Engine
// (worker/src/notifications/engine.ts)
// ==============================================================================

import crypto from 'crypto';
import { SupabaseClient } from '@supabase/supabase-js';
import {
  NotificationEvent,
  NotificationEventType,
  NotificationRecipient,
  NotificationPreference,
  NotificationSubscription,
  NotificationDelivery,
  NotificationDeliveryAttempt,
  NotificationIncident,
  NotificationIncidentEvent,
  NotificationSuppression,
  WebhookEndpointConfig,
  EmailDeliveryConfig,
} from './types';
import { NotificationEventNormalizer } from './event-normalizer';
import { NotificationDeduplicator } from './dedupe';
import { NotificationThrottler } from './throttle';
import { RecipientResolver } from './recipient-resolver';
import { NotificationTemplater } from './template';
import { InAppChannelProvider } from './channels/in-app-channel';
import { EmailChannelProvider } from './channels/email-channel';
import { WebhookChannelProvider } from './channels/webhook-channel';
import { NotificationRetryEngine } from './retry';
import { IncidentCorrelator } from './incident-correlator';
import { IncidentManager } from './incident';
import { NotificationTelemetry } from './telemetry';
import { NOTIFICATION_LIMITS } from './policy';

export interface DispatchOptions {
  candidates?: NotificationRecipient[];
  preferences?: NotificationPreference[];
  subscriptions?: NotificationSubscription[];
  webhookEndpoints?: WebhookEndpointConfig[];
  emailConfig?: EmailDeliveryConfig;
  allowLocalhost?: boolean;
}

export interface DispatchResult {
  success: boolean;
  event: NotificationEvent;
  deliveredCount: number;
  suppressed: boolean;
  suppressionReason?: string;
  deliveries: NotificationDelivery[];
  incident?: NotificationIncident;
  error?: string;
}

export class NotificationEngine {
  private inAppProvider: InAppChannelProvider;
  private emailProvider: EmailChannelProvider;
  private activeIncidents: NotificationIncident[] = [];
  private incidentEvents: Map<string, NotificationIncidentEvent[]> = new Map();
  private deliveriesHistory: NotificationDelivery[] = [];
  private suppressionsHistory: NotificationSuppression[] = [];
  private supabase?: SupabaseClient;

  constructor(supabaseClient?: SupabaseClient, emailConfig?: EmailDeliveryConfig) {
    this.supabase = supabaseClient;
    this.inAppProvider = new InAppChannelProvider(supabaseClient);
    this.emailProvider = new EmailChannelProvider(emailConfig);
  }

  /**
   * Main dispatch pipeline.
   * GUARANTEES secondary infrastructure isolation: Never throws or breaks core QA caller.
   */
  public async dispatch(
    rawInput: {
      eventType: NotificationEventType;
      entityType: string;
      entityId: string;
      title: string;
      summary: string;
      organizationId?: string | null;
      projectId?: string | null;
      severity?: any;
      deepLink?: string;
      metadata?: Record<string, any>;
    },
    options: DispatchOptions = {}
  ): Promise<DispatchResult> {
    try {
      // 1. Normalize Event
      const event = NotificationEventNormalizer.normalize(rawInput);
      const now = Date.now();

      // 2. Bounded Deduplication Check
      const dedupeCheck = NotificationDeduplicator.isDuplicate(event, now);
      if (dedupeCheck.isDuplicate) {
        const suppression: NotificationSuppression = {
          id: `supp-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
          organizationId: event.organizationId,
          projectId: event.projectId,
          reason: 'DEDUPLICATED',
          eventType: event.eventType,
          eventFingerprint: event.fingerprint,
          details: { dedupeKey: dedupeCheck.dedupeKey },
          suppressedAt: new Date(now).toISOString(),
        };
        this.suppressionsHistory.push(suppression);
        NotificationTelemetry.emitNotificationSuppressed(suppression);

        return {
          success: true,
          event,
          deliveredCount: 0,
          suppressed: true,
          suppressionReason: 'DEDUPLICATED',
          deliveries: [],
        };
      }

      // 3. Bounded Rate Throttling Check
      const throttleCheck = NotificationThrottler.checkThrottle({
        projectId: event.projectId,
        severity: event.severity,
        now,
      });

      if (throttleCheck.throttled) {
        const suppression: NotificationSuppression = {
          id: `supp-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
          organizationId: event.organizationId,
          projectId: event.projectId,
          reason: 'THROTTLED',
          eventType: event.eventType,
          eventFingerprint: event.fingerprint,
          details: { reason: throttleCheck.reason, bypass: throttleCheck.bypass },
          suppressedAt: new Date(now).toISOString(),
        };
        this.suppressionsHistory.push(suppression);
        NotificationTelemetry.emitNotificationSuppressed(suppression);

        // If throttled and not critical bypass, stop dispatch
        if (!throttleCheck.bypass) {
          return {
            success: true,
            event,
            deliveredCount: 0,
            suppressed: true,
            suppressionReason: 'THROTTLED',
            deliveries: [],
          };
        }
      }

      // 4. Incident Correlation
      let correlatedIncident: NotificationIncident | undefined;
      const correlation = IncidentCorrelator.evaluate(event, this.activeIncidents);

      if (correlation.action === 'CREATE_INCIDENT') {
        correlatedIncident = IncidentManager.createIncident(event);
        this.activeIncidents.push(correlatedIncident);
        this.incidentEvents.set(correlatedIncident.id, []);
        NotificationTelemetry.emitIncidentCreated(correlatedIncident);
      } else if (correlation.action === 'CORRELATE_TO_EXISTING' && correlation.incident) {
        correlatedIncident = correlation.incident;
        const existingList = this.incidentEvents.get(correlatedIncident.id) || [];
        const attached = IncidentManager.attachEvent(
          correlatedIncident,
          event,
          correlation.relationship,
          existingList
        );
        if (attached) {
          existingList.push(attached.event);
          this.incidentEvents.set(correlatedIncident.id, existingList);
        }
      } else if (correlation.action === 'RESOLVE_INCIDENT' && correlation.incident) {
        correlatedIncident = IncidentManager.resolve(correlation.incident, 'system-recovery');
        const idx = this.activeIncidents.findIndex((i) => i.id === correlatedIncident?.id);
        if (idx >= 0) this.activeIncidents[idx] = correlatedIncident;
        NotificationTelemetry.emitIncidentResolved(correlatedIncident);
      }

      // 5. Resolve Authorized Recipients
      const candidates = options.candidates || [];
      const resolvedRecipients = RecipientResolver.resolveRecipients({
        event,
        candidates,
        preferences: options.preferences,
        subscriptions: options.subscriptions,
      }).slice(0, NOTIFICATION_LIMITS.MAX_NOTIFICATION_RECIPIENTS_PER_EVENT);

      // 6. Render Factual Template
      const template = NotificationTemplater.render(event);
      const deliveries: NotificationDelivery[] = [];

      // 7. Dispatch In-App Notifications
      for (const recipient of resolvedRecipients) {
        const deliveryId = `deliv-inapp-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
        const delivery: NotificationDelivery = {
          id: deliveryId,
          organizationId: event.organizationId,
          projectId: event.projectId,
          notificationId: `notif-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
          eventId: event.id,
          recipientId: recipient.userId,
          channel: 'IN_APP',
          status: 'SENT',
          attemptsCount: 1,
          lastAttemptAt: new Date(now).toISOString(),
          createdAt: new Date(now).toISOString(),
        };

        NotificationTelemetry.emitDeliveryStarted(delivery);
        const result = await this.inAppProvider.send(delivery, {
          event,
          recipient,
          title: template.title,
          body: template.body,
          actionUrl: template.actionUrl,
        });

        delivery.status = result.status;
        delivery.providerMessageId = result.providerMessageId;
        delivery.errorCode = result.errorCode;

        deliveries.push(delivery);
        this.deliveriesHistory.push(delivery);

        if (result.status === 'DELIVERED') {
          NotificationTelemetry.emitDeliverySucceeded(delivery, result.providerMessageId);
        } else {
          NotificationTelemetry.emitDeliveryFailed(delivery, result.errorCode);
        }
      }

      // 8. Dispatch Outbound Webhooks (if configured)
      const webhooks = (options.webhookEndpoints || []).slice(
        0,
        NOTIFICATION_LIMITS.MAX_WEBHOOK_DELIVERIES_PER_EVENT
      );

      for (const endpoint of webhooks) {
        const deliveryId = `deliv-webhook-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
        const delivery: NotificationDelivery = {
          id: deliveryId,
          organizationId: event.organizationId,
          projectId: event.projectId,
          eventId: event.id,
          channel: 'WEBHOOK',
          status: 'SENT',
          attemptsCount: 1,
          lastAttemptAt: new Date(now).toISOString(),
          createdAt: new Date(now).toISOString(),
        };

        NotificationTelemetry.emitDeliveryStarted(delivery);

        const webhookProvider = new WebhookChannelProvider(endpoint, {
          allowLocalhost: options.allowLocalhost,
        });

        let result = await webhookProvider.send(delivery, {
          event,
          title: template.title,
          body: template.body,
          actionUrl: template.actionUrl,
        });

        delivery.status = result.status;
        delivery.errorCode = result.errorCode;
        delivery.providerMessageId = result.providerMessageId;

        // Bounded Retry Loop for retryable failures
        while (
          delivery.status === 'RETRYING' &&
          NotificationRetryEngine.shouldRetry({
            attemptsCount: delivery.attemptsCount,
            retryable: result.retryable ?? false,
          })
        ) {
          delivery.attemptsCount++;
          result = await webhookProvider.send(delivery, {
            event,
            title: template.title,
            body: template.body,
            actionUrl: template.actionUrl,
          });
          delivery.status = result.status;
          delivery.errorCode = result.errorCode;
          delivery.providerMessageId = result.providerMessageId;
        }

        deliveries.push(delivery);
        this.deliveriesHistory.push(delivery);

        if (delivery.status === 'DELIVERED') {
          NotificationTelemetry.emitDeliverySucceeded(delivery, result.providerMessageId);
        } else {
          NotificationTelemetry.emitDeliveryFailed(delivery, result.errorCode);
        }
      }

      // 9. Update deduplication and throttling states
      NotificationDeduplicator.record(event, now);
      NotificationThrottler.record({ projectId: event.projectId, now });
      NotificationTelemetry.emitNotificationCreated(event);

      const deliveredCount = deliveries.filter(
        (d) => d.status === 'DELIVERED' || d.status === 'SENT'
      ).length;

      return {
        success: true,
        event,
        deliveredCount,
        suppressed: false,
        deliveries,
        incident: correlatedIncident,
      };
    } catch (err: any) {
      // Top-level failure barrier: never throw from notification delivery
      console.warn('[NotificationEngine]: Suppressed delivery error to protect primary QA run:', err.message);
      return {
        success: false,
        event: NotificationEventNormalizer.normalize(rawInput),
        deliveredCount: 0,
        suppressed: false,
        deliveries: [],
        error: err.message,
      };
    }
  }

  /**
   * Returns in-memory active incidents for inspection or queries.
   */
  public getActiveIncidents(projectId?: string): NotificationIncident[] {
    if (projectId) {
      return this.activeIncidents.filter((i) => i.projectId === projectId);
    }
    return this.activeIncidents;
  }

  /**
   * Returns incident events for a specific incident.
   */
  public getIncidentEvents(incidentId: string): NotificationIncidentEvent[] {
    return this.incidentEvents.get(incidentId) || [];
  }

  /**
   * Returns recorded delivery history.
   */
  public getDeliveries(): NotificationDelivery[] {
    return this.deliveriesHistory;
  }

  /**
   * Returns recorded suppressions history.
   */
  public getSuppressions(): NotificationSuppression[] {
    return this.suppressionsHistory;
  }

  /**
   * Computes truthful delivery health summary.
   */
  public getDeliveryHealth(configuredChannels: string[] = ['IN_APP']): any {
    return NotificationTelemetry.computeDeliveryHealth({
      configuredChannels,
      deliveries: this.deliveriesHistory,
      suppressionsCount: this.suppressionsHistory.length,
    });
  }

  /**
   * Clears in-memory stores (for clean test isolation).
   */
  public reset(): void {
    this.activeIncidents = [];
    this.incidentEvents.clear();
    this.deliveriesHistory = [];
    this.suppressionsHistory = [];
    NotificationDeduplicator.reset();
    NotificationThrottler.reset();
  }
}
