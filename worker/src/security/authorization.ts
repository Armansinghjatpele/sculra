// ==============================================================================
// Sculra Security Authorization & Access Control Checker (worker/src/security/authorization.ts)
// ==============================================================================
// Evaluates authentication requirements and role-based access control boundaries
// (ADMIN vs MEMBER vs UNAUTHENTICATED) against protected pages and APIs.

import {
  SecurityAuthCheckResult,
  SecurityFinding,
  SecurityTarget,
  SecurityPolicyConfig,
  SecurityFindingType,
} from './types';
import { ApiExecutor } from '../api-qa/executor';
import { ApiRequestDefinition, ApiResponseObservation } from '../api-qa/types';
import { TestIdentity, AuthenticatedSession } from '../auth/types';
import { computeBugFingerprint } from '../issues/fingerprint';
import { WorkerLogger } from '../logger';
import { CancellationToken } from '../types';

export interface SecurityAuthCheckParams {
  executor: ApiExecutor;
  targetUrl: string;
  targets: SecurityTarget[];
  identities: TestIdentity[];
  sessions: AuthenticatedSession[];
  projectId: string;
  testRunId: string;
  policy: SecurityPolicyConfig;
  logger?: WorkerLogger;
  cancellationToken?: CancellationToken;
}

export class SecurityAuthorizationChecker {
  /**
   * Evaluates authentication barriers and role boundaries for all security targets.
   */
  static async evaluateAuthBoundaries(
    params: SecurityAuthCheckParams
  ): Promise<{ checks: SecurityAuthCheckResult[]; findings: SecurityFinding[] }> {
    const {
      executor,
      targetUrl,
      targets,
      identities,
      sessions,
      projectId,
      testRunId,
      policy,
      logger,
      cancellationToken,
    } = params;

    const checks: SecurityAuthCheckResult[] = [];
    const findings: SecurityFinding[] = [];

    const protectedTargets = targets.filter(
      (t) => t.requiredAuthentication || t.requiredRole || t.type === 'PROTECTED_ROUTE' || t.type === 'PROTECTED_API' || t.type === 'ADMIN_SURFACE'
    );

    let checkCount = 0;

    for (const target of protectedTargets) {
      if (cancellationToken?.isCancelled || checkCount >= policy.maxAuthorizationChecks) break;

      const path = target.path;
      const isApi = target.type === 'PROTECTED_API' || path.startsWith('/api/') || path.startsWith('/api');
      const restrictedRole = target.requiredRole || (path.includes('/admin') ? 'ADMIN' : 'MEMBER');

      // ------------------------------------------------------------------------
      // 1. Check Unauthenticated Access (Expect 401/403 or redirect to login)
      // ------------------------------------------------------------------------
      checkCount++;
      const unauthRequest: ApiRequestDefinition = {
        endpointId: target.id,
        method: target.method,
        url: target.url,
        headers: {}, // No credentials
        role: 'UNAUTHENTICATED',
      };

      const unauthObs = await executor.execute(unauthRequest, {
        allowLocalhost: true,
        explicitlySafe: true,
        logger,
        cancellationToken,
      });

      const isDenied = unauthObs.status === 401 || unauthObs.status === 403 || unauthObs.status === 302 || unauthObs.status === 301;
      const isAllowed = unauthObs.status >= 200 && unauthObs.status < 300;

      if (isAllowed) {
        const findingType: SecurityFindingType = isApi
          ? 'PUBLICLY_ACCESSIBLE_PROTECTED_API'
          : 'PUBLICLY_ACCESSIBLE_PROTECTED_ROUTE';
        const severity = isApi ? 'high' : 'high';
        const reason = `Protected endpoint "${path}" was accessible without authentication (HTTP ${unauthObs.status}).`;

        checks.push({
          targetPath: path,
          method: target.method,
          targetType: isApi ? 'API' : 'ROUTE',
          testedRole: 'UNAUTHENTICATED',
          restrictedToRole: restrictedRole,
          expectedAccess: 'DENIED',
          observedAccess: 'ALLOWED',
          statusCode: unauthObs.status,
          finalUrl: unauthObs.url,
          status: 'FAILED',
          findingType,
          severity,
          isUnauthorizedAccess: true,
          evidence: [`Unauthenticated request received HTTP ${unauthObs.status} instead of expected 401/403.`],
        });

        const fingerprint = computeBugFingerprint({
          projectId,
          url: path,
          bugType: findingType,
          action: target.method,
          errorSignature: reason,
        });

        findings.push({
          id: `sec_auth_unauth_${fingerprint.substring(0, 12)}_${Date.now()}`,
          type: findingType,
          severity,
          confidence: 'HIGH',
          targetUrl: target.url,
          targetPath: path,
          method: target.method,
          role: 'UNAUTHENTICATED',
          title: `Authentication Bypass / Public Route: ${target.method} ${path}`,
          summary: reason,
          description: `An unauthenticated request to "${path}" returned HTTP ${unauthObs.status}, exposing protected functionality without authentication challenge.`,
          whyItMatters: 'Failing to enforce authentication on private routes or API endpoints allows anonymous external parties to view private data or access administrative resources.',
          remediationRecommendation: 'Enforce authentication middleware on this route (return HTTP 401/403 or redirect to /login).',
          evidenceSummary: `URL: ${target.url} | Role: UNAUTHENTICATED | Observed Status: HTTP ${unauthObs.status} | Issue: ${reason}`,
          fingerprint,
          detectedAt: new Date().toISOString(),
        });
      } else {
        checks.push({
          targetPath: path,
          method: target.method,
          targetType: isApi ? 'API' : 'ROUTE',
          testedRole: 'UNAUTHENTICATED',
          restrictedToRole: restrictedRole,
          expectedAccess: 'DENIED',
          observedAccess: 'DENIED',
          statusCode: unauthObs.status,
          finalUrl: unauthObs.url,
          status: 'PASSED',
          isUnauthorizedAccess: false,
          evidence: [`Unauthenticated access properly denied with HTTP ${unauthObs.status}.`],
        });
      }

      // ------------------------------------------------------------------------
      // 2. Check Vertical Privilege Escalation (MEMBER accessing ADMIN resource)
      // ------------------------------------------------------------------------
      if (restrictedRole.toUpperCase() === 'ADMIN' && checkCount < policy.maxAuthorizationChecks) {
        checkCount++;
        const memberSession = sessions.find((s) => s.role.toUpperCase() === 'MEMBER' && s.authenticated);
        const memberHeaders: Record<string, string> = {};

        if (memberSession?.cookies && memberSession.cookies.length > 0) {
          memberHeaders['Cookie'] = memberSession.cookies.map((c) => `${c.name}=${c.value}`).join('; ');
        } else {
          memberHeaders['Cookie'] = 'sculra_auth=member-token';
        }

        const memberRequest: ApiRequestDefinition = {
          endpointId: target.id,
          method: target.method,
          url: target.url,
          headers: memberHeaders,
          role: 'MEMBER',
        };

        const memberObs = await executor.execute(memberRequest, {
          allowLocalhost: true,
          explicitlySafe: true,
          logger,
          cancellationToken,
        });

        const memberDenied = memberObs.status === 401 || memberObs.status === 403;
        const memberAllowed = memberObs.status >= 200 && memberObs.status < 300;

        if (memberAllowed) {
          const findingType: SecurityFindingType = 'PRIVILEGE_ESCALATION';
          const severity = 'critical';
          const reason = `Role "MEMBER" was granted unauthorized access to administrator endpoint "${path}" (HTTP ${memberObs.status}).`;

          checks.push({
            targetPath: path,
            method: target.method,
            targetType: isApi ? 'API' : 'ROUTE',
            testedRole: 'MEMBER',
            restrictedToRole: 'ADMIN',
            expectedAccess: 'DENIED',
            observedAccess: 'ALLOWED',
            statusCode: memberObs.status,
            finalUrl: memberObs.url,
            status: 'FAILED',
            findingType,
            severity,
            isUnauthorizedAccess: true,
            evidence: [`MEMBER role received HTTP ${memberObs.status} on ADMIN route ${path}.`],
          });

          const fingerprint = computeBugFingerprint({
            projectId,
            url: path,
            bugType: findingType,
            action: target.method,
            errorSignature: reason,
          });

          findings.push({
            id: `sec_priv_esc_${fingerprint.substring(0, 12)}_${Date.now()}`,
            type: findingType,
            severity,
            confidence: 'HIGH',
            targetUrl: target.url,
            targetPath: path,
            method: target.method,
            role: 'MEMBER',
            title: `Critical Privilege Escalation: MEMBER -> ${target.method} ${path}`,
            summary: reason,
            description: `A standard "MEMBER" role identity successfully accessed administrative endpoint "${path}" receiving HTTP ${memberObs.status}.`,
            whyItMatters: 'Privilege escalation vulnerabilities allow unprivileged users to perform administrative actions, access restricted tenant data, or alter platform settings.',
            remediationRecommendation: 'Implement server-side role authorization checks verifying administrator privileges before processing requests.',
            evidenceSummary: `URL: ${target.url} | Tested Role: MEMBER | Required Role: ADMIN | Observed: HTTP ${memberObs.status} | Issue: ${reason}`,
            fingerprint,
            detectedAt: new Date().toISOString(),
          });
        } else {
          checks.push({
            targetPath: path,
            method: target.method,
            targetType: isApi ? 'API' : 'ROUTE',
            testedRole: 'MEMBER',
            restrictedToRole: 'ADMIN',
            expectedAccess: 'DENIED',
            observedAccess: 'DENIED',
            statusCode: memberObs.status,
            finalUrl: memberObs.url,
            status: 'PASSED',
            isUnauthorizedAccess: false,
            evidence: [`MEMBER role access properly denied with HTTP ${memberObs.status}.`],
          });
        }
      }

      // ------------------------------------------------------------------------
      // 3. Check Privileged Role Access (ADMIN should be allowed 200)
      // ------------------------------------------------------------------------
      if (restrictedRole.toUpperCase() === 'ADMIN' && checkCount < policy.maxAuthorizationChecks) {
        checkCount++;
        const adminSession = sessions.find((s) => s.role.toUpperCase() === 'ADMIN' && s.authenticated);
        const adminHeaders: Record<string, string> = {};

        if (adminSession?.cookies && adminSession.cookies.length > 0) {
          adminHeaders['Cookie'] = adminSession.cookies.map((c) => `${c.name}=${c.value}`).join('; ');
        } else {
          adminHeaders['Cookie'] = 'sculra_auth=admin-token';
        }

        const adminRequest: ApiRequestDefinition = {
          endpointId: target.id,
          method: target.method,
          url: target.url,
          headers: adminHeaders,
          role: 'ADMIN',
        };

        const adminObs = await executor.execute(adminRequest, {
          allowLocalhost: true,
          explicitlySafe: true,
          logger,
          cancellationToken,
        });

        const adminAllowed = adminObs.status >= 200 && adminObs.status < 400;

        if (adminAllowed) {
          checks.push({
            targetPath: path,
            method: target.method,
            targetType: isApi ? 'API' : 'ROUTE',
            testedRole: 'ADMIN',
            restrictedToRole: 'ADMIN',
            expectedAccess: 'ALLOWED',
            observedAccess: 'ALLOWED',
            statusCode: adminObs.status,
            finalUrl: adminObs.url,
            status: 'PASSED',
            isUnauthorizedAccess: false,
            evidence: [`ADMIN role access verified with HTTP ${adminObs.status}.`],
          });
        } else {
          checks.push({
            targetPath: path,
            method: target.method,
            targetType: isApi ? 'API' : 'ROUTE',
            testedRole: 'ADMIN',
            restrictedToRole: 'ADMIN',
            expectedAccess: 'ALLOWED',
            observedAccess: 'DENIED',
            statusCode: adminObs.status,
            finalUrl: adminObs.url,
            status: 'FAILED',
            findingType: isApi ? 'API_AUTHORIZATION_FAILURE' : 'AUTHORIZATION_DENIED',
            severity: 'high',
            isUnauthorizedAccess: false,
            evidence: [`ADMIN role unexpectedly denied access with HTTP ${adminObs.status}.`],
          });
        }
      }
    }

    return { checks, findings };
  }
}
