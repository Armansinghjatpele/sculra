// ==============================================================================
// Sculra Master Security Scanner & Autonomous Orchestrator (worker/src/security/scanner.ts)
// ==============================================================================
// Coordinates deterministic security target discovery, HTTP header checks,
// cookie attributes, CORS policies, open redirect probes, sensitive data scans,
// role boundary assertions, and security score resolution.

import {
  SecurityTarget,
  SecurityFinding,
  SecurityHeaderCheckResult,
  SecurityCookieCheckResult,
  SecurityCorsCheckResult,
  SecurityRedirectCheckResult,
  SensitiveExposureCheckResult,
  SecurityAuthCheckResult,
  SecurityCoverageSummary,
  SecurityScanResult,
  SecurityPolicyConfig,
} from './types';
import { DEFAULT_SECURITY_POLICY } from './policy';
import { SecurityTargetDiscovery } from './discovery';
import { SecurityHeaderEvaluator } from './headers';
import { CookieSecurityEvaluator, CookieMetadataInput } from './cookies';
import { CorsSecurityEvaluator } from './cors';
import { RedirectSecurityEvaluator } from './redirects';
import { SensitiveDataExposureEvaluator } from './exposure';
import { SecurityAuthorizationChecker } from './authorization';
import { ApiExecutor } from '../api-qa/executor';
import { ApiEndpoint, ApiResponseObservation } from '../api-qa/types';
import { BugObservation, BugSeverity } from '../issues/types';
import { calculateBugSeverity } from '../issues/severity';
import { ApplicationMap, CancellationToken } from '../types';
import { TestIdentity, AuthenticatedSession, RoleContext } from '../auth/types';
import { WorkerLogger } from '../logger';

export interface SecurityScannerParams {
  testRunId: string;
  projectId: string;
  targetUrl: string;
  applicationMap?: ApplicationMap;
  apiEndpoints?: ApiEndpoint[];
  apiObservations?: ApiResponseObservation[];
  roleContexts?: RoleContext[];
  testIdentities?: TestIdentity[];
  authenticatedSessions?: AuthenticatedSession[];
  explicitTargets?: Array<{ path: string; method?: string; requiredRole?: string; isProtected?: boolean }>;
  policy?: Partial<SecurityPolicyConfig>;
  allowLocalhost?: boolean;
  logger?: WorkerLogger;
  cancellationToken?: CancellationToken;
}

export class SecurityScanner {
  private policy: SecurityPolicyConfig;
  private logger?: WorkerLogger;

  constructor(policy: Partial<SecurityPolicyConfig> = {}, logger?: WorkerLogger) {
    this.policy = { ...DEFAULT_SECURITY_POLICY, ...policy };
    this.logger = logger;
  }

