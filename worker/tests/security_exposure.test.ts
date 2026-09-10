// ==============================================================================
// Unit Test: Sensitive Data Exposure Evaluator (worker/tests/security_exposure.test.ts)
// ==============================================================================

import { describe, it, expect } from 'vitest';
import { SensitiveDataExposureEvaluator } from '../src/security/exposure';
import { DEFAULT_SECURITY_POLICY } from '../src/security/policy';

describe('SensitiveDataExposureEvaluator', () => {
  it('detects AWS Access Keys and applies in-place masking', () => {
    const rawBody = JSON.stringify({
      status: 'error',
      debug_aws: 'AKIAIOSFODNN7EXAMPLE',
    });

    const result = SensitiveDataExposureEvaluator.evaluate(
      'http://localhost/api/debug',
      rawBody,
      DEFAULT_SECURITY_POLICY
    );

    expect(result.exposuresFound).toBeGreaterThan(0);
    expect(result.findings.some((f) => f.type === 'SECRET_EXPOSURE')).toBe(true);

    // Assert raw key is masked
    const output = JSON.stringify(result);
    expect(output).not.toContain('AKIAIOSFODNN7EXAMPLE');
    expect(output).toContain('AKIA');
    expect(output).toContain('***');
  });

  it('detects Stripe live keys with critical severity', () => {
    const mockKey = ['sk', 'live', '51AbcDefGhIjKlMnOpQrStUvWxYz123456'].join('_');
    const rawBody = `{"error": "Failed transaction", "key": "${mockKey}"}`;

    const result = SensitiveDataExposureEvaluator.evaluate(
      'http://localhost/api/pay',
      rawBody,
      DEFAULT_SECURITY_POLICY
    );

    expect(result.findings.length).toBeGreaterThan(0);
    const stripeFinding = result.findings.find((f) => f.title.includes('Stripe'));
    expect(stripeFinding).toBeDefined();
    expect(stripeFinding?.severity).toBe('critical');
    expect(JSON.stringify(result)).not.toContain(mockKey);
  });

  it('detects JWT tokens and masks payload', () => {
    const sampleJwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    const rawBody = `{"token": "${sampleJwt}"}`;

    const result = SensitiveDataExposureEvaluator.evaluate(
      'http://localhost/api/auth',
      rawBody,
      DEFAULT_SECURITY_POLICY
    );

    expect(result.exposuresFound).toBeGreaterThan(0);
    expect(result.findings.some((f) => f.type === 'TOKEN_EXPOSURE')).toBe(true);
    expect(JSON.stringify(result)).not.toContain('SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c');
  });

  it('masks sensitive strings directly using maskSecret helper', () => {
    const masked = SensitiveDataExposureEvaluator.maskSecret('AKIAIOSFODNN7EXAMPLE');
    expect(masked).toBe('AKIA************MPLE');
    expect(masked).not.toBe('AKIAIOSFODNN7EXAMPLE');
  });
});
