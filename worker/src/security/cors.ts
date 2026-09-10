// ==============================================================================
// Sculra CORS Security Evaluator (worker/src/security/cors.ts)
// ==============================================================================
// Evaluates Cross-Origin Resource Sharing (CORS) configurations for dangerous
// wildcard + credential combinations, arbitrary origin reflection, and insecure trust policies.

import {
  SecurityCorsCheckResult,
  SecurityFinding,
  SecurityPolicyConfig,
} from './types';
import { computeBugFingerprint } from '../issues/fingerprint';

export interface CorsEvaluationInput {
  url: string;
  statusCode: number;
  testOrigin: string;
  headers: Record<string, string>;
}

import { DEFAULT_SECURITY_POLICY } from './policy';

export class CorsSecurityEvaluator {
  /**
   * Convenience evaluate method for direct CORS assertion.
   */
  static evaluate(
    url: string,
    testOrigin: string,
    headers: Record<string, string>,
    policy: SecurityPolicyConfig = DEFAULT_SECURITY_POLICY
  ): {
    isMisconfigured: boolean;
    check: SecurityCorsCheckResult;
    findings: SecurityFinding[];
  } {
    const res = this.evaluateCorsResponse(
      { url, statusCode: 200, testOrigin, headers },
      'test_project',
      'test_run',
      policy
    );
    return {
      isMisconfigured: res.check.status === 'FAILED',
      check: res.check,
      findings: res.finding ? [res.finding] : [],
    };
  }

  /**
   * Deterministically evaluates CORS response headers against safety policies.
   */
  static evaluateCorsResponse(
    input: CorsEvaluationInput,
    projectId: string,
    testRunId: string,
    policy: SecurityPolicyConfig
  ): { check: SecurityCorsCheckResult; finding?: SecurityFinding } {
    const { url, testOrigin, headers } = input;

    // Case-insensitive lookup
    const normalized: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) {
      normalized[k.toLowerCase()] = v;
    }

    const allowOrigin = normalized['access-control-allow-origin'];
    const allowCredentials = normalized['access-control-allow-credentials'];

    // If no CORS headers present, it's not a CORS misconfiguration
    if (!allowOrigin) {
      return {
        check: {
          url,
          testOrigin,
          status: 'PASSED',
        },
      };
    }

    const trimmedOrigin = allowOrigin.trim();
    const isWildcard = trimmedOrigin === '*';
    const isNullOrigin = trimmedOrigin.toLowerCase() === 'null';
    const hasCredentials = allowCredentials?.toLowerCase().trim() === 'true';

    const targetOrigin = new URL(url).origin.toLowerCase();
    let isSameOrigin = false;
    try {
      isSameOrigin = Boolean(testOrigin && testOrigin !== 'null' && new URL(testOrigin).origin.toLowerCase() === targetOrigin);
    } catch {
      isSameOrigin = false;
    }

    const isReflectedTestOrigin = Boolean(
      testOrigin &&
      testOrigin !== 'null' &&
      !isSameOrigin &&
      trimmedOrigin.toLowerCase() === testOrigin.toLowerCase() &&
      !policy.corsPolicy.trustedOrigins.includes(testOrigin)
    );

    const issues: string[] = [];

    if (isWildcard && hasCredentials) {
      issues.push('Endpoint returns wildcard (*) Access-Control-Allow-Origin combined with Access-Control-Allow-Credentials: true.');
    } else if (isNullOrigin && hasCredentials) {
      issues.push('Endpoint trusts the "null" origin combined with Access-Control-Allow-Credentials: true.');
    } else if (isReflectedTestOrigin && hasCredentials) {
      issues.push(`Reflected untrusted request origin "${testOrigin}" with Access-Control-Allow-Credentials: true.`);
    }

    if (issues.length > 0) {
      const reason = issues.join(' ');
      const path = new URL(url).pathname;

      const check: SecurityCorsCheckResult = {
        url,
        testOrigin,
        allowOriginHeader: allowOrigin,
        allowCredentialsHeader: allowCredentials,
        status: 'FAILED',
        findingType: 'CORS_MISCONFIGURATION',
        severity: 'medium',
        reason,
      };

      const fingerprint = computeBugFingerprint({
        projectId,
        url: path,
        bugType: 'CORS_MISCONFIGURATION',
        action: 'CORS',
        errorSignature: reason,
      });

      const finding: SecurityFinding = {
        id: `sec_cors_${fingerprint.substring(0, 12)}_${Date.now()}`,
        type: 'CORS_MISCONFIGURATION',
        severity: 'medium',
        confidence: 'HIGH',
        targetUrl: url,
        targetPath: path,
        title: `CORS Security Misconfiguration on ${path}`,
        summary: reason,
        description: `Observed CORS headers: Access-Control-Allow-Origin: "${allowOrigin}", Access-Control-Allow-Credentials: "${allowCredentials || 'false'}". ${reason}`,
        whyItMatters: 'Overly permissive CORS policies allow malicious third-party websites to make authenticated cross-origin requests and read sensitive private data.',
        remediationRecommendation: 'Do not reflect arbitrary origins with credentials. Restrict Access-Control-Allow-Origin to an explicit whitelist of trusted application origins.',
        evidenceSummary: `URL: ${url} | Origin Tested: ${testOrigin} | ACAO: ${allowOrigin} | ACAC: ${allowCredentials || 'false'} | Issue: ${reason}`,
        fingerprint,
        detectedAt: new Date().toISOString(),
      };

      return { check, finding };
    }

    return {
      check: {
        url,
        testOrigin,
        allowOriginHeader: allowOrigin,
        allowCredentialsHeader: allowCredentials,
        status: 'PASSED',
      },
    };
  }
}
