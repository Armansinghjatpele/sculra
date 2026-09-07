// ==============================================================================
// Unit Test: Deterministic API Assertions (worker/tests/api_assertions.test.ts)
// ==============================================================================

import { describe, it, expect } from 'vitest';
import { DeterministicApiAssertions } from '../src/api-qa/assertions';
import { ApiTestCase, ApiResponseObservation } from '../src/api-qa/types';

describe('DeterministicApiAssertions', () => {
  const baseTestCase: ApiTestCase = {
    id: 'tc-1',
    endpoint: {
      id: 'ep-1',
      method: 'GET',
      path: '/api/users',
      url: 'http://localhost/api/users',
      source: 'PROJECT_CONFIG',
      firstSeen: '',
      lastSeen: '',
      confidence: 1,
    },
    request: {
      endpointId: 'ep-1',
      method: 'GET',
      url: 'http://localhost/api/users',
    },
  };

  it('passes when observation status is 200 and assertions hold', () => {
    const observation: ApiResponseObservation = {
      id: 'obs-1',
      endpointId: 'ep-1',
      method: 'GET',
      url: 'http://localhost/api/users',
      status: 200,
      statusText: 'OK',
      durationMs: 15,
      responseSize: 100,
      redirectCount: 0,
      safeHeaders: {},
      jsonParsed: true,
      timestamp: new Date().toISOString(),
    };

    const result = DeterministicApiAssertions.evaluate(baseTestCase, observation);
    expect(result.status).toBe('PASSED');
    expect(result.bugType).toBeUndefined();
  });

  it('detects API_HTTP_5XX on server internal error', () => {
    const observation: ApiResponseObservation = {
      id: 'obs-2',
      endpointId: 'ep-1',
      method: 'GET',
      url: 'http://localhost/api/users',
      status: 500,
      statusText: 'Internal Server Error',
      durationMs: 25,
      responseSize: 50,
      redirectCount: 0,
      safeHeaders: {},
      timestamp: new Date().toISOString(),
    };

    const result = DeterministicApiAssertions.evaluate(baseTestCase, observation);
    expect(result.status).toBe('FAILED');
    expect(result.bugType).toBe('API_HTTP_5XX');
  });

  it('detects API_INVALID_JSON when content type is JSON but body is unparseable', () => {
    const observation: ApiResponseObservation = {
      id: 'obs-3',
      endpointId: 'ep-1',
      method: 'GET',
      url: 'http://localhost/api/users',
      status: 200,
      statusText: 'OK',
      contentType: 'application/json',
      jsonParsed: false,
      durationMs: 20,
      responseSize: 50,
      redirectCount: 0,
      safeHeaders: {},
      timestamp: new Date().toISOString(),
    };

    const result = DeterministicApiAssertions.evaluate(baseTestCase, observation);
    expect(result.status).toBe('FAILED');
    expect(result.bugType).toBe('API_INVALID_JSON');
  });

  it('detects API_REQUIRED_FIELD_MISSING when response JSON lacks required contract fields', () => {
    const contractTestCase: ApiTestCase = {
      ...baseTestCase,
      expectation: {
        endpointId: 'ep-1',
        method: 'GET',
        expectedStatus: [200],
        requiredFields: ['status', 'version'],
      },
    };

    const observation: ApiResponseObservation = {
      id: 'obs-4',
      endpointId: 'ep-1',
      method: 'GET',
      url: 'http://localhost/api/users',
      status: 200,
      statusText: 'OK',
      contentType: 'application/json',
      jsonParsed: true,
      bodyExcerpt: JSON.stringify({ status: 'ok' }), // Missing 'version'
      durationMs: 20,
      responseSize: 50,
      redirectCount: 0,
      safeHeaders: {},
      timestamp: new Date().toISOString(),
    };

    const result = DeterministicApiAssertions.evaluate(contractTestCase, observation);
    expect(result.status).toBe('FAILED');
    expect(result.bugType).toBe('API_REQUIRED_FIELD_MISSING');
  });

  it('detects API_SCHEMA_VIOLATION when data types violate contract schema', () => {
    const contractTestCase: ApiTestCase = {
      ...baseTestCase,
      expectation: {
        endpointId: 'ep-1',
        method: 'GET',
        expectedStatus: [200],
        responseSchema: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
          },
        },
      },
    };

    const observation: ApiResponseObservation = {
      id: 'obs-5',
      endpointId: 'ep-1',
      method: 'GET',
      url: 'http://localhost/api/users',
      status: 200,
      statusText: 'OK',
      contentType: 'application/json',
      jsonParsed: true,
      bodyExcerpt: JSON.stringify({ id: 'not-an-int' }), // String instead of int
      durationMs: 20,
      responseSize: 50,
      redirectCount: 0,
      safeHeaders: {},
      timestamp: new Date().toISOString(),
    };

    const result = DeterministicApiAssertions.evaluate(contractTestCase, observation);
    expect(result.status).toBe('FAILED');
    expect(result.bugType).toBe('API_SCHEMA_VIOLATION');
  });

  it('detects API_UNEXPECTED_AUTHORIZED_ACCESS on security boundary breach', () => {
    const authCheckTestCase: ApiTestCase = {
      ...baseTestCase,
      isAuthCheck: true,
      expectedDenial: true, // Expected 401 or 403
      request: {
        ...baseTestCase.request,
        role: 'MEMBER',
      },
    };

    const observation: ApiResponseObservation = {
      id: 'obs-6',
      endpointId: 'ep-1',
      method: 'GET',
      url: 'http://localhost/api/admin/users',
      status: 200, // Unexpectedly granted!
      statusText: 'OK',
      durationMs: 20,
      responseSize: 50,
      redirectCount: 0,
      safeHeaders: {},
      role: 'MEMBER',
      timestamp: new Date().toISOString(),
    };

    const result = DeterministicApiAssertions.evaluate(authCheckTestCase, observation);
    expect(result.status).toBe('FAILED');
    expect(result.isUnauthorizedAccess).toBe(true);
    expect(result.bugType).toBe('API_UNEXPECTED_AUTHORIZED_ACCESS');
  });
});
