// ==============================================================================
// Unit Test: Cookie Security Evaluator (worker/tests/security_cookies.test.ts)
// ==============================================================================

import { describe, it, expect } from 'vitest';
import { CookieSecurityEvaluator } from '../src/security/cookies';
import { DEFAULT_SECURITY_POLICY } from '../src/security/policy';

describe('CookieSecurityEvaluator', () => {
  it('detects missing HttpOnly, Secure, and SameSite attributes on auth cookies with zero value leakage', () => {
    const rawSetCookieHeaders = [
      'auth_token=super_secret_raw_jwt_value_12345; Path=/',
      'session_id=session_plain_value; Path=/; Domain=localhost',
    ];

    const result = CookieSecurityEvaluator.evaluate(
      'https://example.com/api/login',
      rawSetCookieHeaders,
      DEFAULT_SECURITY_POLICY
    );

    expect(result.cookiesEvaluated).toBe(2);
    expect(result.findings.length).toBeGreaterThanOrEqual(2);

    // Assert zero-leak guarantee
    const findingsJson = JSON.stringify(result);
    expect(findingsJson).not.toContain('super_secret_raw_jwt_value_12345');
    expect(findingsJson).not.toContain('session_plain_value');

    // Check specific findings
    const authFinding = result.findings.find((f) => f.title.includes('auth_token'));
    expect(authFinding).toBeDefined();
    expect(authFinding?.type).toBe('INSECURE_COOKIE');
    expect(authFinding?.severity).toBe('medium');
  });

  it('passes cleanly for fully secured cookies with HttpOnly, Secure, and SameSite', () => {
    const rawSetCookieHeaders = [
      'session_id=random123; Path=/; HttpOnly; Secure; SameSite=Strict',
      'user_pref=dark; Path=/; Secure; SameSite=Lax',
    ];

    const result = CookieSecurityEvaluator.evaluate(
      'https://example.com/dashboard',
      rawSetCookieHeaders,
      DEFAULT_SECURITY_POLICY
    );

    expect(result.cookiesEvaluated).toBe(2);
    expect(result.insecureCookiesCount).toBe(0);
    expect(result.findings.length).toBe(0);
  });

  it('detects SameSite=None without Secure flag as insecure', () => {
    const rawSetCookieHeaders = [
      'tracking_id=xyz; Path=/; SameSite=None',
    ];

    const result = CookieSecurityEvaluator.evaluate(
      'http://localhost/tracker',
      rawSetCookieHeaders,
      DEFAULT_SECURITY_POLICY
    );

    expect(result.findings.some((f) => f.description.includes('SameSite=None without the required Secure'))).toBe(true);
  });
});
