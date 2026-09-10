// ==============================================================================
// Sculra Redirect Security Evaluator (worker/src/security/redirects.ts)
// ==============================================================================
// Evaluates redirect parameters for unvalidated open redirect vulnerabilities
// using safe, controlled sentinel destinations and strict SSRF protections.

import {
  SecurityRedirectCheckResult,
  SecurityFinding,
  SecurityPolicyConfig,
} from './types';
import { computeBugFingerprint } from '../issues/fingerprint';

export interface RedirectEvaluationInput {
  url: string;
  parameterName: string;
  testedRedirectValue: string;
  statusCode: number;
  locationHeader?: string;
  finalUrl?: string;
}

export class RedirectSecurityEvaluator {
  /**
   * Evaluates response to a redirect probe.
   */
  static evaluateRedirect(
    input: RedirectEvaluationInput,
    projectId: string,
    testRunId: string,
    baseTargetUrl: string,
    policy: SecurityPolicyConfig
  ): { check: SecurityRedirectCheckResult; finding?: SecurityFinding } {
    const { url, parameterName, testedRedirectValue, statusCode, locationHeader, finalUrl } = input;

    const baseOrigin = new URL(baseTargetUrl).origin.toLowerCase();
    const destination = locationHeader || finalUrl || '';
    let isExternalRedirect = false;

    if (destination) {
      try {
        const parsedDest = new URL(destination, baseTargetUrl);
        const destOrigin = parsedDest.origin.toLowerCase();
        isExternalRedirect = destOrigin !== baseOrigin;
      } catch {
        isExternalRedirect = false;
      }
    }

    const isRedirectStatus = statusCode >= 300 && statusCode < 400;
    const redirectsToSentinel =
      destination.includes('security-sentinel.sculra.internal') ||
      destination.includes('evil-example.com') ||
      destination.includes('example.com/untrusted');

    if ((isRedirectStatus || finalUrl?.includes('security-sentinel.sculra.internal')) && isExternalRedirect && redirectsToSentinel) {
      const path = new URL(url).pathname;
      const reason = `Open redirect detected on parameter "${parameterName}": target issued external redirect to unvalidated destination "${destination}".`;

      const check: SecurityRedirectCheckResult = {
        url,
        parameterName,
        testedRedirectValue,
        finalUrl: destination,
        statusCode,
        isExternalRedirect: true,
        status: 'FAILED',
        findingType: 'OPEN_REDIRECT',
        severity: 'medium',
        reason,
      };

      const fingerprint = computeBugFingerprint({
        projectId,
        url: path,
        bugType: 'OPEN_REDIRECT',
        action: parameterName,
        errorSignature: reason,
      });

      const finding: SecurityFinding = {
        id: `sec_redir_${fingerprint.substring(0, 12)}_${Date.now()}`,
        type: 'OPEN_REDIRECT',
        severity: 'medium',
        confidence: 'HIGH',
        targetUrl: url,
        targetPath: path,
        title: `Open Redirect Vulnerability on ${path} (${parameterName})`,
        summary: reason,
        description: `Passing an external destination to "${parameterName}" caused an unvalidated HTTP ${statusCode} redirect to "${destination}".`,
        whyItMatters: 'Open redirects can be exploited in phishing campaigns to redirect users from a trusted application domain to malicious external phishing sites.',
        remediationRecommendation: `Validate the "${parameterName}" parameter against an explicit whitelist of internal relative paths before performing redirection.`,
        evidenceSummary: `URL: ${url} | Parameter: ${parameterName} | Injected: ${testedRedirectValue} | Redirected To: ${destination} (HTTP ${statusCode})`,
        fingerprint,
        detectedAt: new Date().toISOString(),
      };

      return { check, finding };
    }

    return {
      check: {
        url,
        parameterName,
        testedRedirectValue,
        finalUrl: destination,
        statusCode,
        isExternalRedirect,
        status: 'PASSED',
      },
    };
  }
}
