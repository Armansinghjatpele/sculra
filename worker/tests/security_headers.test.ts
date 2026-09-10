// ==============================================================================
// Unit Test: Security Header Evaluator (worker/tests/security_headers.test.ts)
// ==============================================================================

import { describe, it, expect } from 'vitest';
import { SecurityHeaderEvaluator } from '../src/security/headers';
import { DEFAULT_SECURITY_POLICY } from '../src/security/policy';

describe('SecurityHeaderEvaluator', () => {
  it('detects missing security headers when no defensive headers are present', () => {
    const rawHeaders: Record<string, string> = {
      'content-type': 'text/html; charset=utf-8',
      'server': 'nginx',
    };

    const result = SecurityHeaderEvaluator.evaluate(
      'http://localhost/dashboard',
      rawHeaders,
      DEFAULT_SECURITY_POLICY
    );

    expect(result.missingHeaders).toContain('Content-Security-Policy');
    expect(result.missingHeaders).toContain('X-Content-Type-Options');
    expect(result.missingHeaders).toContain('X-Frame-Options');
    expect(result.score).toBeLessThan(70);
    expect(result.findings.length).toBeGreaterThanOrEqual(3);
    expect(result.findings.some((f) => f.type === 'SECURITY_HEADER_MISSING')).toBe(true);
  });

  it('passes cleanly when all recommended defensive security headers are configured', () => {
    const rawHeaders: Record<string, string> = {
      'content-security-policy': "default-src 'self'",
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'strict-transport-security': 'max-age=31536000; includeSubDomains',
      'referrer-policy': 'strict-origin-when-cross-origin',
    };

    const result = SecurityHeaderEvaluator.evaluate(
      'https://example.com/dashboard',
      rawHeaders,
      DEFAULT_SECURITY_POLICY
    );

    expect(result.missingHeaders.length).toBe(0);
    expect(result.weakHeaders.length).toBe(0);
    expect(result.findings.length).toBe(0);
    expect(result.score).toBe(100);
  });

  it('detects weak CSP with unsafe-inline / unsafe-eval', () => {
    const rawHeaders: Record<string, string> = {
      'content-security-policy': "default-src 'self' 'unsafe-inline' 'unsafe-eval' *",
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'referrer-policy': 'no-referrer',
    };

    const result = SecurityHeaderEvaluator.evaluate(
      'http://localhost/app',
      rawHeaders,
      DEFAULT_SECURITY_POLICY
    );

    expect(result.weakHeaders).toContain('Content-Security-Policy');
    expect(result.findings.some((f) => f.type === 'SECURITY_HEADER_WEAK')).toBe(true);
  });

  it('detects weak X-Content-Type-Options and Referrer-Policy', () => {
    const rawHeaders: Record<string, string> = {
      'x-content-type-options': 'sniff',
      'referrer-policy': 'unsafe-url',
    };

    const result = SecurityHeaderEvaluator.evaluate(
      'http://localhost/page',
      rawHeaders,
      DEFAULT_SECURITY_POLICY
    );

    expect(result.weakHeaders).toContain('X-Content-Type-Options');
    expect(result.weakHeaders).toContain('Referrer-Policy');
    expect(result.findings.some((f) => f.description.includes('unsafe-url'))).toBe(true);
  });
});
