// ==============================================================================
// Sculra Secure Outbound Webhook Channel Provider
// (worker/src/notifications/channels/webhook-channel.ts)
// ==============================================================================

import crypto from 'crypto';
import { validateTargetUrl } from '../../security/ssrf';
import {
  NotificationChannelProvider,
  ChannelSendContext,
} from '../channel';
import {
  NotificationChannelType,
  NotificationDelivery,
  DeliveryResult,
  WebhookEndpointConfig,
} from '../types';
import { NOTIFICATION_LIMITS } from '../policy';

export class WebhookChannelProvider implements NotificationChannelProvider {
  public readonly channelType: NotificationChannelType = 'WEBHOOK';

  private endpoint: WebhookEndpointConfig;
  private allowLocalhost: boolean;

  constructor(
    endpoint: WebhookEndpointConfig,
    options: { allowLocalhost?: boolean } = {}
  ) {
    this.endpoint = endpoint;
    this.allowLocalhost = options.allowLocalhost ?? false;
  }

  public validateConfiguration(config?: WebhookEndpointConfig): boolean {
    const ep = config || this.endpoint;
    if (!ep || !ep.url || !ep.secret) return false;
    const ssrfCheck = validateTargetUrl(ep.url, { allowLocalhost: this.allowLocalhost });
    return ssrfCheck.valid;
  }

  /**
   * Generates canonical HMAC SHA-256 signature for webhook payload.
   */
  public static computeSignature(rawBody: string, secret: string): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(rawBody);
    return `sha256=${hmac.digest('hex').toLowerCase()}`;
  }

  /**
   * Dispatches signed webhook with SSRF validation, bounded body, and redirect checks.
   */
  public async send(
    delivery: NotificationDelivery,
    context: ChannelSendContext
  ): Promise<DeliveryResult> {
    const startTime = Date.now();

    if (this.endpoint.enabled === false) {
      return {
        status: 'SUPPRESSED',
        suppressedReason: 'PREFERENCE_DISABLED',
        latencyMs: Date.now() - startTime,
      };
    }

    // 1. Initial Target URL SSRF Validation
    const ssrfCheck = validateTargetUrl(this.endpoint.url, {
      allowLocalhost: this.allowLocalhost,
    });
    if (!ssrfCheck.valid) {
      return {
        status: 'FAILED',
        errorCode: `SSRF_BLOCKED: ${ssrfCheck.error}`,
        retryable: false,
        latencyMs: Date.now() - startTime,
      };
    }

    // 2. Prepare Payload & Signature
    const timestamp = new Date().toISOString();
    const payloadObject = {
      id: delivery.id,
      eventId: context.event.id,
      eventType: context.event.eventType,
      severity: context.event.severity,
      title: context.title,
      summary: context.body,
      occurredAt: context.event.occurredAt,
      timestamp,
      entity: {
        type: context.event.entityType,
        id: context.event.entityId,
      },
      actionUrl: context.actionUrl,
      metadata: context.event.metadata || {},
    };

    const rawBody = JSON.stringify(payloadObject);
    const signature = WebhookChannelProvider.computeSignature(
      rawBody,
      this.endpoint.secret
    );

    // 3. Execute Bounded Fetch with Manual Redirect Verification
    let currentUrl = this.endpoint.url;
    let redirectsCount = 0;

    while (redirectsCount <= NOTIFICATION_LIMITS.MAX_WEBHOOK_REDIRECTS) {
      // Re-verify SSRF on each hop (including initial)
      const hopValidation = validateTargetUrl(currentUrl, {
        allowLocalhost: this.allowLocalhost,
      });
      if (!hopValidation.valid) {
        return {
          status: 'FAILED',
          errorCode: `SSRF_BLOCKED_ON_REDIRECT: ${hopValidation.error}`,
          retryable: false,
          latencyMs: Date.now() - startTime,
        };
      }

      const controller = new AbortController();
      const timeoutTimer = setTimeout(
        () => controller.abort(),
        NOTIFICATION_LIMITS.MAX_WEBHOOK_TIMEOUT_MS
      );

      try {
        const response = await fetch(currentUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Sculra-Notification-Engine/1.0',
            'X-Sculra-Event': context.event.eventType,
            'X-Sculra-Timestamp': timestamp,
            'X-Sculra-Delivery-Id': delivery.id,
            'X-Sculra-Signature': signature,
          },
          body: rawBody,
          redirect: 'manual', // Enforce manual hop checking
          signal: controller.signal,
        });

        clearTimeout(timeoutTimer);

        // Check for redirects (301, 302, 303, 307, 308)
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          const location = response.headers.get('location');
          if (!location) {
            return {
              status: 'FAILED',
              errorCode: 'REDIRECT_WITHOUT_LOCATION',
              retryable: false,
              latencyMs: Date.now() - startTime,
            };
          }

          redirectsCount++;
          if (redirectsCount > NOTIFICATION_LIMITS.MAX_WEBHOOK_REDIRECTS) {
            return {
              status: 'FAILED',
              errorCode: `MAX_REDIRECTS_EXCEEDED (${NOTIFICATION_LIMITS.MAX_WEBHOOK_REDIRECTS})`,
              retryable: false,
              latencyMs: Date.now() - startTime,
            };
          }

          currentUrl = new URL(location, currentUrl).toString();
          continue; // Loop and re-evaluate next hop
        }

        // Bounded response body consumption
        let byteLength = 0;
        if (typeof response.arrayBuffer === 'function') {
          const arrayBuffer = await response.arrayBuffer();
          byteLength = arrayBuffer.byteLength;
        } else if (typeof response.text === 'function') {
          const text = await response.text();
          byteLength = Buffer.byteLength(text, 'utf8');
        }

        if (byteLength > NOTIFICATION_LIMITS.MAX_WEBHOOK_RESPONSE_BYTES) {
          return {
            status: 'FAILED',
            errorCode: `RESPONSE_SIZE_EXCEEDED (${byteLength} bytes)`,
            retryable: false,
            latencyMs: Date.now() - startTime,
          };
        }

        // Evaluate Response Status
        if (response.ok) {
          return {
            status: 'DELIVERED',
            providerMessageId: `webhook-${response.status}-${delivery.id}`,
            latencyMs: Date.now() - startTime,
          };
        }

        // Non-2xx response: evaluate retryability
        // 5xx and 429 are retryable; 401, 403, 404 are non-retryable
        const isRetryable = response.status >= 500 || response.status === 429;
        return {
          status: isRetryable ? 'RETRYING' : 'FAILED',
          errorCode: `HTTP_${response.status}`,
          retryable: isRetryable,
          latencyMs: Date.now() - startTime,
        };
      } catch (err: any) {
        clearTimeout(timeoutTimer);
        const isTimeout = err.name === 'AbortError';
        return {
          status: isTimeout ? 'RETRYING' : 'FAILED',
          errorCode: isTimeout ? 'WEBHOOK_TIMEOUT' : err.message || 'NETWORK_ERROR',
          retryable: isTimeout || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT',
          latencyMs: Date.now() - startTime,
        };
      }
    }

    return {
      status: 'FAILED',
      errorCode: 'MAX_REDIRECTS_EXCEEDED',
      retryable: false,
      latencyMs: Date.now() - startTime,
    };
  }

  public async healthCheck(): Promise<{ healthy: boolean; reason?: string }> {
    const valid = this.validateConfiguration();
    return {
      healthy: valid,
      reason: valid ? undefined : 'Webhook configuration failed SSRF or missing secret',
    };
  }
}
