// ==============================================================================
// Sculra Deterministic Security Target Discovery (worker/src/security/discovery.ts)
// ==============================================================================
// Discovers, classifies, and bounds all security test targets across application pages,
// APIs, role surfaces, headers, cookies, CORS, redirects, and data exposure boundaries.

import { SecurityTarget, SecurityTargetType, SecurityPolicyConfig } from './types';
import { ApplicationMap } from '../types';
import { ApiEndpoint } from '../api-qa/types';
import { RoleContext, TestIdentity, AuthenticatedSession } from '../auth/types';
import { REDIRECT_PARAM_CANDIDATES } from './policy';
import { WorkerLogger } from '../logger';

export interface SecurityDiscoveryParams {
  targetUrl: string;
  applicationMap?: ApplicationMap;
  apiEndpoints?: ApiEndpoint[];
  roleContexts?: RoleContext[];
  testIdentities?: TestIdentity[];
  authenticatedSessions?: AuthenticatedSession[];
  explicitTargets?: Array<{ path: string; method?: string; requiredRole?: string; isProtected?: boolean }>;
  policy: SecurityPolicyConfig;
  logger?: WorkerLogger;
}

export class SecurityTargetDiscovery {
  /**
   * Deterministically aggregates security targets from all discovered application artifacts.
   */
  static discoverTargets(params: SecurityDiscoveryParams): SecurityTarget[] {
    const {
      targetUrl,
      applicationMap,
      apiEndpoints = [],
      roleContexts = [],
      testIdentities = [],
      authenticatedSessions = [],
      explicitTargets = [],
      policy,
      logger,
    } = params;

    const targetsMap = new Map<string, SecurityTarget>();
    const baseOrigin = new URL(targetUrl).origin;

    const addTarget = (target: SecurityTarget) => {
      if (targetsMap.size >= policy.maxSecurityTargets) return;
      if (!targetsMap.has(target.id)) {
        targetsMap.set(target.id, target);
      }
    };

    // 1. Discover targets from Explicit Targets
    for (const exp of explicitTargets) {
      const path = exp.path.startsWith('/') ? exp.path : `/${exp.path}`;
      const url = new URL(path, targetUrl).toString();
      const isApi = path.startsWith('/api/') || path.startsWith('/api');
      const isProtected = exp.isProtected ?? (!!exp.requiredRole || path.includes('/admin'));
      const id = `sec_exp_${(exp.method || 'GET').toLowerCase()}_${path.replace(/[^a-zA-Z0-9]/g, '_')}`;

      addTarget({
        id,
        type: isProtected ? (isApi ? 'PROTECTED_API' : 'PROTECTED_ROUTE') : 'PUBLIC_ROUTE',
        path,
        url,
        method: (exp.method?.toUpperCase() as any) || 'GET',
        requiredAuthentication: isProtected,
        requiredRole: exp.requiredRole || (path.includes('/admin') ? 'ADMIN' : undefined),
        source: 'PROJECT_CONFIG',
        confidence: 1.0,
        safeToTest: true,
        description: `Explicit project security target: ${path}`,
      });
    }

    // 2. Discover targets from ApplicationMap (Pages, Forms, Links)
    if (applicationMap) {
      for (const page of applicationMap.pages) {
        const parsed = new URL(page.url, targetUrl);
        const path = parsed.pathname;
        const isAdmin = path.toLowerCase().startsWith('/admin');
        const isLogin = path.toLowerCase().includes('/login') || path.toLowerCase().includes('/auth');
        const isPublic = !isAdmin && (path === '/' || isLogin || path.includes('/public') || path.includes('/features') || path.includes('/pricing'));
        const isProtected = !isPublic;

        const targetType: SecurityTargetType = isAdmin
          ? 'ADMIN_SURFACE'
          : isProtected
          ? 'PROTECTED_ROUTE'
          : 'PUBLIC_ROUTE';

        const id = `sec_page_${path.replace(/[^a-zA-Z0-9]/g, '_') || 'root'}`;
        addTarget({
          id,
          type: targetType,
          path,
          url: page.url,
          method: 'GET',
          requiredAuthentication: isProtected,
          requiredRole: isAdmin ? 'ADMIN' : undefined,
          source: 'DISCOVERY',
          confidence: 0.9,
          safeToTest: true,
          description: `Discovered page route: ${path}`,
        });

        // Check for redirect candidate parameters on page URL
        for (const [paramKey, paramVal] of parsed.searchParams.entries()) {
          if (REDIRECT_PARAM_CANDIDATES.includes(paramKey.toLowerCase())) {
            const redId = `sec_redirect_page_${path.replace(/[^a-zA-Z0-9]/g, '_')}_${paramKey}`;
            addTarget({
              id: redId,
              type: 'REDIRECT_ENDPOINT',
              path,
              url: page.url,
              method: 'GET',
              requiredAuthentication: false,
              source: 'DOM_ANALYSIS',
              confidence: 0.85,
              safeToTest: true,
              description: `Redirect parameter candidate "${paramKey}" on ${path}`,
              metadata: { parameterName: paramKey, originalValue: paramVal },
            });
          }
        }
      }
    }

    // 3. Discover targets from Role Contexts (Routes accessible only by specific roles)
    for (const rc of roleContexts) {
      const roleUpper = rc.roleName?.toUpperCase() || (rc.capabilities.includes('Admin') ? 'ADMIN' : 'MEMBER');
      for (const rUrl of rc.discoveredPageUrls || []) {
        const parsed = new URL(rUrl, targetUrl);
        const path = parsed.pathname;
        const id = `sec_role_${roleUpper.toLowerCase()}_${path.replace(/[^a-zA-Z0-9]/g, '_')}`;

        addTarget({
          id,
          type: roleUpper === 'ADMIN' ? 'ADMIN_SURFACE' : 'PROTECTED_ROUTE',
          path,
          url: rUrl,
          method: 'GET',
          requiredAuthentication: true,
          requiredRole: roleUpper,
          source: 'AUTH_CONTEXT',
          confidence: 0.95,
          safeToTest: true,
          description: `Role-authenticated route for ${roleUpper}: ${path}`,
        });
      }
    }

    // 4. Discover targets from ApiEndpoints (APIs, CORS, Protected APIs)
    for (const ep of apiEndpoints) {
      const isAuthRequired = !!ep.isAuthorizationBoundary || !!ep.expectedRole || ep.path.toLowerCase().startsWith('/api/admin') || ep.path.toLowerCase().includes('/member') || ep.path.toLowerCase().includes('/me');
      const isAdmin = ep.path.toLowerCase().startsWith('/api/admin') || ep.expectedRole?.toUpperCase() === 'ADMIN';

      const id = `sec_api_${ep.method.toLowerCase()}_${ep.path.replace(/[^a-zA-Z0-9]/g, '_')}`;
      addTarget({
        id,
        type: isAdmin ? 'ADMIN_SURFACE' : isAuthRequired ? 'PROTECTED_API' : 'PROTECTED_API',
        path: ep.path,
        url: ep.url,
        method: ep.method,
        requiredAuthentication: isAuthRequired,
        requiredRole: ep.expectedRole || (isAdmin ? 'ADMIN' : undefined),
        source: ep.source === 'OPENAPI' ? 'OPENAPI' : 'DISCOVERY',
        confidence: ep.confidence || 0.9,
        safeToTest: !ep.requiresExplicitSafeConfig,
        description: `API endpoint: ${ep.method} ${ep.path}`,
      });

      // API endpoints are also CORS targets
      const corsId = `sec_cors_${ep.method.toLowerCase()}_${ep.path.replace(/[^a-zA-Z0-9]/g, '_')}`;
      addTarget({
        id: corsId,
        type: 'CORS_ENDPOINT',
        path: ep.path,
        url: ep.url,
        method: ep.method,
        requiredAuthentication: false,
        source: ep.source === 'OPENAPI' ? 'OPENAPI' : 'DISCOVERY',
        confidence: 0.9,
        safeToTest: true,
        description: `CORS evaluation target on ${ep.method} ${ep.path}`,
      });

      // Check if API endpoint is a redirect candidate
      const isRedirectCandidate =
        ep.path.toLowerCase().includes('redirect') ||
        ep.parameters?.some((p) => REDIRECT_PARAM_CANDIDATES.includes(p.name.toLowerCase()));

      if (isRedirectCandidate) {
        const matchingParam =
          ep.parameters?.find((p) => REDIRECT_PARAM_CANDIDATES.includes(p.name.toLowerCase()))?.name ||
          'redirect';
        const redirId = `sec_redirect_api_${ep.method.toLowerCase()}_${ep.path.replace(/[^a-zA-Z0-9]/g, '_')}`;
        addTarget({
          id: redirId,
          type: 'REDIRECT_ENDPOINT',
          path: ep.path,
          url: ep.url,
          method: ep.method,
          requiredAuthentication: false,
          source: ep.source === 'OPENAPI' ? 'OPENAPI' : 'DISCOVERY',
          confidence: 0.9,
          safeToTest: true,
          description: `Redirect target on ${ep.method} ${ep.path}`,
          metadata: { parameterName: matchingParam },
        });
      }
    }

    // 5. Ensure Target Root and Login are included
    if (!targetsMap.has('sec_page_root')) {
      addTarget({
        id: 'sec_page_root',
        type: 'PUBLIC_ROUTE',
        path: '/',
        url: targetUrl,
        method: 'GET',
        requiredAuthentication: false,
        source: 'DISCOVERY',
        confidence: 1.0,
        safeToTest: true,
        description: 'Application root entrypoint',
      });
    }

    const discoveredTargets = Array.from(targetsMap.values()).slice(0, policy.maxSecurityTargets);
    logger?.log('security_targets_discovered', { count: discoveredTargets.length });

    return discoveredTargets;
  }
}
