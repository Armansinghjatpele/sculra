// ==============================================================================
// Sculra API Normalizer & Sensitive Data Redaction (worker/src/api-qa/normalizer.ts)
// ==============================================================================
// Deterministic normalization of HTTP methods, URLs, paths, parameter names,
// and automatic redaction of sensitive query values and authentication tokens.

import { ApiHttpMethod } from './types';

export const SENSITIVE_PARAM_NAMES: ReadonlySet<string> = new Set([
  'token',
  'access_token',
  'refresh_token',
  'api_key',
  'apikey',
  'key',
  'secret',
  'password',
  'otp',
  'code',
  'authorization',
  'session',
  'cookie',
  'jwt',
  'auth',
  'client_secret',
  'private_key',
]);

/**
 * Normalizes HTTP method string to supported ApiHttpMethod uppercase format.
 */
export function normalizeHttpMethod(rawMethod?: string): ApiHttpMethod {
  if (!rawMethod) return 'GET';
  const upper = rawMethod.trim().toUpperCase();
  switch (upper) {
    case 'GET':
    case 'POST':
    case 'PUT':
    case 'PATCH':
    case 'DELETE':
    case 'HEAD':
    case 'OPTIONS':
      return upper;
    default:
      return 'GET';
  }
}

/**
 * Sanitizes query parameters by stripping/redacting values of known sensitive parameter keys.
 */
export function sanitizeQueryParams(
  params: Record<string, string> | URLSearchParams
): Record<string, string> {
  const sanitized: Record<string, string> = {};

  if (params instanceof URLSearchParams) {
    params.forEach((val, key) => {
      const lowerKey = key.toLowerCase().trim();
      if (SENSITIVE_PARAM_NAMES.has(lowerKey)) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = val;
      }
    });
  } else {
    for (const [key, val] of Object.entries(params)) {
      const lowerKey = key.toLowerCase().trim();
      if (SENSITIVE_PARAM_NAMES.has(lowerKey)) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = String(val);
      }
    }
  }

  return sanitized;
}

/**
 * Normalizes a URL and returns sanitized absolute URL, pathname, and safe query parameters.
 */
export function normalizeApiUrl(
  rawUrl: string,
  baseUrl?: string
): {
  normalizedUrl: string;
  pathname: string;
  queryParams: Record<string, string>;
  origin: string;
} {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl, baseUrl);
  } catch {
    // If not parseable as URL, treat as relative path
    const cleanPath = '/' + (rawUrl || '').replace(/^\/+/, '').split('?')[0];
    return {
      normalizedUrl: cleanPath,
      pathname: cleanPath,
      queryParams: {},
      origin: baseUrl ? new URL(baseUrl).origin : '',
    };
  }

  // Strip credentials in URL if any
  parsed.username = '';
  parsed.password = '';

  // Redact sensitive query parameters in URL
  const queryParams: Record<string, string> = {};
  for (const [key, val] of Array.from(parsed.searchParams.entries())) {
    const lowerKey = key.toLowerCase().trim();
    if (SENSITIVE_PARAM_NAMES.has(lowerKey)) {
      parsed.searchParams.set(key, '[REDACTED]');
      queryParams[key] = '[REDACTED]';
    } else {
      queryParams[key] = val;
    }
  }

  // Normalize trailing slash on pathname (keep '/' for root, otherwise strip trailing slash)
  let cleanPath = parsed.pathname;
  if (cleanPath.length > 1 && cleanPath.endsWith('/')) {
    cleanPath = cleanPath.slice(0, -1);
  }

  return {
    normalizedUrl: parsed.toString(),
    pathname: cleanPath,
    queryParams,
    origin: parsed.origin,
  };
}

/**
 * Normalizes an API path for endpoint identity (e.g. /api/projects/123 -> /api/projects/{id}).
 */
export function normalizeEndpointPath(pathname: string): string {
  if (!pathname || pathname === '/') return '/';

  let path = pathname.trim();
  if (path.length > 1 && path.endsWith('/')) {
    path = path.slice(0, -1);
  }

  // Normalize numeric and UUID path parameters to standard placeholders
  path = path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '/{id}')
    .replace(/\/\d+\b/g, '/{id}');

  return path;
}

/**
 * Computes deterministic endpoint ID from method and normalized path.
 */
export function generateEndpointId(method: ApiHttpMethod, path: string): string {
  const normMethod = method.toUpperCase();
  const normPath = normalizeEndpointPath(path)
    .replace(/[^a-zA-Z0-9_{}]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return `endpoint_${normMethod.toLowerCase()}_${normPath || 'root'}`;
}
