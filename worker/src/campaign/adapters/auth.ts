// ==============================================================================
// Sculra Authentication & Authorization Adapter (worker/src/campaign/adapters/auth.ts)
// ==============================================================================

import { BrowserContext } from 'playwright';
import { CampaignTask, CampaignTaskResult } from '../types';
import {
  FormLoginEngine,
  AuthorizationEvaluator,
  AuthenticatedSession,
  RoleContext,
  AuthorizationCheckResult,
  EnvironmentSecretProvider,
  TestIdentity,
  AuthorizationCheckConfig,
} from '../../auth';
import { ApplicationMap } from '../../types';

export class AuthAdapter {
  static async execute(
    task: CampaignTask,
    context: BrowserContext,
    targetUrl: string,
    options: {
      testIdentities?: TestIdentity[];
      authorizationChecks?: AuthorizationCheckConfig[];
      appMap?: ApplicationMap;
      secretProvider?: EnvironmentSecretProvider;
    } = {}
  ): Promise<CampaignTaskResult> {
    const startTime = Date.now();
    try {
      const sessions: AuthenticatedSession[] = [];
      const roleContexts: RoleContext[] = [];
      const authChecks: AuthorizationCheckResult[] = [];
      const secretProvider = options.secretProvider || new EnvironmentSecretProvider();

      // 1. If identities configured, login and capture session states
      if (options.testIdentities && options.testIdentities.length > 0) {
        for (const identity of options.testIdentities) {
          try {
            const session = await FormLoginEngine.login(context, identity, secretProvider);
            if (session) {
              sessions.push(session);
              roleContexts.push({
                identityId: identity.id,
                roleId: identity.role.toLowerCase(),
                roleName: identity.role,
                authenticated: session.authenticated,
                capabilities: [],
                workflowIds: [],
                discoveredPageUrls: session.finalUrl ? [session.finalUrl] : [targetUrl],
              });
            }
          } catch {
            // Soft failure on login test
          }
        }
      }

      // 2. Evaluate Authorization Checks if configured
      if (options.authorizationChecks && options.authorizationChecks.length > 0) {
        for (const check of options.authorizationChecks) {
          const res = await AuthorizationEvaluator.evaluateCheck(context, targetUrl, check);
          authChecks.push(res);
        }
      }

      const hasAuthViolations = authChecks.some((c) => c.status === 'FAILED' || c.isUnauthorizedAccess);

      return {
        taskId: task.id,
        status: hasAuthViolations ? 'FAILED' : 'PASSED',
        target: task.target,
        domain: 'AUTHORIZATION',
        findings: authChecks.filter((c) => c.status === 'FAILED' || c.isUnauthorizedAccess),
        evidence: [
          ...sessions.map((s) => ({
            type: 'authenticated_session',
            title: `Authenticated Session: ${s.role}`,
            url: targetUrl,
            metadata: { session: s },
          })),
          ...authChecks.map((c) => ({
            type: c.status === 'PASSED' ? 'authorization_check' : 'unauthorized_access',
            title: `Auth Check: ${c.role} -> ${c.path} (${c.status})`,
            url: c.finalUrl || targetUrl,
            metadata: { authorizationCheck: c },
          })),
        ],
        observations: [],
        durationMs: Date.now() - startTime,
        coverage: {
          rulesAudited: authChecks.length + sessions.length,
        },
        metadata: { sessions, roleContexts, authChecks },
      };
    } catch (err: any) {
      return {
        taskId: task.id,
        status: 'FAILED',
        target: task.target,
        domain: 'AUTHORIZATION',
        findings: [],
        evidence: [],
        observations: [],
        durationMs: Date.now() - startTime,
        error: err.message || 'Authorization QA execution failed',
      };
    }
  }
}

