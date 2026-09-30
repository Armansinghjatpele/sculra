// ==============================================================================
// Sculra Sentry Signal Provider Adapter
// (worker/src/signals/adapters/sentry.ts)
//
// Invariants (Prompt 64):
// - Timing-safe HMAC SHA-256 signature verification
// - Extracts genuine tags and metadata from Sentry event/issue payload
// - Does not fabricate commits, deployments, or environments
// ==============================================================================

import crypto from 'crypto';
import { SignalAdapterResult, SignalProviderAdapter } from './adapter';
import {
  NormalizedSignalInput,
  ProductionSignalProvider,
  ProductionSignalSeverity,
  ProductionSignalType,
} from '../types';

export class SentrySignalAdapter implements SignalProviderAdapter {
  public readonly provider: ProductionSignalProvider = 'SENTRY';

  public verifySignature(
    rawBody: string,
    headers: Record<string, string>,
    secret?: string
  ): { valid: boolean; reason?: string } {
    if (!secret) {
      if (process.env.NODE_ENV === 'production') {
        return { valid: false, reason: 'Sentry webhook secret is required in production.' };
      }
      return { valid: true };
    }

    const lcHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) {
      lcHeaders[k.toLowerCase()] = v;
    }

    const sig = lcHeaders['sentry-hook-signature'];
    if (!sig) {
      return { valid: false, reason: 'Missing sentry-hook-signature header.' };
    }

    try {
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(rawBody);
      const digest = hmac.digest('hex');

      const sigBuf = Buffer.from(sig.trim(), 'hex');
      const digestBuf = Buffer.from(digest, 'hex');

      if (sigBuf.length !== digestBuf.length || !crypto.timingSafeEqual(sigBuf, digestBuf)) {
        return { valid: false, reason: 'Sentry HMAC signature mismatch.' };
      }
      return { valid: true };
    } catch {
      return { valid: false, reason: 'Failed to verify Sentry signature.' };
    }
  }

  public parsePayload(
    payload: any,
    headers: Record<string, string>,
    projectId: string,
    organizationId?: string | null
  ): SignalAdapterResult {
    if (!payload || typeof payload !== 'object') {
      return { supported: false, error: 'Invalid payload structure.', signals: [] };
    }

    const action = payload.action || 'created';
    const data = payload.data || payload;
    const issue = data.issue || data;
    const event = data.event || {};

    const providerSignalId = String(issue.id || event.event_id || event.id || '').trim() || null;
    const title = issue.title || event.title || event.message || 'Sentry Error';

    // Parse Sentry Tags
    const tags: Record<string, string> = {};
    if (Array.isArray(event.tags)) {
      for (const tag of event.tags) {
        if (Array.isArray(tag) && tag.length >= 2) {
          tags[String(tag[0]).toLowerCase()] = String(tag[1]);
        } else if (tag && typeof tag === 'object' && tag.key) {
          tags[String(tag.key).toLowerCase()] = String(tag.value);
        }
      }
    }

    // Extract genuine metadata
    const affectedVersion = tags['release'] || event.release || null;
    const affectedEnvironment = tags['environment'] || event.environment || null;
    const affectedCommit = tags['commit'] || tags['commit_sha'] || null;
    const affectedBranch = tags['branch'] || null;
    const affectedService = tags['server_name'] || tags['service'] || null;
    const affectedRoute = event.transaction || tags['transaction'] || null;
    const affectedUrl = event.request?.url || tags['url'] || null;

    // Severity mapping
    const rawLevel = (event.level || issue.level || 'error').toLowerCase();
    let severity: ProductionSignalSeverity = 'HIGH';
    if (rawLevel === 'fatal' || rawLevel === 'critical') severity = 'CRITICAL';
    else if (rawLevel === 'warning') severity = 'MEDIUM';
    else if (rawLevel === 'info') severity = 'INFO';
    else if (rawLevel === 'error') severity = 'HIGH';

    // Signal type mapping
    let signalType: ProductionSignalType = 'EXCEPTION';
    if (event.request?.status_code && event.request.status_code >= 500) {
      signalType = 'HTTP_ERROR';
    } else if (title.toLowerCase().includes('timeout') || title.toLowerCase().includes('slow')) {
      signalType = 'PERFORMANCE_DEGRADATION';
    }

    const firstObservedAt = issue.firstSeen || event.timestamp || new Date().toISOString();
    const lastObservedAt = issue.lastSeen || event.timestamp || firstObservedAt;
    const occurrenceCount = typeof issue.count === 'number' ? issue.count : 1;

    const signal: NormalizedSignalInput = {
      projectId,
      organizationId: organizationId || null,
      provider: 'SENTRY',
      providerSignalId,
      signalType,
      severity,
      title,
      description: issue.culprit || event.culprit || null,
      affectedVersion,
      affectedCommit,
      affectedBranch,
      affectedService,
      affectedRoute,
      affectedUrl,
      occurrenceCount,
      firstObservedAt,
      lastObservedAt,
      rawReference: {
        sentryAction: action,
        tags,
        culprit: issue.culprit,
      },
    };

    return {
      supported: true,
      signals: [signal],
    };
  }
}
