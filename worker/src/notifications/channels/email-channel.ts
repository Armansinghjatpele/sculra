// ==============================================================================
// Sculra Email Notification Channel Provider
// (worker/src/notifications/channels/email-channel.ts)
// ==============================================================================

import {
  NotificationChannelProvider,
  ChannelSendContext,
} from '../channel';
import {
  NotificationChannelType,
  NotificationDelivery,
  DeliveryResult,
  EmailDeliveryConfig,
} from '../types';

export class EmailChannelProvider implements NotificationChannelProvider {
  public readonly channelType: NotificationChannelType = 'EMAIL';

  private config: EmailDeliveryConfig;

  constructor(config: EmailDeliveryConfig = { provider: 'NOT_CONFIGURED' }) {
    this.config = config;
  }

  public validateConfiguration(config?: EmailDeliveryConfig): boolean {
    const c = config || this.config;
    if (c.provider === 'NOT_CONFIGURED') return false;
    return !!c.provider;
  }

  public async send(
    delivery: NotificationDelivery,
    context: ChannelSendContext
  ): Promise<DeliveryResult> {
    const startTime = Date.now();

    // 1. Truthful NOT_CONFIGURED state
    if (this.config.provider === 'NOT_CONFIGURED') {
      return {
        status: 'NOT_CONFIGURED',
        errorCode: 'EMAIL_PROVIDER_NOT_CONFIGURED',
        retryable: false,
        latencyMs: Date.now() - startTime,
      };
    }

    if (!context.recipient?.email) {
      return {
        status: 'FAILED',
        errorCode: 'RECIPIENT_EMAIL_MISSING',
        retryable: false,
        latencyMs: Date.now() - startTime,
      };
    }

    // 2. Deterministic Mock Provider (for test environments only)
    if (this.config.provider === 'MOCK') {
      return {
        status: 'SENT',
        providerMessageId: `mock-email-${Date.now()}`,
        latencyMs: Date.now() - startTime,
      };
    }

    // 3. Vault-connected external providers would execute bounded send here.
    return {
      status: 'NOT_CONFIGURED',
      errorCode: `PROVIDER_${this.config.provider}_PENDING_VAULT_BINDING`,
      retryable: false,
      latencyMs: Date.now() - startTime,
    };
  }

  public async healthCheck(): Promise<{ healthy: boolean; reason?: string }> {
    if (this.config.provider === 'NOT_CONFIGURED') {
      return { healthy: false, reason: 'Email provider is NOT_CONFIGURED' };
    }
    return { healthy: true };
  }
}
