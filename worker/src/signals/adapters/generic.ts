// ==============================================================================
// Sculra Generic Signed Webhook Signal Provider Adapter
// (worker/src/signals/adapters/generic.ts)
//
// Invariants (Prompt 64):
// - Timing-safe HMAC SHA-256 verification
// - Accepts structured canonical signals or custom monitoring payloads
// - Does not fabricate evidence
// ==============================================================================

import crypto from 'crypto';
import { SignalAdapterResult, SignalProviderAdapter } from './adapter';
import {
  NormalizedSignalInput,
  ProductionSignalProvider,
  ProductionSignalSeverity,
  ProductionSignalType,
} from '../types';

export class GenericSignalAdapter implements SignalProviderAdapter {
  public readonly provider: ProductionSignalProvider = 'GENERIC_WEBHOOK';

  public verifySignature(
    rawBody: string,
    headers: Record<string, string>,
    secret?: string
  ): { valid: boolean; reason?: string } {
    if (!secret) {
      if (process.env.NODE_ENV === 'production') {
        return { valid: false, reason: 'Generic webhook secret is mandatory in production.' };
      }
      return { valid: true };
    }

    const lcHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) {
      lcHeaders[k.toLowerCase()] = v;
    }

    const sigHeader =
      lcHeaders['x-sculra-signature'] ||
      lcHeaders['x-hub-signature-256'] ||
      lcHeaders['x-signature'];

    if (sigHeader) {
      const cleanSig = sigHeader.replace(/^sha256=/i, '').trim();
      try {
        const hmac = crypto.createHmac('sha256', secret);
        hmac.update(rawBody);
        const digest = hmac.digest('hex');

        const sigBuf = Buffer.from(cleanSig, 'hex');
        const digestBuf = Buffer.from(digest, 'hex');

        if (sigBuf.length !== digestBuf.length || !crypto.timingSafeEqual(sigBuf, digestBuf)) {
          return { valid: false, reason: 'Signature mismatch.' };
        }
        return { valid: true };
      } catch {
        return { valid: false, reason: 'Failed to verify signature.' };
      }
    }

    // Check Bearer authorization token
    const authHeader = lcHeaders['authorization'];
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      const token = authHeader.substring(7).trim();
      const tokenBuf = Buffer.from(token);
      const secretBuf = Buffer.from(secret);
      if (tokenBuf.length === secretBuf.length && crypto.timingSafeEqual(tokenBuf, secretBuf)) {
        return { valid: true };
      }
      return { valid: false, reason: 'Invalid bearer authorization token.' };
    }

    return { valid: false, reason: 'Missing x-sculra-signature or Authorization header.' };
  }

  public parsePayload(
    payload: any,
    headers: Record<string, string>,
    projectId: string,
    organizationId?: string | null
  ): SignalAdapterResult {
    if (!payload || typeof payload !== 'object') {
      return { supported: false, error: 'Invalid payload structure: expected JSON object.', signals: [] };
    }

    const rawSignals = Array.isArray(payload.signals)
      ? payload.signals
      : Array.isArray(payload)
      ? payload
      : [payload];

    const signals: NormalizedSignalInput[] = [];

    for (const item of rawSignals) {
      if (!item || typeof item !== 'object') continue;

      const title = item.title || item.name || item.message || item.summary || 'Generic Production Signal';
      const signalType = (item.signalType || item.type || 'ERROR').toUpperCase() as ProductionSignalType;
      const severity = (item.severity || item.level || 'MEDIUM').toUpperCase() as ProductionSignalSeverity;

      signals.push({
        projectId,
        organizationId: organizationId || null,
        environmentId: item.environmentId || item.environment_id || null,
        deploymentId: item.deploymentId || item.deployment_id || null,
        releaseId: item.releaseId || item.release_id || null,
        provider: 'GENERIC_WEBHOOK',
        providerSignalId: item.providerSignalId || item.id || null,
        signalType,
        severity,
        title,
        description: item.description || item.details || null,
        fingerprint: item.fingerprint || null,
        firstObservedAt: item.firstObservedAt || item.timestamp || null,
        lastObservedAt: item.lastObservedAt || item.timestamp || null,
        affectedUrl: item.affectedUrl || item.url || null,
        affectedRoute: item.affectedRoute || item.route || null,
        affectedService: item.affectedService || item.service || null,
        affectedVersion: item.affectedVersion || item.version || null,
        affectedCommit: item.affectedCommit || item.commit || item.commitSha || null,
        affectedBranch: item.affectedBranch || item.branch || null,
        occurrenceCount: typeof item.occurrenceCount === 'number' ? item.occurrenceCount : 1,
        rawReference: item.rawReference || item.metadata || {},
      });
    }

    return {
      supported: true,
      signals,
    };
  }
}
