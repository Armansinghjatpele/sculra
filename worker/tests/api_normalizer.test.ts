// ==============================================================================
// Unit Test: API Normalizer & Sensitive Data Redaction (worker/tests/api_normalizer.test.ts)
// ==============================================================================

import { describe, it, expect } from 'vitest';
import {
  normalizeHttpMethod,
  normalizeApiUrl,
  normalizeEndpointPath,
  generateEndpointId,
  sanitizeQueryParams,
} from '../src/api-qa/normalizer';

describe('ApiNormalizer', () => {
  it('normalizes HTTP methods with fallback to GET for empty or invalid values', () => {
    expect(normalizeHttpMethod('get')).toBe('GET');
    expect(normalizeHttpMethod('POST')).toBe('POST');
    expect(normalizeHttpMethod('  put ')).toBe('PUT');
    expect(normalizeHttpMethod('delete')).toBe('DELETE');
    expect(normalizeHttpMethod('patch')).toBe('PATCH');
    expect(normalizeHttpMethod('head')).toBe('HEAD');
    expect(normalizeHttpMethod('options')).toBe('OPTIONS');
    expect(normalizeHttpMethod('INVALID_METHOD')).toBe('GET');
    expect(normalizeHttpMethod(undefined)).toBe('GET');
  });

  it('redacts sensitive query parameter values in URLs and search params', () => {
    const rawUrl = 'https://api.example.com/v1/users?token=secret123&apiKey=key999&limit=20&password=pass';
    const result = normalizeApiUrl(rawUrl);

    expect(result.pathname).toBe('/v1/users');
    expect(result.queryParams['token']).toBe('[REDACTED]');
    expect(result.queryParams['apiKey']).toBe('[REDACTED]');
    expect(result.queryParams['password']).toBe('[REDACTED]');
    expect(result.queryParams['limit']).toBe('20');
    expect(result.normalizedUrl).toContain('token=%5BREDACTED%5D');
  });

  it('strips embedded credentials (user:pass@host) from URLs', () => {
    const rawUrl = 'https://admin:supersecret@api.example.com/v1/dashboard';
    const result = normalizeApiUrl(rawUrl);

    expect(result.normalizedUrl).toBe('https://api.example.com/v1/dashboard');
    expect(result.normalizedUrl).not.toContain('supersecret');
    expect(result.normalizedUrl).not.toContain('admin:');
  });

  it('normalizes endpoint paths by converting IDs and UUIDs to placeholders', () => {
    expect(normalizeEndpointPath('/api/projects/123')).toBe('/api/projects/{id}');
    expect(normalizeEndpointPath('/api/users/c9bf9e57-1685-4c89-bafb-ff5af830be8a/settings')).toBe(
      '/api/users/{id}/settings'
    );
    expect(normalizeEndpointPath('/api/health/')).toBe('/api/health');
    expect(normalizeEndpointPath('/')).toBe('/');
  });

  it('generates deterministic endpoint IDs', () => {
    const id1 = generateEndpointId('GET', '/api/projects/{id}');
    const id2 = generateEndpointId('get', '/api/projects/123');
    expect(id1).toBe('endpoint_get_api_projects_{id}');
    expect(id2).toBe('endpoint_get_api_projects_{id}');
  });

  it('sanitizes query parameter records directly', () => {
    const params = {
      search: 'test',
      access_token: 'xyz-secret-token',
      page: '1',
      session: 'sess-abc',
    };
    const sanitized = sanitizeQueryParams(params);
    expect(sanitized['search']).toBe('test');
    expect(sanitized['access_token']).toBe('[REDACTED]');
    expect(sanitized['session']).toBe('[REDACTED]');
    expect(sanitized['page']).toBe('1');
  });
});
