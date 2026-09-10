// ==============================================================================
// Sculra Security Policy & Safety Boundaries (worker/src/security/policy.ts)
// ==============================================================================
// Defines deterministic security policy parameters, safe execution limits,
// security header benchmarks, cookie rules, CORS criteria, and sensitive data regexes.

import { SecurityPolicyConfig, SecurityHeaderRequirement } from './types';
import { ApiHttpMethod } from '../api-qa/types';

export const DEFAULT_SECURITY_POLICY: SecurityPolicyConfig = {
  allowedOrigins: [],
  allowedMethods: new Set<ApiHttpMethod>(['GET', 'HEAD', 'OPTIONS']),
  maxSecurityTargets: 100,
  maxSecurityRequests: 50,
  maxAuthorizationChecks: 25,
  maxRoleContexts: 5,
  maxConcurrentRequests: 4,
  maxRedirects: 3,
  maxResponseBytes: 1024 * 1024, // 1 MB
  requestTimeoutMs: 10000, // 10s
  maxExecutionTimeMs: 120000, // 120s
  enableHeaderChecks: true,
  enableCookieChecks: true,
  enableCorsChecks: true,
  enableRedirectChecks: true,
  enableExposureChecks: true,
  enableAuthBoundaryChecks: true,
  cookiePolicy: {
    requireHttpOnlyForAuth: true,
    requireSecureForHttps: true,
    allowedSameSite: ['Strict', 'Lax'],
  },
  corsPolicy: {
    allowWildcardOriginWithCredentials: false,
    allowReflectedOrigin: false,
    trustedOrigins: [],
  },
  redirectPolicy: {
    allowExternalRedirects: false,
    trustedDomains: [],
    safeSentinelUrl: 'https://security-sentinel.sculra.internal/sentinel',
  },
};

/**
 * Standard security header requirements and deterministic evaluation rules.
 */
export const SECURITY_HEADER_REQUIREMENTS: SecurityHeaderRequirement[] = [
  {
    headerName: 'X-Content-Type-Options',
    required: true,
    recommendedValues: ['nosniff'],
    validate: (val) => {
      if (!val) {
        return { valid: false, issue: 'Missing X-Content-Type-Options header.', severity: 'medium' };
      }
      if (val.toLowerCase().trim() !== 'nosniff') {
        return { valid: false, issue: `Weak X-Content-Type-Options header: expected "nosniff", got "${val}".`, severity: 'low' };
      }
      return { valid: true };
    },
  },
  {
    headerName: 'X-Frame-Options',
    required: false, // CSP frame-ancestors is modern equivalent, but X-Frame-Options is evaluated if present
    recommendedValues: ['DENY', 'SAMEORIGIN'],
    validate: (val, _isHttps, isHtml) => {
      if (!isHtml) return { valid: true };
      if (!val) {
        return { valid: false, issue: 'Missing X-Frame-Options / frame protection header on HTML page.', severity: 'medium' };
      }
      const upper = val.toUpperCase().trim();
      if (upper !== 'DENY' && upper !== 'SAMEORIGIN' && !upper.startsWith('ALLOW-FROM')) {
        return { valid: false, issue: `Weak or non-standard X-Frame-Options value: "${val}".`, severity: 'low' };
      }
      return { valid: true };
    },
  },
  {
    headerName: 'Strict-Transport-Security',
    required: true, // Only enforced when target origin is HTTPS
    recommendedValues: ['max-age=31536000; includeSubDomains'],
    validate: (val, isHttps) => {
      if (!isHttps) return { valid: true };
      if (!val) {
        return { valid: false, issue: 'Missing Strict-Transport-Security (HSTS) header on HTTPS target.', severity: 'medium' };
      }
      const maxAgeMatch = val.match(/max-age=(\d+)/i);
      if (!maxAgeMatch || parseInt(maxAgeMatch[1], 10) < 10368000) { // < 120 days
        return { valid: false, issue: `HSTS max-age is weak or less than recommended duration: "${val}".`, severity: 'low' };
      }
      return { valid: true };
    },
  },
  {
    headerName: 'Content-Security-Policy',
    required: false, // HTML applications should have CSP
    validate: (val, _isHttps, isHtml) => {
      if (!isHtml) return { valid: true };
      if (!val) {
        return { valid: false, issue: 'Missing Content-Security-Policy header on HTML surface.', severity: 'medium' };
      }
      if (val.includes('unsafe-inline') && val.includes('unsafe-eval')) {
        return { valid: false, issue: 'Content-Security-Policy contains both unsafe-inline and unsafe-eval directives.', severity: 'low' };
      }
      return { valid: true };
    },
  },
  {
    headerName: 'Referrer-Policy',
    required: false,
    recommendedValues: ['no-referrer', 'strict-origin-when-cross-origin', 'same-origin', 'no-referrer-when-downgrade'],
    validate: (val) => {
      if (!val) return { valid: true }; // optional
      const lower = val.toLowerCase().trim();
      if (lower === 'unsafe-url') {
        return { valid: false, issue: 'Referrer-Policy is set to "unsafe-url", exposing full URL in referrer headers.', severity: 'medium' };
      }
      return { valid: true };
    },
  },
];

