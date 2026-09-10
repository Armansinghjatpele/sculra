// ==============================================================================
// Sculra Security Header Evaluator (worker/src/security/headers.ts)
// ==============================================================================
// Evaluates HTTP response headers against deterministic security benchmarks
// (CSP, X-Content-Type-Options, HSTS, X-Frame-Options, Referrer-Policy).

import {
  SecurityHeaderCheckResult,
  SecurityFinding,
  SecurityPolicyConfig,
} from './types';
import { SECURITY_HEADER_REQUIREMENTS } from './policy';
import { computeBugFingerprint } from '../issues/fingerprint';

export interface HeaderEvaluationInput {
  url: string;
  statusCode: number;
  headers: Record<string, string>;
  isHtml?: boolean;
}

export class SecurityHeaderEvaluator {
  /**
   * Convenience evaluate method for direct header assertions.
   */
  static evaluate(
    url: string,
    headers: Record<string, string>,
    policy?: SecurityPolicyConfig,
    isHtml: boolean = true
  ): {
    missingHeaders: string[];
    weakHeaders: string[];
    score: number;
    checks: SecurityHeaderCheckResult[];
    findings: SecurityFinding[];
  } {
    const { checks, findings } = this.evaluateHeaders(
      { url, statusCode: 200, headers, isHtml },
      'test_project',
      'test_run'
    );
    const missingHeaders = checks
      .filter((c) => c.status === 'FAILED' && c.findingType === 'SECURITY_HEADER_MISSING')
      .map((c) => c.headerName);
    const weakHeaders = checks
      .filter((c) => c.status === 'FAILED' && c.findingType === 'SECURITY_HEADER_WEAK')
      .map((c) => c.headerName);
    const passedCount = checks.filter((c) => c.status === 'PASSED').length;
    const totalCount = checks.length || 1;
    const score = Math.round((passedCount / totalCount) * 100);
    return { missingHeaders, weakHeaders, score, checks, findings };
  }

  /**
   * Deterministically evaluates security headers against benchmark requirements.
   */
  static evaluateHeaders(
    input: HeaderEvaluationInput,
    projectId: string,
    testRunId: string
  ): { checks: SecurityHeaderCheckResult[]; findings: SecurityFinding[] } {
    const { url, statusCode, headers, isHtml = true } = input;
    const checks: SecurityHeaderCheckResult[] = [];
    const findings: SecurityFinding[] = [];

    // Case-insensitive header dictionary lookup
    const normalizedHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) {
      normalizedHeaders[k.toLowerCase()] = v;
    }

    const isHttps = url.toLowerCase().startsWith('https:');

    // Only evaluate successful or standard application responses (not 5xx / connection drops)
    if (statusCode < 200 || statusCode >= 500) {
      return { checks, findings };
    }

    const path = new URL(url).pathname;

    for (const req of SECURITY_HEADER_REQUIREMENTS) {
      const lowerName = req.headerName.toLowerCase();
      const val = normalizedHeaders[lowerName];

      const validation = req.validate
        ? req.validate(val, isHttps, isHtml)
        : { valid: !!val, issue: val ? undefined : `Missing ${req.headerName}` };

      if (!validation.valid) {
        const findingType = !val ? 'SECURITY_HEADER_MISSING' : 'SECURITY_HEADER_WEAK';
        const severity = validation.severity || (findingType === 'SECURITY_HEADER_MISSING' ? 'medium' : 'low');
        const reason = validation.issue || `Header ${req.headerName} policy is missing or insecure.`;

        const recVals = req.recommendedValues?.join(', ') || 'Secure default';
        const check: SecurityHeaderCheckResult = {
          headerName: req.headerName,
          url,
          status: 'FAILED',
          observedValue: val,
          recommendedValues: req.recommendedValues,
          findingType,
          severity,
          reason,
        };
        checks.push(check);

        const fingerprint = computeBugFingerprint({
          projectId,
          url: path,
          bugType: findingType,
          action: req.headerName,
          errorSignature: reason,
        });

        const finding: SecurityFinding = {
          id: `sec_hdr_${fingerprint.substring(0, 12)}_${Date.now()}`,
          type: findingType,
          severity,
          confidence: 'HIGH',
          targetUrl: url,
          targetPath: path,
          title: `Security Header Issue: ${req.headerName}`,
          summary: reason,
          description: `Endpoint ${url} failed security header verification for "${req.headerName}". Current: ${val || 'None'}. Recommended: ${recVals}.`,
          whyItMatters: `Missing or misconfigured ${req.headerName} header weakens browser security safeguards.`,
          remediationRecommendation: `Configure the web server or reverse proxy to include "${req.headerName}: ${recVals}".`,
          evidenceSummary: `Observed response headers missing or having weak ${req.headerName}.`,
          fingerprint,
          detectedAt: new Date().toISOString(),
        };
        findings.push(finding);
      } else {
        checks.push({
          headerName: req.headerName,
          url,
          status: 'PASSED',
          observedValue: val,
          recommendedValues: req.recommendedValues,
        });
      }
    }

    return { checks, findings };
  }
}
