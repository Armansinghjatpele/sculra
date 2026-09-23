// ==============================================================================
// Sculra Notification Channel Provider Abstraction
// (worker/src/notifications/channel.ts)
// ==============================================================================

import {
  NotificationChannelType,
  NotificationDelivery,
  NotificationEvent,
  NotificationRecipient,
  DeliveryResult,
} from './types';

export interface ChannelSendContext {
  event: NotificationEvent;
  recipient?: NotificationRecipient;
  title: string;
  body: string;
  markdown?: string;
  actionUrl?: string;
}

export interface NotificationChannelProvider {
  readonly channelType: NotificationChannelType;

  /**
   * Validates provider-specific runtime credentials or URL parameters.
   */
  validateConfiguration(config?: any): boolean;

  /**
   * Executes outbound delivery to the target recipient or endpoint.
   */
  send(
    delivery: NotificationDelivery,
    context: ChannelSendContext
  ): Promise<DeliveryResult>;

  /**
   * Health check for provider availability.
   */
  healthCheck(): Promise<{ healthy: boolean; reason?: string }>;
}
