// ==============================================================================
// Sculra Sensitive Data Exposure Evaluator (worker/src/security/exposure.ts)
// ==============================================================================
// Detects exposed secrets, tokens, private keys, and sensitive data in response payloads.
//
// STRICT ZERO EXPOSURE PRINCIPLE:
// Matched sensitive secret values are NEVER stored in evidence, logs, AI context, or database.
// All detected tokens are immediately masked and replaced with sanitized signatures.

import {
  SensitiveExposureCheckResult,
  SecurityFinding,
  SecurityFindingType,
  SecurityPolicyConfig,
} from './types';
import { SENSITIVE_DATA_PATTERNS } from './policy';
import { computeBugFingerprint } from '../issues/fingerprint';

export interface SensitiveExposureScanInput {
  url: string;
  method?: string;
  source: 'API_RESPONSE' | 'DOM_TEXT' | 'CONSOLE' | 'NETWORK_HEADER';
  content: string;
}

import { DEFAULT_SECURITY_POLICY } from './policy';

export class SensitiveDataExposureEvaluator {
  /**
   * Deterministically masks a sensitive secret string.
   */
  static maskSecret(secret: string): string {
    if (!secret || typeof secret !== 'string') return '';
    if (secret.length <= 8) return '********';
    const prefix = secret.substring(0, 4);
    const suffix = secret.substring(secret.length - 4);
    const stars = '*'.repeat(Math.max(4, secret.length - 8));
    return `${prefix}${stars}${suffix}`;
  }

  /**
   * Convenience evaluate method for direct content exposure check.
   */
  static evaluate(
    url: string,
    content: string,
    policy: SecurityPolicyConfig = DEFAULT_SECURITY_POLICY,
    source: 'API_RESPONSE' | 'DOM_TEXT' | 'CONSOLE' | 'NETWORK_HEADER' = 'API_RESPONSE'
  ): {
    exposuresFound: number;
    checks: SensitiveExposureCheckResult[];
    findings: SecurityFinding[];
  } {
    const { checks, findings } = this.scanContent(
      { url, source, content },
      'test_project',
      'test_run'
    );
    return {
      exposuresFound: findings.length,
      checks,
      findings,
    };
  }

  /**
   * Scans content for sensitive credentials or secret exposures, aggressively redacting the values.
   */
  static scanContent(
    input: SensitiveExposureScanInput,
    projectId: string,
    testRunId: string
  ): { checks: SensitiveExposureCheckResult[]; findings: SecurityFinding[] } {
    const { url, method = 'GET', source, content } = input;
    const checks: SensitiveExposureCheckResult[] = [];
    const findings: SecurityFinding[] = [];

    if (!content || typeof content !== 'string') {
      return { checks, findings };
    }

    const path = new URL(url).pathname;

    for (const patternItem of SENSITIVE_DATA_PATTERNS) {
      const match = content.match(patternItem.pattern);
      if (match) {
        const rawMatchedValue = match[1] || match[0];
        const maskedValue = this.maskSecret(rawMatchedValue);

        const reason = `Detected potential ${patternItem.name} exposure in ${source.toLowerCase().replace('_', ' ')}.`;

        const check: SensitiveExposureCheckResult = {
          url,
          method,
          source,
          patternName: patternItem.name,
          redactedField: patternItem.name,
          redactedSnippet: maskedValue,
          findingType: patternItem.findingType,
          severity: patternItem.severity,
          reason,
        };
        checks.push(check);

        const fingerprint = computeBugFingerprint({
          projectId,
          url: path,
          bugType: patternItem.findingType,
          action: patternItem.name,
          errorSignature: reason,
        });

        findings.push({
          id: `sec_exp_${fingerprint.substring(0, 12)}_${Date.now()}`,
          type: patternItem.findingType,
          severity: patternItem.severity,
          confidence: 'HIGH',
          targetUrl: url,
          targetPath: path,
          method,
          title: `Sensitive Data Exposure: [${patternItem.name}] on ${path}`,
          summary: reason,
          description: `Sanitized scan detected pattern matching "${patternItem.name}" in ${source}. Value was masked immediately.`,
          whyItMatters: 'Exposing credentials, API tokens, or cryptographic keys in client-accessible responses allows unauthorized access and potential compromise of cloud infrastructure or user accounts.',
          remediationRecommendation: 'Remove secret values and private tokens from client-accessible payloads, DOM templates, and API responses. Use environment secret managers.',
          evidenceSummary: `URL: ${url} | Pattern: ${patternItem.name} | Redacted Signature: ${maskedValue} | Source: ${source}`,
          fingerprint,
          detectedAt: new Date().toISOString(),
        });
      }
    }

    return { checks, findings };
  }
}
