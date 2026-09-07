// ==============================================================================
// Sculra Deterministic Authorization Evaluator (worker/src/auth/authorization.ts)
// ==============================================================================
// Evaluates role authorization boundaries and detects unauthorized access violations.

import { BrowserContext, Page } from 'playwright';
import { AuthorizationCheckConfig, AuthorizationCheckResult } from './types';
import { WorkerLogger } from '../logger';

export class AuthorizationEvaluator {
  /**
   * Evaluates a deterministic authorization check against a target endpoint within an isolated role context.
   */
  public static async evaluateCheck(
    context: BrowserContext,
    baseUrl: string,
    check: AuthorizationCheckConfig,
    logger?: WorkerLogger
  ): Promise<AuthorizationCheckResult> {
    const evidence: string[] = [];
    const checkedAt = new Date().toISOString();
    let page: Page | null = null;

    const targetPath = check.path.startsWith('/') ? check.path : `/${check.path}`;
    const targetUrl = new URL(targetPath, baseUrl).toString();

    try {
      page = await context.newPage();
      page.setDefaultNavigationTimeout(10000);
      page.setDefaultTimeout(10000);

      evidence.push(`Testing authorization on ${targetUrl} for role "${check.role}" (expected: ${check.expectedAccess})`);

      const response = await page.goto(targetUrl, { waitUntil: 'load', timeout: 10000 }).catch((err) => {
        evidence.push(`Navigation failed or timed out: ${err.message}`);
        return null;
      });

      const statusCode = response ? response.status() : undefined;
      const finalUrl = page.url();
      const bodyText = (await page.textContent('body').catch(() => '')) || '';

      // 1. Evaluate Observed Access
      let observedAccess: 'ALLOWED' | 'DENIED' | 'ERROR' = 'ALLOWED';
      let denialReason: string | undefined;

      // Check A: HTTP status 401 / 403
      if (statusCode === 401 || statusCode === 403) {
        observedAccess = 'DENIED';
        denialReason = `HTTP ${statusCode} ${statusCode === 401 ? 'Unauthorized' : 'Forbidden'}`;
        evidence.push(`Server returned explicit access denial: HTTP ${statusCode}`);
      }
      // Check B: Redirect away to safe login or access-denied page
      else if (
        finalUrl.includes('/login') ||
        finalUrl.includes('/sign-in') ||
        finalUrl.includes('/unauthorized') ||
        finalUrl.includes('/403') ||
        (check.expectedRedirectUrl && finalUrl.includes(check.expectedRedirectUrl))
      ) {
        observedAccess = 'DENIED';
        denialReason = `Redirected to safe auth/denial route: ${finalUrl}`;
        evidence.push(`Application redirected to safe page: ${finalUrl}`);
      }
      // Check C: In-page Access Denied / Forbidden text markers
      else if (
        /\baccess denied\b|\bpermission denied\b|\b403 forbidden\b|\b401 unauthorized\b|\byou do not have permission\b|\byou do not have access\b|\bnot authorized to access\b/i.test(bodyText)
      ) {
        observedAccess = 'DENIED';
        denialReason = 'DOM rendered explicit access-denied text.';
        evidence.push('Page content contains access-denied UI message.');
      } else if (!response || (statusCode && statusCode >= 500)) {
        observedAccess = 'ERROR';
        denialReason = `Server error HTTP ${statusCode || 'timeout'}`;
      } else {
        observedAccess = 'ALLOWED';
        evidence.push(`Access granted (HTTP ${statusCode}, URL: ${finalUrl})`);
      }

      // 2. Determine Pass/Fail Status & Unauthorized Access Violation
      const isUnauthorizedAccess = check.expectedAccess === 'DENIED' && observedAccess === 'ALLOWED';
      const status: 'PASSED' | 'FAILED' = isUnauthorizedAccess || (check.expectedAccess === 'ALLOWED' && observedAccess === 'DENIED')
        ? 'FAILED'
        : 'PASSED';

      if (isUnauthorizedAccess) {
        logger?.warn('unauthorized_access_detected', {
          role: check.role,
          targetPath: check.path,
          finalUrl,
          statusCode,
        });
        evidence.push(`SECURITY VIOLATION: Role "${check.role}" was granted unauthorized access to protected path "${check.path}"!`);
      } else {
        logger?.log('authorization_check_completed', {
          role: check.role,
          targetPath: check.path,
          status,
          observedAccess,
        });
      }

      return {
        name: check.name,
        path: check.path,
        role: check.role,
        expectedAccess: check.expectedAccess,
        observedAccess,
        status,
        statusCode,
        finalUrl,
        denialReason,
        isUnauthorizedAccess,
        evidence,
        checkedAt,
      };
    } catch (err: any) {
      return {
        name: check.name,
        path: check.path,
        role: check.role,
        expectedAccess: check.expectedAccess,
        observedAccess: 'ERROR',
        status: 'FAILED',
        denialReason: `Evaluation exception: ${err.message}`,
        isUnauthorizedAccess: false,
        evidence: [...evidence, `Evaluation exception: ${err.message}`],
        checkedAt,
      };
    } finally {
      if (page) {
        await page.close().catch(() => {});
      }
    }
  }
}
