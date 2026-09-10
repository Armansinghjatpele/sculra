// ==============================================================================
// Unit Test: CORS Misconfiguration Evaluator (worker/tests/security_cors.test.ts)
// ==============================================================================

import { describe, it, expect } from 'vitest';
import { CorsSecurityEvaluator } from '../src/security/cors';
import { DEFAULT_SECURITY_POLICY } from '../src/security/policy';

describe('CorsSecurityEvaluator', () => {
  it('detects wildcard origin combined with credentials', () => {
    const responseHeaders: Record<string, string> = {
      'access-control-allow-origin': '*',
      'access-control-allow-credentials': 'true',
    };

    const result = CorsSecurityEvaluator.evaluate(
      'http://localhost/api/data',
      'https://evil.com',
      responseHeaders,
      DEFAULT_SECURITY_POLICY
    );

    expect(result.isMisconfigured).toBe(true);
    expect(result.findings.length).toBe(1);
    expect(result.findings[0].type).toBe('CORS_MISCONFIGURATION');
    expect(result.findings[0].description).toContain('wildcard');
  });

  it('detects arbitrary untrusted origin reflection with credentials', () => {
    const responseHeaders: Record<string, string> = {
      'access-control-allow-origin': 'https://attacker.evil.com',
      'access-control-allow-credentials': 'true',
    };

    const result = CorsSecurityEvaluator.evaluate(
      'https://api.example.com/profile',
      'https://attacker.evil.com',
      responseHeaders,
      DEFAULT_SECURITY_POLICY
    );

    expect(result.isMisconfigured).toBe(true);
    expect(result.findings.some((f) => f.description.includes('Reflected untrusted request origin'))).toBe(true);
  });

  it('detects null origin reflection with credentials', () => {
    const responseHeaders: Record<string, string> = {
      'access-control-allow-origin': 'null',
      'access-control-allow-credentials': 'true',
    };

    const result = CorsSecurityEvaluator.evaluate(
      'https://api.example.com/profile',
      'null',
      responseHeaders,
      DEFAULT_SECURITY_POLICY
    );

    expect(result.isMisconfigured).toBe(true);
    expect(result.findings.some((f) => f.description.includes('null'))).toBe(true);
  });

  it('passes cleanly for valid same-origin or trusted origin policy', () => {
    const responseHeaders: Record<string, string> = {
      'access-control-allow-origin': 'https://example.com',
      'access-control-allow-credentials': 'true',
    };

    const result = CorsSecurityEvaluator.evaluate(
      'https://example.com/api/users',
      'https://example.com',
      responseHeaders,
      DEFAULT_SECURITY_POLICY
    );

    expect(result.isMisconfigured).toBe(false);
    expect(result.findings.length).toBe(0);
  });
});