  /**
   * Executes the full deterministic security and authorization QA scan.
   */
  async scan(params: SecurityScannerParams): Promise<SecurityScanResult> {
    const startTime = Date.now();
    const {
      testRunId,
      projectId,
      targetUrl,
      applicationMap,
      apiEndpoints = [],
      apiObservations = [],
      roleContexts = [],
      testIdentities = [],
      authenticatedSessions = [],
      explicitTargets = [],
      allowLocalhost = false,
      cancellationToken,
    } = params;

    this.logger?.log('security_scan_started', { targetUrl, projectId });

    // 1. Discover Security Targets
    const targets = SecurityTargetDiscovery.discoverTargets({
      targetUrl,
      applicationMap,
      apiEndpoints,
      roleContexts,
      testIdentities,
      authenticatedSessions,
      explicitTargets,
      policy: this.policy,
      logger: this.logger,
    });

    const findings: SecurityFinding[] = [];
    const headerChecks: SecurityHeaderCheckResult[] = [];
    const cookieChecks: SecurityCookieCheckResult[] = [];
    const corsChecks: SecurityCorsCheckResult[] = [];
    const redirectChecks: SecurityRedirectCheckResult[] = [];
    const exposureChecks: SensitiveExposureCheckResult[] = [];
    const authChecks: SecurityAuthCheckResult[] = [];
    const bugObservations: BugObservation[] = [];

    const executor = new ApiExecutor({
      allowLocalhost,
      limits: {
        maxEndpoints: this.policy.maxSecurityTargets,
        maxRequestsPerRun: this.policy.maxSecurityRequests,
        maxConcurrentRequests: this.policy.maxConcurrentRequests,
        maxRedirects: this.policy.maxRedirects,
        maxResponseBytes: this.policy.maxResponseBytes,
        requestTimeoutMs: this.policy.requestTimeoutMs,
        maxOpenApiBytes: 2 * 1024 * 1024,
        maxOpenApiEndpoints: 200,
        maxSchemaDepth: 8,
      },
      logger: this.logger,
      cancellationToken,
    });

    const testedTargetIds = new Set<string>();
    const allObservations: ApiResponseObservation[] = [...apiObservations];
    const obsUrls = new Set(allObservations.map((o) => o.url));

    // Probe API endpoints if not already in observations
    for (const ep of apiEndpoints) {
      if (!obsUrls.has(ep.url)) {
        try {
          const obs = await executor.execute(
            {
              endpointId: ep.id,
              method: ep.method,
              url: ep.url,
            },
            { allowLocalhost, explicitlySafe: true, logger: this.logger, cancellationToken }
          );
          allObservations.push(obs);
          obsUrls.add(ep.url);
          testedTargetIds.add(ep.id);
        } catch (err: any) {
          this.logger?.warn('security_endpoint_probe_error', { url: ep.url, error: err.message });
        }
      }
    }

    // ------------------------------------------------------------------------
    // 2. Evaluate Security Headers on Discovered Endpoints / API Observations
    // ------------------------------------------------------------------------
    if (this.policy.enableHeaderChecks && !cancellationToken?.isCancelled) {
      // Evaluate from all API observations
      for (const obs of allObservations) {
        const headerEval = SecurityHeaderEvaluator.evaluateHeaders(
          {
            url: obs.url,
            statusCode: obs.status,
            headers: obs.safeHeaders || {},
            isHtml: false,
          },
          projectId,
          testRunId
        );
        headerChecks.push(...headerEval.checks);
        findings.push(...headerEval.findings);
      }

      // Also probe root URL if not in observations
      if (allObservations.length === 0 || !allObservations.some((o) => o.url === targetUrl)) {
        try {
          const rootObs = await executor.execute(
            {
              endpointId: 'sec_root',
              method: 'GET',
              url: targetUrl,
            },
            { allowLocalhost, explicitlySafe: true, logger: this.logger, cancellationToken }
          );
          allObservations.push(rootObs);

          const headerEval = SecurityHeaderEvaluator.evaluateHeaders(
            {
              url: targetUrl,
              statusCode: rootObs.status,
              headers: rootObs.safeHeaders || {},
              isHtml: true,
            },
            projectId,
            testRunId
          );
          headerChecks.push(...headerEval.checks);
          findings.push(...headerEval.findings);
          testedTargetIds.add('sec_page_root');
        } catch (err: any) {
          this.logger?.warn('security_root_header_check_error', { error: err.message });
        }
      }
    }

    // ------------------------------------------------------------------------
    // 3. Evaluate Cookie Security (From Authenticated Sessions & Set-Cookie headers)
    // ------------------------------------------------------------------------
    if (this.policy.enableCookieChecks && !cancellationToken?.isCancelled) {
      const seenCookies = new Set<string>();

      // Check session cookies from authenticated sessions
      for (const session of authenticatedSessions) {
        for (const cookie of session.cookies || []) {
          if (!seenCookies.has(cookie.name)) {
            seenCookies.add(cookie.name);
            const cookieEval = CookieSecurityEvaluator.evaluateCookie(
              {
                name: cookie.name,
                httpOnly: (cookie as any).httpOnly ?? false,
                secure: (cookie as any).secure ?? false,
                sameSite: (cookie as any).sameSite,
                path: cookie.path,
                domain: cookie.domain,
              },
              projectId,
              testRunId,
              targetUrl,
              this.policy
            );
            cookieChecks.push(cookieEval.check);
            if (cookieEval.finding) findings.push(cookieEval.finding);
          }
        }
      }

      // Check cookies from response observations (Set-Cookie headers)
      for (const obs of allObservations) {
        for (const rawCookie of obs.rawSetCookies || []) {
          const parsed = CookieSecurityEvaluator.parseSetCookieHeader(rawCookie);
          if (!seenCookies.has(parsed.name)) {
            seenCookies.add(parsed.name);
            const cookieEval = CookieSecurityEvaluator.evaluateCookie(
              parsed,
              projectId,
              testRunId,
              obs.url,
              this.policy
            );
            cookieChecks.push(cookieEval.check);
            if (cookieEval.finding) findings.push(cookieEval.finding);
          }
        }
      }
    }

    // ------------------------------------------------------------------------
    // 4. Evaluate CORS Configurations (On CORS targets)
    // ------------------------------------------------------------------------
    if (this.policy.enableCorsChecks && !cancellationToken?.isCancelled) {
      const corsTargets = targets.filter((t) => t.type === 'CORS_ENDPOINT').slice(0, 10);
      const testOrigin = 'https://untrusted-origin.example.com';

      for (const ct of corsTargets) {
        if (cancellationToken?.isCancelled) break;
        testedTargetIds.add(ct.id);

        try {
          const corsObs = await executor.execute(
            {
              endpointId: ct.id,
              method: ct.method,
              url: ct.url,
              headers: {
                Origin: testOrigin,
              },
            },
            { allowLocalhost, explicitlySafe: true, logger: this.logger, cancellationToken }
          );

          const corsEval = CorsSecurityEvaluator.evaluateCorsResponse(
            {
              url: ct.url,
              statusCode: corsObs.status,
              testOrigin,
              headers: corsObs.safeHeaders || {},
            },
            projectId,
            testRunId,
            this.policy
          );
          corsChecks.push(corsEval.check);
          if (corsEval.finding) findings.push(corsEval.finding);
        } catch (err: any) {
          this.logger?.warn('security_cors_check_error', { error: err.message });
        }
      }
    }

    // ------------------------------------------------------------------------
    // 5. Evaluate Open Redirects (On Redirect Candidate Targets)
    // ------------------------------------------------------------------------
    if (this.policy.enableRedirectChecks && !cancellationToken?.isCancelled) {
      const redirectTargets = targets.filter((t) => t.type === 'REDIRECT_ENDPOINT').slice(0, 5);

      for (const rt of redirectTargets) {
        if (cancellationToken?.isCancelled) break;
        testedTargetIds.add(rt.id);

        const paramName = rt.metadata?.parameterName || 'redirect';
        const sentinelUrl = this.policy.redirectPolicy.safeSentinelUrl;
        const probeUrl = new URL(rt.path, targetUrl);
        probeUrl.searchParams.set(paramName, sentinelUrl);

        try {
          const redirObs = await executor.execute(
            {
              endpointId: rt.id,
              method: 'GET',
              url: probeUrl.toString(),
            },
            { allowLocalhost, explicitlySafe: true, followRedirects: false, logger: this.logger, cancellationToken }
          );

          const locationHeader = redirObs.safeHeaders?.['location'] || redirObs.safeHeaders?.['Location'];
          const redirEval = RedirectSecurityEvaluator.evaluateRedirect(
            {
              url: probeUrl.toString(),
              parameterName: paramName,
              testedRedirectValue: sentinelUrl,
              statusCode: redirObs.status,
              locationHeader,
              finalUrl: redirObs.url,
            },
            projectId,
            testRunId,
            targetUrl,
            this.policy
          );
          redirectChecks.push(redirEval.check);
          if (redirEval.finding) findings.push(redirEval.finding);
        } catch (err: any) {
          this.logger?.warn('security_redirect_check_error', { error: err.message });
        }
      }
    }

    // ------------------------------------------------------------------------
    // 6. Evaluate Sensitive Data & Secret Exposures
    // ------------------------------------------------------------------------
    if (this.policy.enableExposureChecks && !cancellationToken?.isCancelled) {
      // Scan API responses
      for (const obs of allObservations) {
        const contentToScan = obs.rawBody || obs.bodyExcerpt;
        if (contentToScan) {
          const expEval = SensitiveDataExposureEvaluator.scanContent(
            {
              url: obs.url,
              method: obs.method,
              source: 'API_RESPONSE',
              content: contentToScan,
            },
            projectId,
            testRunId
          );
          exposureChecks.push(...expEval.checks);
          findings.push(...expEval.findings);
        }
      }
    }

    // ------------------------------------------------------------------------
    // 7. Evaluate Authentication & Role Boundaries (ADMIN, MEMBER, UNAUTHENTICATED)
    // ------------------------------------------------------------------------
    if (this.policy.enableAuthBoundaryChecks && !cancellationToken?.isCancelled) {
      const authEval = await SecurityAuthorizationChecker.evaluateAuthBoundaries({
        executor,
        targetUrl,
        targets,
        identities: testIdentities,
        sessions: authenticatedSessions,
        projectId,
        testRunId,
        policy: this.policy,
        logger: this.logger,
        cancellationToken,
      });

      authChecks.push(...authEval.checks);
      findings.push(...authEval.findings);

      for (const chk of authEval.checks) {
        testedTargetIds.add(`auth_${chk.targetPath}`);
      }
    }

    // ------------------------------------------------------------------------
    // 8. Convert Security Findings into Structured BugObservations
    // ------------------------------------------------------------------------
    const seenFingerprints = new Set<string>();

    for (const f of findings) {
      if (!seenFingerprints.has(f.fingerprint)) {
        seenFingerprints.add(f.fingerprint);

        const severity = calculateBugSeverity({
          bugType: f.type,
          url: f.targetUrl,
          targetDescription: `${f.method || 'ROUTE'} ${f.targetPath}`,
        });

        bugObservations.push({
          id: `bug_sec_${f.fingerprint.substring(0, 12)}_${Date.now()}`,
          testRunId,
          projectId,
          type: f.type,
          severity,
          confidence: f.confidence === 'HIGH' ? 'high' : f.confidence === 'MEDIUM' ? 'medium' : 'low',
          status: 'open',
          title: `Security Finding: [${f.type}] ${f.title}`,
          summary: f.summary,
          description: `${f.description}\n\nWhy It Matters: ${f.whyItMatters}\nRemediation: ${f.remediationRecommendation}`,
          url: f.targetUrl,
          action: f.method,
          errorSignature: f.summary,
          reproductionSteps: [
            {
              stepNumber: 1,
              action: `SECURITY_CHECK_${f.type}`,
              target: f.targetPath,
              url: f.targetUrl,
              expectedBehavior: 'Compliant security boundary',
              observedBehavior: f.summary,
            },
          ],
          fingerprint: f.fingerprint,
          timestamp: f.detectedAt,
        });
      }
    }

    // ------------------------------------------------------------------------
    // 9. Compute Coverage Summary & Security Score
    // ------------------------------------------------------------------------
    const findingsBySeverity: Record<BugSeverity, number> = {
      critical: findings.filter((f) => f.severity === 'critical').length,
      high: findings.filter((f) => f.severity === 'high').length,
      medium: findings.filter((f) => f.severity === 'medium').length,
      low: findings.filter((f) => f.severity === 'low').length,
      info: findings.filter((f) => f.severity === 'info').length,
    };

    const securityTargetsDiscovered = targets.length;
    const securityTargetsTested = Math.max(
      1,
      headerChecks.length + cookieChecks.length + corsChecks.length + redirectChecks.length + authChecks.length
    );
    const securityCoverageRatio = securityTargetsDiscovered > 0
      ? Math.min(1.0, securityTargetsTested / securityTargetsDiscovered)
      : 1.0;

    // Deterministic Security Score Calculation (100 base minus severity deductions)
    let rawScore = 100;
    rawScore -= findingsBySeverity.critical * 35;
    rawScore -= findingsBySeverity.high * 15;
    rawScore -= findingsBySeverity.medium * 5;
    rawScore -= findingsBySeverity.low * 1;
    const securityScore = Math.max(0, Math.min(100, rawScore));

    const totalChecks =
      headerChecks.length +
      cookieChecks.length +
      corsChecks.length +
      redirectChecks.length +
      exposureChecks.length +
      authChecks.length;

    const coverage: SecurityCoverageSummary = {
      targetsDiscovered: securityTargetsDiscovered,
      checksExecuted: totalChecks,
      findingsCount: findings.length,
      criticalFindings: findingsBySeverity.critical,
      highFindings: findingsBySeverity.high,
      mediumFindings: findingsBySeverity.medium,
      lowFindings: findingsBySeverity.low,
      coverageRatio: securityCoverageRatio,
      securityTargetsDiscovered,
      securityTargetsTested,
      protectedRoutesTested: authChecks.filter((c) => c.targetType === 'ROUTE').length,
      protectedApisTested: authChecks.filter((c) => c.targetType === 'API').length,
      rolesTested: testIdentities.length,
      authorizationChecksCount: authChecks.length,
      headerChecksCount: headerChecks.length,
      cookieChecksCount: cookieChecks.length,
      corsChecksCount: corsChecks.length,
      redirectChecksCount: redirectChecks.length,
      exposureChecksCount: exposureChecks.length,
      securityFindingsCount: findings.length,
      findingsBySeverity,
      securityChecksInconclusive: 0,
      securityCoverageRatio,
      securityScore,
    };

    const durationMs = Date.now() - startTime;

    this.logger?.log('security_scan_completed', {
      targetsDiscovered: securityTargetsDiscovered,
      findingsCount: findings.length,
      criticalFindings: findingsBySeverity.critical,
      highFindings: findingsBySeverity.high,
      securityScore,
      durationMs,
    });

    return {
      targets,
      findings,
      headerChecks,
      cookieChecks,
      corsChecks,
      redirectChecks,
      exposureChecks,
      authChecks,
      coverage,
      securityScore,
      durationMs,
      bugObservations,
    };
  }
}
