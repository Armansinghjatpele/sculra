// ==============================================================================
// Sculra Deterministic API Assertions & Contract Validator (worker/src/api-qa/assertions.ts)
// ==============================================================================
// Evaluates transport, HTTP status, content integrity, JSON schema contracts,
// and authorization expectations against deterministic response observations.

import {
  ApiResponseObservation,
  ApiContractExpectation,
  ApiAssertionResult,
  ApiTestResult,
  ApiTestCase,
} from './types';
import { BugType } from '../issues/types';

export class DeterministicApiAssertions {
  /**
   * Evaluates all deterministic assertions on an API response observation.
   */
  static evaluate(testCase: ApiTestCase, observation: ApiResponseObservation): ApiTestResult {
    const assertions: ApiAssertionResult[] = [];
    let detectedBugType: BugType | undefined;
    let errorMessage: string | undefined;
    let isUnauthorizedAccess = false;

    // 1. Transport Assertions
    if (observation.errorClassification === 'TIMEOUT') {
      assertions.push({
        name: 'Transport: Request Timeout',
        category: 'TRANSPORT',
        passed: false,
        message: observation.bodyExcerpt || 'Request timed out',
      });
      detectedBugType = 'API_TIMEOUT';
      errorMessage = observation.bodyExcerpt || 'API request timed out.';
    } else if (observation.status === 0 || observation.errorClassification === 'NETWORK_ERROR') {
      assertions.push({
        name: 'Transport: Network Connectivity',
        category: 'TRANSPORT',
        passed: false,
        message: observation.bodyExcerpt || 'Connection / DNS failure',
      });
      detectedBugType = 'API_NETWORK_FAILURE';
      errorMessage = observation.bodyExcerpt || 'Network connection failed.';
    } else {
      assertions.push({
        name: 'Transport: Connection Established',
        category: 'TRANSPORT',
        passed: true,
      });
    }

    // 2. HTTP Status Assertions
    if (!detectedBugType && observation.status > 0) {
      if (testCase.expectedDenial) {
        // We expect access to be denied (e.g. 401, 403)
        const isDenied = observation.status === 401 || observation.status === 403;
        if (isDenied) {
          assertions.push({
            name: 'Authorization: Expected Denial (401/403)',
            category: 'AUTHORIZATION',
            passed: true,
            expected: [401, 403],
            actual: observation.status,
          });
        } else if (observation.status === 200 || observation.status === 201 || observation.status === 204) {
          // Unexpected access granted! Security boundary violation
          assertions.push({
            name: 'Authorization: Expected Denial (401/403)',
            category: 'AUTHORIZATION',
            passed: false,
            message: `Role "${testCase.request.role || 'ANONYMOUS'}" was granted unauthorized access with HTTP ${observation.status}.`,
            expected: [401, 403],
            actual: observation.status,
          });
          detectedBugType = 'API_UNEXPECTED_AUTHORIZED_ACCESS';
          isUnauthorizedAccess = true;
          errorMessage = `Security Violation: Unauthorized API access granted to restricted endpoint ${testCase.endpoint.path} with HTTP ${observation.status}.`;
        } else {
          assertions.push({
            name: 'Authorization: Expected Denial Status',
            category: 'AUTHORIZATION',
            passed: false,
            message: `Received unexpected status ${observation.status} during authorization check.`,
          });
          detectedBugType = 'API_AUTHORIZATION_FAILURE';
          errorMessage = `Authorization evaluation returned status HTTP ${observation.status}.`;
        }
      } else if (testCase.expectation?.expectedStatus && testCase.expectation.expectedStatus.length > 0) {
        const matches = testCase.expectation.expectedStatus.includes(observation.status);
        assertions.push({
          name: 'HTTP: Expected Status Match',
          category: 'HTTP',
          passed: matches,
          expected: testCase.expectation.expectedStatus,
          actual: observation.status,
          message: matches ? undefined : `Status HTTP ${observation.status} did not match expected [${testCase.expectation.expectedStatus.join(', ')}]`,
        });

        if (!matches) {
          if (observation.status >= 500) {
            detectedBugType = 'API_HTTP_5XX';
          } else if (observation.status >= 400) {
            detectedBugType = 'API_HTTP_4XX';
          } else {
            detectedBugType = 'API_UNEXPECTED_STATUS';
          }
          errorMessage = `HTTP status mismatch: got HTTP ${observation.status}, expected [${testCase.expectation.expectedStatus.join(', ')}].`;
        }
      } else {
        // Standard HTTP status expectations
        if (observation.status >= 500) {
          assertions.push({
            name: 'HTTP: No Server Error (5xx)',
            category: 'HTTP',
            passed: false,
            actual: observation.status,
            message: `Server returned internal error HTTP ${observation.status} ${observation.statusText}`,
          });
          detectedBugType = 'API_HTTP_5XX';
          errorMessage = `Server error HTTP ${observation.status} ${observation.statusText}`;
        } else if (observation.status >= 400) {
          assertions.push({
            name: 'HTTP: Successful Client Request (<400)',
            category: 'HTTP',
            passed: false,
            actual: observation.status,
            message: `Client error response HTTP ${observation.status} ${observation.statusText}`,
          });
          detectedBugType = 'API_HTTP_4XX';
          errorMessage = `Client error HTTP ${observation.status} ${observation.statusText}`;
        } else {
          assertions.push({
            name: 'HTTP: Successful Response (2xx/3xx)',
            category: 'HTTP',
            passed: true,
            actual: observation.status,
          });
        }
      }
    }

    // 3. Content Integrity & JSON Parsing Assertions
    if (!detectedBugType && observation.status > 0 && observation.status < 400) {
      if (observation.jsonParsed === false && observation.contentType?.includes('application/json')) {
        assertions.push({
          name: 'Content: Valid JSON Format',
          category: 'CONTENT',
          passed: false,
          message: 'Content-Type declares application/json but body contains malformed / unparseable JSON.',
        });
        detectedBugType = 'API_INVALID_JSON';
        errorMessage = 'Endpoint returned Content-Type: application/json with invalid JSON payload.';
      } else if (testCase.expectation?.contentType) {
        const matchesType = observation.contentType?.toLowerCase().includes(testCase.expectation.contentType.toLowerCase());
        assertions.push({
          name: `Content: Content-Type Match (${testCase.expectation.contentType})`,
          category: 'CONTENT',
          passed: !!matchesType,
          expected: testCase.expectation.contentType,
          actual: observation.contentType,
        });
        if (!matchesType) {
          detectedBugType = 'API_CONTENT_TYPE_MISMATCH';
          errorMessage = `Content-Type mismatch: expected "${testCase.expectation.contentType}", got "${observation.contentType}".`;
        }
      }
    }

    // 4. OpenAPI Contract & Schema Assertions
    if (!detectedBugType && observation.status >= 200 && observation.status < 300 && observation.bodyExcerpt) {
      if (testCase.expectation?.responseSchema || testCase.expectation?.requiredFields) {
        let parsedData: any;
        try {
          parsedData = JSON.parse(observation.bodyExcerpt);
        } catch {
          parsedData = undefined;
        }

        if (parsedData && typeof parsedData === 'object') {
          // Check required fields
          if (testCase.expectation.requiredFields && Array.isArray(testCase.expectation.requiredFields)) {
            for (const reqField of testCase.expectation.requiredFields) {
              const present = reqField in parsedData;
              assertions.push({
                name: `Contract: Required Field "${reqField}"`,
                category: 'CONTRACT',
                passed: present,
                message: present ? undefined : `Response JSON object missing required field "${reqField}".`,
              });
              if (!present && !detectedBugType) {
                detectedBugType = 'API_REQUIRED_FIELD_MISSING';
                errorMessage = `API contract violation: missing required field "${reqField}" in response payload.`;
              }
            }
          }

          // Check basic schema constraints
          if (!detectedBugType && testCase.expectation.responseSchema) {
            const schemaValidation = this.validateBasicSchema(parsedData, testCase.expectation.responseSchema);
            if (!schemaValidation.valid) {
              assertions.push({
                name: 'Contract: Schema Validation',
                category: 'CONTRACT',
                passed: false,
                message: schemaValidation.error,
              });
              detectedBugType = 'API_SCHEMA_VIOLATION';
              errorMessage = `API contract schema mismatch: ${schemaValidation.error}`;
            } else {
              assertions.push({
                name: 'Contract: Schema Validation',
                category: 'CONTRACT',
                passed: true,
              });
            }
          }
        }
      }
    }

    const hasFailedAssertions = assertions.some((a) => !a.passed);
    const status = hasFailedAssertions || detectedBugType ? 'FAILED' : 'PASSED';

    return {
      testCaseId: testCase.id,
      endpointId: testCase.endpoint.id,
      method: testCase.endpoint.method,
      url: observation.url,
      status,
      observation,
      assertions,
      bugType: detectedBugType,
      errorMessage,
      durationMs: observation.durationMs,
      isUnauthorizedAccess,
      role: testCase.request.role,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Deterministic recursive basic schema validation against primitive types, properties, and enums.
   */
  private static validateBasicSchema(data: any, schema: any, path: string = 'root'): { valid: boolean; error?: string } {
    if (!schema || typeof schema !== 'object') return { valid: true };

    const expectedType = schema.type;

    if (expectedType) {
      if (expectedType === 'string' && typeof data !== 'string') {
        return { valid: false, error: `${path}: expected string, got ${typeof data}` };
      }
      if (expectedType === 'number' && typeof data !== 'number') {
        return { valid: false, error: `${path}: expected number, got ${typeof data}` };
      }
      if (expectedType === 'integer' && (!Number.isInteger(data) || typeof data !== 'number')) {
        return { valid: false, error: `${path}: expected integer, got ${typeof data}` };
      }
      if (expectedType === 'boolean' && typeof data !== 'boolean') {
        return { valid: false, error: `${path}: expected boolean, got ${typeof data}` };
      }
      if (expectedType === 'array' && !Array.isArray(data)) {
        return { valid: false, error: `${path}: expected array, got ${typeof data}` };
      }
      if (expectedType === 'object' && (typeof data !== 'object' || data === null || Array.isArray(data))) {
        return { valid: false, error: `${path}: expected object, got ${typeof data}` };
      }
    }

    if (schema.enum && Array.isArray(schema.enum)) {
      if (!schema.enum.includes(data)) {
        return { valid: false, error: `${path}: value "${data}" is not in enum [${schema.enum.join(', ')}]` };
      }
    }

    if (expectedType === 'object' && typeof data === 'object' && data !== null && schema.properties) {
      // Check required fields on object
      if (Array.isArray(schema.required)) {
        for (const req of schema.required) {
          if (!(req in data)) {
            return { valid: false, error: `${path}: missing required field "${req}"` };
          }
        }
      }

      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (key in data) {
          const res = this.validateBasicSchema(data[key], propSchema, `${path}.${key}`);
          if (!res.valid) return res;
        }
      }
    }

    return { valid: true };
  }
}
