// ==============================================================================
// Sculra Production Signal Normalizer & Sanitizer (worker/src/signals/normalizer.ts)
//
// Invariants (Prompt 64):
// - Normalize empty strings to NULL
// - Redact secrets and sensitive tokens
// - Deterministic fingerprint generation
// - Zero fabrication of project, deployment, release, environment, commit, branch, or version
// ==============================================================================

import crypto from 'crypto';
import {
  NormalizedSignalInput,
  ProductionSignal,
  ProductionSignalProvider,
  ProductionSignalSeverity,
  ProductionSignalStatus,
  ProductionSignalType,
} from './types';

const VALID_SIGNAL_TYPES: ReadonlySet<ProductionSignalType> = new Set([
  'ERROR',
  'EXCEPTION',
  'PERFORMANCE_DEGRADATION',
  'AVAILABILITY_FAILURE',
  'USER_JOURNEY_FAILURE',
  'HTTP_ERROR',
  'API_FAILURE',
  'SECURITY_EVENT',
  'ACCESSIBILITY_REGRESSION',
  'VISUAL_REGRESSION',
  'RESOURCE_FAILURE',
  'CUSTOM_INCIDENT',
]);

const VALID_SEVERITIES: ReadonlySet<ProductionSignalSeverity> = new Set([
  'INFO',
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
]);

const VALID_PROVIDERS: ReadonlySet<ProductionSignalProvider> = new Set([
  'SENTRY',
  'POSTHOG',
  'GENERIC_WEBHOOK',
  'MANUAL',
  'CI_CD',
]);

const SECRET_PATTERNS = [
  /(?:bearer\s+)[a-zA-Z0-9_\-\.]{15,}/gi,
  /(?:api[_\-]?key[:=]\s*)[a-zA-Z0-9_\-\.]{12,}/gi,
  /(?:token[:=]\s*)[a-zA-Z0-9_\-\.]{12,}/gi,
  /(?:password[:=]\s*)[^\s,;&]+/gi,
  /(?:secret[:=]\s*)[a-zA-Z0-9_\-\.]{12,}/gi,
  /ghp_[a-zA-Z0-9]{36}/g,
  /xox[baprs]-[0-9a-zA-Z]{10,48}/g,
];

