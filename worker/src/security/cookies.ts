// ==============================================================================
// Sculra Cookie Security Evaluator (worker/src/security/cookies.ts)
// ==============================================================================
// Evaluates cookie security attributes (HttpOnly, Secure, SameSite, Path, Domain).
//
// STRICT ZERO CREDENTIAL EXPOSURE GUARANTEE:
// Cookie VALUES are NEVER inspected, stored, logged, transmitted, or included in evidence.
// Only cookie names and boolean security attributes are processed.

import {
  SecurityCookieCheckResult,
  SecurityFinding,
  SecurityPolicyConfig,
} from './types';
import { computeBugFingerprint } from '../issues/fingerprint';

export interface CookieMetadataInput {
  name: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: string;
  path?: string;
  domain?: string;
  url?: string;
}

const AUTH_COOKIE_PATTERNS = [
  /auth/i,
  /session/i,
  /token/i,
  /jwt/i,
  /sid/i,
  /sess/i,
  /sculra_auth/i,
  /connect\.sid/i,
  /phpsessid/i,
  /jsessionid/i,
  /asp\.net_sessionid/i,
  /remember/i,
  /login/i,
];

import { DEFAULT_SECURITY_POLICY } from './policy';

export class CookieSecurityEvaluator {
  /**
   * Convenience evaluate method for direct cookie header list evaluation.
   */
  static evaluate(
    targetUrl: string,
    rawSetCookieHeaders: string[],
    policy: SecurityPolicyConfig = DEFAULT_SECURITY_POLICY
  ): {
    cookiesEvaluated: number;
    insecureCookiesCount: number;
    checks: SecurityCookieCheckResult[];
    findings: SecurityFinding[];
  } {
    const checks: SecurityCookieCheckResult[] = [];
    const findings: SecurityFinding[] = [];

    for (const rawHeader of rawSetCookieHeaders) {
      const parsed = this.parseSetCookieHeader(rawHeader);
      const res = this.evaluateCookie(
        parsed,
        'test_project',
        'test_run',
        targetUrl,
        policy
      );
      checks.push(res.check);
      if (res.finding) findings.push(res.finding);
    }

    const insecureCookiesCount = checks.filter((c) => c.status === 'FAILED').length;
    return {
      cookiesEvaluated: checks.length,
      insecureCookiesCount,
      checks,
      findings,
    };
  }

  /**
   * Deterministically parses Set-Cookie header string into safe metadata (values stripped).
   */
  static parseSetCookieHeader(headerStr: string): CookieMetadataInput {
    const parts = headerStr.split(';').map((p) => p.trim());
    const firstPart = parts[0] || '';
    const eqIdx = firstPart.indexOf('=');
    const name = eqIdx > 0 ? firstPart.substring(0, eqIdx).trim() : firstPart;

    let httpOnly = false;
    let secure = false;
    let sameSite: string | undefined;
    let path: string | undefined;
    let domain: string | undefined;

    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      const lower = part.toLowerCase();
      if (lower === 'httponly') httpOnly = true;
      else if (lower === 'secure') secure = true;
      else if (lower.startsWith('samesite=')) {
        sameSite = part.substring('samesite='.length).trim();
      } else if (lower.startsWith('path=')) {
        path = part.substring('path='.length).trim();
      } else if (lower.startsWith('domain=')) {
        domain = part.substring('domain='.length).trim();
      }
    }

    return { name, httpOnly, secure, sameSite, path, domain };
  }

  /**
   * Evaluates cookie security attributes against security policy.
   */
  static evaluateCookie(
    cookie: CookieMetadataInput,
    projectId: string,
    testRunId: string,
    targetUrl: string,
    policy: SecurityPolicyConfig
  ): { check: SecurityCookieCheckResult; finding?: SecurityFinding } {
    const isHttps = targetUrl.toLowerCase().startsWith('https:');
    const isAuthCookie = AUTH_COOKIE_PATTERNS.some((p) => p.test(cookie.name));

    const issues: string[] = [];

    // 1. Check HttpOnly on Auth/Session Cookies
    if (isAuthCookie && policy.cookiePolicy.requireHttpOnlyForAuth && !cookie.httpOnly) {
      issues.push(`Auth/session cookie "${cookie.name}" is missing the HttpOnly flag, leaving it vulnerable to theft via XSS.`);
    }

    // 2. Check Secure Flag on HTTPS
    if (isHttps && policy.cookiePolicy.requireSecureForHttps && !cookie.secure) {
      issues.push(`Cookie "${cookie.name}" is transmitted over HTTPS but is missing the "Secure" attribute.`);
    }

    // 3. Check SameSite Attribute
    if (!cookie.sameSite) {
      issues.push(`Cookie "${cookie.name}" is missing the "SameSite" attribute, potentially exposing it to CSRF.`);
    } else if (cookie.sameSite.toLowerCase() === 'none' && !cookie.secure) {
      issues.push(`Cookie "${cookie.name}" uses SameSite=None without the required Secure attribute.`);
    }

    if (issues.length > 0) {
      const findingType = isAuthCookie && !cookie.httpOnly ? 'INSECURE_COOKIE' : 'COOKIE_MISSING_SECURITY_ATTRIBUTE';
      const severity = isAuthCookie ? 'medium' : 'low';
      const reason = issues.join(' ');

      const check: SecurityCookieCheckResult = {
        cookieName: cookie.name,
        path: cookie.path,
        domain: cookie.domain,
        httpOnly: !!cookie.httpOnly,
        secure: !!cookie.secure,
        sameSite: cookie.sameSite,
        isAuthCookie,
        status: 'FAILED',
        findingType,
        severity,
        reason,
      };

      const fingerprint = computeBugFingerprint({
        projectId,
        url: cookie.path || '/',
        bugType: findingType,
        action: cookie.name,
        errorSignature: reason,
      });

      const finding: SecurityFinding = {
        id: `sec_cookie_${fingerprint.substring(0, 12)}_${Date.now()}`,
        type: findingType,
        severity,
        confidence: 'HIGH',
        targetUrl,
        targetPath: cookie.path || '/',
        title: `Cookie Security Weakness: [${cookie.name}]`,
        summary: reason,
        description: `Inspected cookie metadata for "${cookie.name}". Flags: HttpOnly=${!!cookie.httpOnly}, Secure=${!!cookie.secure}, SameSite=${cookie.sameSite || 'NONE'}. Issues: ${reason}`,
        whyItMatters: 'Improperly secured cookies can be accessed by malicious client scripts (XSS) or attached to unintended cross-site requests (CSRF).',
        remediationRecommendation: `Set "HttpOnly", "Secure", and "SameSite=Lax" (or "Strict") on the "${cookie.name}" cookie.`,
        evidenceSummary: `Cookie Name: ${cookie.name} | HttpOnly: ${!!cookie.httpOnly} | Secure: ${!!cookie.secure} | SameSite: ${cookie.sameSite || 'NONE'} | Issue: ${reason}`,
        fingerprint,
        detectedAt: new Date().toISOString(),
      };

      return { check, finding };
    }

    const check: SecurityCookieCheckResult = {
      cookieName: cookie.name,
      path: cookie.path,
      domain: cookie.domain,
      httpOnly: !!cookie.httpOnly,
      secure: !!cookie.secure,
      sameSite: cookie.sameSite,
      isAuthCookie,
      status: 'PASSED',
    };

    return { check };
  }
}
