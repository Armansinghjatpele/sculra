// ==============================================================================
// Sculra Deterministic Issue Fingerprinting (worker/src/issues/fingerprint.ts)
// ==============================================================================

import crypto from 'crypto';

export interface FingerprintComponents {
  projectId: string;
  url: string;
  bugType: string;
  selector?: string;
  action?: string;
  errorSignature?: string;
}

/**
 * Normalizes URL by retaining only protocol, host, and pathname (strips volatile query/hash).
 */
export function normalizeUrlForFingerprint(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname.replace(/\/$/, '')}`.toLowerCase();
  } catch {
    return (rawUrl || '').split('?')[0].split('#')[0].trim().toLowerCase();
  }
}

/**
 * Normalizes CSS/XPath selectors by removing volatile generated IDs or ephemeral indices.
 */
export function normalizeSelectorForFingerprint(selector?: string): string {
  if (!selector) return '';
  return selector
    .trim()
    .toLowerCase()
    .replace(/\b(id|key|ref)-[a-z0-9]{6,}\b/g, '$1-***')
    .replace(/:nth-child\(\d+\)/g, ':nth-child(n)')
    .replace(/\s+/g, ' ');
}

/**
 * Normalizes error signatures by removing volatile numbers, memory addresses, and timestamps.
 */
export function normalizeErrorSignatureForFingerprint(errorSig?: string): string {
  if (!errorSig) return '';
  return errorSig
    .trim()
    .toLowerCase()
    .replace(/0x[a-f0-9]+/gi, '0x***')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, 'uuid-***')
    .replace(/\b\d{4}-\d{2}-\d{2}t\d{2}:\d{2}:\d{2}(\.\d+)?z?\b/gi, 'timestamp-***')
    .replace(/:\d+:\d+/g, ':line:col')
    .replace(/\s+/g, ' ');
}

/**
 * Computes a deterministic, stable SHA256 hex digest for bug deduplication across test runs.
 */
export function computeBugFingerprint(components: FingerprintComponents): string {
  const normProject = (components.projectId || '').trim();
  const normUrl = normalizeUrlForFingerprint(components.url);
  const normBugType = (components.bugType || '').trim().toUpperCase();
  const normSelector = normalizeSelectorForFingerprint(components.selector);
  const normAction = (components.action || '').trim().toUpperCase();
  const normError = normalizeErrorSignatureForFingerprint(components.errorSignature);

  const payload = [
    normProject,
    normUrl,
    normBugType,
    normAction,
    normSelector,
    normError,
  ].join('|');

  return crypto.createHash('sha256').update(payload).digest('hex');
}