/**
 * Common parameter names used for navigation redirects.
 */
export const REDIRECT_PARAM_CANDIDATES = [
  'redirect',
  'redirect_url',
  'redirect_uri',
  'return_url',
  'return_to',
  'return',
  'next',
  'target',
  'url',
  'dest',
  'destination',
  'continue',
  'callback',
  'goto',
  'r',
  'u',
];

/**
 * Regex patterns for detecting exposed secrets and tokens in responses, DOM text, and headers.
 * Values are used for identification only and are immediately redacted in evidence.
 */
export const SENSITIVE_DATA_PATTERNS: Array<{
  name: string;
  pattern: RegExp;
  findingType: 'SECRET_EXPOSURE' | 'TOKEN_EXPOSURE' | 'SENSITIVE_DATA_EXPOSURE';
  severity: 'critical' | 'high' | 'medium';
}> = [
  {
    name: 'AWS Access Key ID',
    pattern: /\b(AKIA[0-9A-Z]{16})\b/,
    findingType: 'SECRET_EXPOSURE',
    severity: 'critical',
  },
  {
    name: 'Stripe Secret/Live Key',
    pattern: /\b(sk_live_[0-9a-zA-Z]{24,})\b/,
    findingType: 'SECRET_EXPOSURE',
    severity: 'critical',
  },
  {
    name: 'GitHub Personal Access Token',
    pattern: /\b(ghp_[0-9a-zA-Z]{36}|github_pat_[0-9a-zA-Z_]{82})\b/,
    findingType: 'TOKEN_EXPOSURE',
    severity: 'critical',
  },
  {
    name: 'RSA/EC/OpenSSH Private Key',
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/,
    findingType: 'SECRET_EXPOSURE',
    severity: 'critical',
  },
  {
    name: 'Raw JSON Web Token (JWT)',
    pattern: /\beyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/,
    findingType: 'TOKEN_EXPOSURE',
    severity: 'high',
  },
  {
    name: 'Slack Bot/User Token',
    pattern: /\b(xox[baprs]-[0-9a-zA-Z]{10,48})\b/,
    findingType: 'TOKEN_EXPOSURE',
    severity: 'critical',
  },
  {
    name: 'Generic API Secret Field',
    pattern: /"(?:api[_-]?secret|client[_-]?secret|private[_-]?key|secret[_-]?token)"\s*:\s*"([^"]{8,})"/i,
    findingType: 'SECRET_EXPOSURE',
    severity: 'critical',
  },
  {
    name: 'Exposed Plaintext Password Field',
    pattern: /"(?:password|passwd|user_password|admin_password)"\s*:\s*"([^"]{4,})"/i,
    findingType: 'SENSITIVE_DATA_EXPOSURE',
    severity: 'high',
  },
];
