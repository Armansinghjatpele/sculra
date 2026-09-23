// ==============================================================================
// Sculra In-App Notification Channel Provider
// (worker/src/notifications/channels/in-app-channel.ts)
// ==============================================================================

import { SupabaseClient } from '@supabase/supabase-js';
import {
  NotificationChannelProvider,
  ChannelSendContext,
} from '../channel';
import {
  NotificationChannelType,
  NotificationDelivery,
  DeliveryResult,
} from '../types';

export class InAppChannelProvider implements NotificationChannelProvider {
  public readonly channelType: NotificationChannelType = 'IN_APP';

  private supabase?: SupabaseClient;

  constructor(supabaseClient?: SupabaseClient) {
    this.supabase = supabaseClient;
  }

  public validateConfiguration(): boolean {
    return true; // Authoritative in-app channel is always valid
  }

  public async send(
    delivery: NotificationDelivery,
    context: ChannelSendContext
  ): Promise<DeliveryResult> {
    const startTime = Date.now();

    if (!context.recipient?.userId) {
      return {
        status: 'FAILED',
        errorCode: 'RECIPIENT_USER_ID_REQUIRED',
        retryable: false,
        latencyMs: Date.now() - startTime,
      };
    }

    try {
      if (this.supabase) {
        const { data, error } = await this.supabase.from('notifications').insert({
          id: delivery.notificationId || undefined,
          organization_id: context.event.organizationId || null,
          project_id: context.event.projectId || null,
          clerk_user_id: context.recipient.userId,
          type: context.event.eventType,
          severity: context.event.severity,
          title: context.title,
          message: context.body,
          summary: context.body,
          entity_type: context.event.entityType,
          entity_id: context.event.entityId,
          dedupe_key: context.event.fingerprint,
          metadata: context.event.metadata || {},
          created_at: new Date().toISOString(),
        }).select('id').single();

        if (error) {
          return {
            status: 'FAILED',
            errorCode: error.message,
            retryable: true,
            latencyMs: Date.now() - startTime,
          };
        }

        return {
          status: 'DELIVERED',
          providerMessageId: data?.id,
          latencyMs: Date.now() - startTime,
        };
      }

      // Memory fallback when supabase is not provided (e.g. unit testing)
      return {
        status: 'DELIVERED',
        providerMessageId: `inapp-${Date.now()}`,
        latencyMs: Date.now() - startTime,
      };
    } catch (err: any) {
      return {
        status: 'FAILED',
        errorCode: err.message || 'Unknown database insertion failure',
        retryable: true,
        latencyMs: Date.now() - startTime,
      };
    }
  }

  public async healthCheck(): Promise<{ healthy: boolean; reason?: string }> {
    return { healthy: true };
  }
}
