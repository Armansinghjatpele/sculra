// ==============================================================================
// Sculra Network Error Intelligence & Sensitive Sanitization (worker/src/issues/network.ts)
// ==============================================================================

import { CapturedNetworkError } from '../types';

const NON_CRITICAL_URL_PATTERNS: RegExp[] = [
  /google-analytics\.com/i,
  /analytics\./i,
  /posthog/i,
  /segment\.(io|com)/i,
  /mixpanel\.com/i,
  /sentry\.io/i,
  /datadoghq\.com/i,
  /doubleclick\.net/i,
  /facebook\.net/i,
  /hotjar\.com/i,
  /clarity\.ms/i,
  /telemetry/i,
  /favicon\.ico/i,
  /\.(woff2?|ttf|eot|otf)(\?.*)?$/i,
  /fonts\.(googleapis|gstatic)\.com/i,
];

const SENSITIVE_PARAM_NAMES = new Set([
  'token',
  'auth',
  'api_key',
  'apikey',
  'secret',
  'password',
  'passwd',
  'key',
  'sig',
  'signature',
  'access_token',
  'refresh_token',
  'session',
  'credential',
  'code',
  'otp',
]);

/**
 * Sanitizes a URL by redacting sensitive query parameter values.
 */
export function sanitizeUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (SENSITIVE_PARAM_NAMES.has(key.toLowerCase())) {
        parsed.searchParams.set(key, '[REDACTED]');
      }
    }
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}

/**
 * Determines whether a network failure is considered a critical functional failure
 * or non-critical noise (e.g. analytics beacon, optional font, or tracker blocking).
 */
export function isCriticalNetworkFailure(error: CapturedNetworkError): {
  critical: boolean;
  reason: string;
} {
  const sanitized = sanitizeUrl(error.url);

  // Check against non-critical pattern list
  for (const pattern of NON_CRITICAL_URL_PATTERNS) {
    if (pattern.test(sanitized)) {
      return {
        critical: false,
        reason: `Non-critical resource failure ignored (${pattern.toString()})`,
      };
    }
  }

  const resourceType = (error.resourceType || '').toLowerCase();
  const isApiOrFetch = resourceType === 'fetch' || resourceType === 'xhr' || sanitized.includes('/api/');
  const isDocument = resourceType === 'document';

  // HTTP >= 500 on API or Document is high critical
  if ((error.status && error.status >= 500) || isApiOrFetch || isDocument) {
    return {
      critical: true,
      reason: `Critical application resource failed [HTTP ${error.status || 'Failed'} (${resourceType || 'request'})]`,
    };
  }

  // HTTP 404/403 on API routes
  if (sanitized.includes('/api/') && error.status && error.status >= 400) {
    return {
      critical: true,
      reason: `API endpoint returned HTTP ${error.status}`,
    };
  }

  return {
    critical: false,
    reason: `Low severity resource issue (${resourceType || 'other'})`,
  };
}