export class SignalNormalizer {
  /**
   * Cleans string: trims and converts empty string or whitespace to null.
   */
  public static cleanString(val: any): string | null {
    if (typeof val !== 'string') return null;
    const trimmed = val.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  /**
   * Redacts common secrets and authorization tokens from text.
   */
  public static redactString(val: string | null): string | null {
    if (!val) return null;
    let result = val;
    for (const pattern of SECRET_PATTERNS) {
      result = result.replace(pattern, '[REDACTED_SECRET]');
    }
    return result;
  }

  /**
   * Deeply redacts sensitive keys from an object reference.
   */
  public static redactObject(obj: Record<string, any> | null | undefined): Record<string, any> {
    if (!obj || typeof obj !== 'object') return {};
    const redacted: Record<string, any> = {};

    const sensitiveKeyPattern = /password|secret|token|authorization|apikey|api_key|credential|private_key/i;

    for (const [k, v] of Object.entries(obj)) {
      if (sensitiveKeyPattern.test(k)) {
        redacted[k] = '[REDACTED_SECRET]';
      } else if (typeof v === 'string') {
        redacted[k] = this.redactString(v);
      } else if (v && typeof v === 'object' && !Array.isArray(v)) {
        redacted[k] = this.redactObject(v);
      } else {
        redacted[k] = v;
      }
    }
    return redacted;
  }

  /**
   * Generates a stable, deterministic fingerprint for a signal.
   */
  public static computeFingerprint(
    signalType: string,
    title: string,
    affectedRoute: string | null,
    affectedService: string | null,
    providerSignalId: string | null
  ): string {
    if (providerSignalId && providerSignalId.trim().length > 0) {
      return crypto
        .createHash('sha256')
        .update(`provider:${providerSignalId.trim()}`)
        .digest('hex');
    }

    const normType = signalType.trim().toUpperCase();
    const normTitle = (title || '').trim().toLowerCase();
    const normRoute = (affectedRoute || '').trim().toLowerCase().replace(/\/+$/, '');
    const normService = (affectedService || '').trim().toLowerCase();

    return crypto
      .createHash('sha256')
      .update(`${normType}|${normService}|${normRoute}|${normTitle}`)
      .digest('hex');
  }

  /**
   * Normalizes raw signal input into a canonical ProductionSignal structure.
   */
  public static normalize(input: NormalizedSignalInput): ProductionSignal {
    const projectId = this.cleanString(input.projectId);
    if (!projectId) {
      throw new Error('Signal normalization failed: projectId is required.');
    }

    const title = this.redactString(this.cleanString(input.title));
    if (!title) {
      throw new Error('Signal normalization failed: title is required and cannot be empty.');
    }

    const rawType = (this.cleanString(input.signalType) || '').toUpperCase() as ProductionSignalType;
    if (!VALID_SIGNAL_TYPES.has(rawType)) {
      throw new Error(`Signal normalization failed: invalid or unsupported signalType '${input.signalType}'.`);
    }

    const rawSev = (this.cleanString(input.severity) || 'INFO').toUpperCase() as ProductionSignalSeverity;
    const severity: ProductionSignalSeverity = VALID_SEVERITIES.has(rawSev) ? rawSev : 'INFO';

    const rawProv = (this.cleanString(input.provider) || 'GENERIC_WEBHOOK').toUpperCase() as ProductionSignalProvider;
    const provider: ProductionSignalProvider = VALID_PROVIDERS.has(rawProv) ? rawProv : 'GENERIC_WEBHOOK';

    const status: ProductionSignalStatus = input.status || 'OPEN';

    const providerSignalId = this.cleanString(input.providerSignalId);
    const affectedRoute = this.cleanString(input.affectedRoute);
    const affectedService = this.cleanString(input.affectedService);
    const affectedUrl = this.redactString(this.cleanString(input.affectedUrl));
    const affectedVersion = this.cleanString(input.affectedVersion);
    const affectedCommit = this.cleanString(input.affectedCommit);
    const affectedBranch = this.cleanString(input.affectedBranch);
    const deploymentId = this.cleanString(input.deploymentId);
    const releaseId = this.cleanString(input.releaseId);
    const environmentId = this.cleanString(input.environmentId);
    const organizationId = this.cleanString(input.organizationId);
    const description = this.redactString(this.cleanString(input.description));

    const fingerprint =
      this.cleanString(input.fingerprint) ||
      this.computeFingerprint(rawType, title, affectedRoute, affectedService, providerSignalId);

    const nowIso = new Date().toISOString();
    const firstObservedAt = this.cleanString(input.firstObservedAt) || nowIso;
    const lastObservedAt = this.cleanString(input.lastObservedAt) || firstObservedAt;
    const resolvedAt = this.cleanString(input.resolvedAt);

    const occurrenceCount = typeof input.occurrenceCount === 'number' && input.occurrenceCount > 0
      ? Math.floor(input.occurrenceCount)
      : 1;

    const confidence = typeof input.confidence === 'number'
      ? Math.max(0, Math.min(1, input.confidence))
      : 1.0;

    const rawReference = this.redactObject(input.rawReference);

    return {
      id: crypto.randomUUID(),
      organizationId,
      projectId,
      environmentId,
      deploymentId,
      releaseId,
      provider,
      providerSignalId,
      signalType: rawType,
      severity,
      status,
      title,
      description,
      fingerprint,
      firstObservedAt,
      lastObservedAt,
      resolvedAt,
      affectedUrl,
      affectedRoute,
      affectedService,
      affectedVersion,
      affectedCommit,
      affectedBranch,
      occurrenceCount,
      rawReference,
      confidence,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
  }
}
