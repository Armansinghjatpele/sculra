// ==============================================================================
// Sculra Deterministic Playwright Browser Runner (worker/src/runner.ts)
// ==============================================================================
// Headless browser automation executing deterministic page navigation,
// application discovery, user journey execution, evidence extraction, and status resolution.

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import {
  RunnerOptions,
  TestExecutionResult,
  CapturedConsoleError,
  CapturedNetworkError,
  CapturedScreenshot,
  CancellationToken,
  ApplicationMap,
} from './types';
import {
  validateTargetUrl,
  SecurityScanner,
  SecurityScanResult,
  SecurityFinding,
  SecurityCoverageSummary,
} from './security/index';
import {
  PerformanceScanner,
  PerformanceScanResult,
  PerformanceFinding,
  PerformanceCoverageSummary,
} from './performance';
import { WorkerLogger } from './logger';
import { ApplicationDiscovery } from './discovery';
import { DeterministicJourneyPlanner, JourneyExecutor, JourneyResult } from './journeys';
import { DeterministicIssueClassifier, BugObservation } from './issues';
import { ResponsiveVisualEngine, ResponsiveExecutionResult } from './visual';
import { AIQAOrchestrator, AIQAPlan, AIQAResult } from './ai-qa';
import { ProductModelBuilder, ProductModel, CoverageAgainstProductModel } from './product';
import {
  FormLoginEngine,
  EnvironmentSecretProvider,
  AuthorizationEvaluator,
  RoleComparator,
  AuthenticatedSession,
  RoleContext,
  AuthorizationCheckResult,
  RoleComparisonResult,
  TestIdentity,
} from './auth';
import {
  ApiQAEngine,
  ApiEndpoint,
  ApiTestResult,
  ApiResponseObservation,
  ApiCoverageSummary,
} from './api-qa';

export class BrowserRunner {
  private testRunId: string;
  private projectId?: string;
  private logger: WorkerLogger;
  private options: RunnerOptions;

  constructor(testRunId: string, projectId?: string, options: RunnerOptions = {}) {
    this.testRunId = testRunId;
    this.projectId = projectId;
    this.logger = new WorkerLogger(testRunId, projectId);
    this.options = {
      browserType: (process.env.TEST_BROWSER as any) || options.browserType || 'chromium',
      headless: options.headless ?? true,
      navigationTimeoutMs:
        options.navigationTimeoutMs ??
        (process.env.TEST_NAVIGATION_TIMEOUT_MS
          ? parseInt(process.env.TEST_NAVIGATION_TIMEOUT_MS, 10)
          : 15000),
      runTimeoutMs:
        options.runTimeoutMs ??
        (process.env.TEST_RUN_TIMEOUT_MS
          ? parseInt(process.env.TEST_RUN_TIMEOUT_MS, 10)
          : 30000),
      allowLocalhost: options.allowLocalhost ?? (process.env.NODE_ENV === 'test'),
      enableDiscovery: options.enableDiscovery ?? true,
      enableJourneys: options.enableJourneys ?? true,
      enableVisual: options.enableVisual ?? true,
      enableAiQa: options.enableAiQa ?? true,
      aiQaConfig: options.aiQaConfig,
      authConfig: options.authConfig,
      testIdentities: options.testIdentities,
      authorizationChecks: options.authorizationChecks,
      enableApiQa: options.enableApiQa ?? true,
      apiConfig: options.apiConfig,
      apiLimits: options.apiLimits,
      enableSecurityQa: options.enableSecurityQa ?? true,
      securityPolicy: options.securityPolicy,
      enablePerformanceQa: options.enablePerformanceQa ?? true,
      performancePolicy: options.performancePolicy,
      viewport: options.viewport ?? { width: 1280, height: 720 },
      discoveryLimits: options.discoveryLimits,
    };
  }

  async run(
    targetUrl: string,
    cancellationToken?: CancellationToken
  ): Promise<TestExecutionResult> {
    const startTime = Date.now();
    this.logger.log('test_run_started', { targetUrl });

    // 1. SSRF & Protocol Security Check
    const validation = validateTargetUrl(targetUrl, {
      allowLocalhost: this.options.allowLocalhost,
    });

    if (!validation.valid) {
      const durationMs = Date.now() - startTime;
      this.logger.error('ssrf_validation_failed', validation.error);
      return {
        status: 'failed',
        durationMs,
        consoleErrors: [],
        networkErrors: [],
        screenshots: [],
        failureReason: `Security Violation: ${validation.error}`,
      };
    }

    const safeUrl = validation.sanitizedUrl || targetUrl;
    const consoleErrors: CapturedConsoleError[] = [];
    const networkErrors: CapturedNetworkError[] = [];
    const screenshots: CapturedScreenshot[] = [];

    let browser: Browser | null = null;
    let context: BrowserContext | null = null;
    let page: Page | null = null;
    let pageTitle: string | undefined;
    let finalUrl: string | undefined;
    let statusCode: number | undefined;
    let failureReason: string | undefined;
    let status: 'passed' | 'failed' | 'cancelled' = 'passed';
    let applicationMap: ApplicationMap | undefined;
    let journeyResults: JourneyResult[] | undefined;
    let visualResult: ResponsiveExecutionResult | undefined;
    let aiQaPlans: AIQAPlan[] | undefined;
    let aiQaResults: AIQAResult[] | undefined;
    let aiQaStateSummary: import('./ai-qa/state').AIQAStateSummary | undefined;
    let strategyDecisions: import('./strategy/types').StrategyDecision[] | undefined;
    let strategyTargets: import('./strategy/types').TestTarget[] | undefined;
    let productModel: ProductModel | undefined;
    let productCoverage: CoverageAgainstProductModel | undefined;
    let authenticatedSessions: AuthenticatedSession[] = [];
    let roleContexts: RoleContext[] = [];
    let authorizationResults: AuthorizationCheckResult[] = [];
    let roleComparisons: RoleComparisonResult[] = [];
    let bugObservations: BugObservation[] = [];
    let apiEndpoints: ApiEndpoint[] = [];
    let apiTestResults: ApiTestResult[] = [];
    let apiObservations: ApiResponseObservation[] = [];
    let apiCoverage: ApiCoverageSummary | undefined;
    let securityResult: SecurityScanResult | undefined;
    let securityFindings: SecurityFinding[] | undefined;
    let securityCoverage: SecurityCoverageSummary | undefined;
    let performanceResult: PerformanceScanResult | undefined;
    let performanceFindings: PerformanceFinding[] | undefined;
    let performanceCoverage: PerformanceCoverageSummary | undefined;

    try {
      if (cancellationToken?.isCancelled) {
        return {
          status: 'cancelled',
          durationMs: Date.now() - startTime,
          consoleErrors: [],
          networkErrors: [],
          screenshots: [],
          failureReason: 'Test was cancelled prior to browser launch.',
        };
      }

      // 2. Launch Browser
      this.logger.log('browser_launching', {
        browser: this.options.browserType,
        headless: this.options.headless,
      });

      browser = await chromium.launch({
        headless: this.options.headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });

      this.logger.log('browser_started');

      if (cancellationToken?.isCancelled) {
        await browser.close();
        return {
          status: 'cancelled',
          durationMs: Date.now() - startTime,
          consoleErrors: [],
          networkErrors: [],
          screenshots: [],
          failureReason: 'Test was cancelled after browser launch.',
        };
      }

      // 3. Create Isolated Browser Context
      context = await browser.newContext({
        viewport: this.options.viewport,
        userAgent: 'Sculra-Autonomous-QA-Engine/1.0',
        ignoreHTTPSErrors: false,
      });

      page = await context.newPage();
      page.setDefaultNavigationTimeout(this.options.navigationTimeoutMs || 15000);
      page.setDefaultTimeout(this.options.navigationTimeoutMs || 15000);

      // 4. Attach Event Listeners (Console Errors)
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          const entry: CapturedConsoleError = {
            message: msg.text(),
            url: page?.url() || safeUrl,
            timestamp: new Date().toISOString(),
            location: msg.location()?.url
              ? `${msg.location().url}:${msg.location().lineNumber}`
              : undefined,
          };
          consoleErrors.push(entry);
          this.logger.log('console_error_detected', { text: msg.text() });
        }
      });

      // Page runtime errors
      page.on('pageerror', (err) => {
        const entry: CapturedConsoleError = {
          message: err.message,
          url: page?.url() || safeUrl,
          timestamp: new Date().toISOString(),
          location: err.stack?.split('\n')[1]?.trim(),
        };
        consoleErrors.push(entry);
        this.logger.log('page_error_detected', { message: err.message });
      });

      // 5. Attach Event Listeners (Network Failures & HTTP >= 400)
      page.on('requestfailed', (req) => {
        const failure = req.failure();
        const entry: CapturedNetworkError = {
          url: req.url(),
          method: req.method(),
          resourceType: req.resourceType(),
          errorText: failure?.errorText || 'Request failed',
          timestamp: new Date().toISOString(),
        };
        networkErrors.push(entry);
        this.logger.log('network_request_failed', {
          url: req.url(),
          method: req.method(),
          error: failure?.errorText,
        });
      });

      page.on('response', (res) => {
        const resStatus = res.status();
        if (resStatus >= 400) {
          const entry: CapturedNetworkError = {
            url: res.url(),
            method: res.request().method(),
            status: resStatus,
            resourceType: res.request().resourceType(),
            errorText: `HTTP ${resStatus} ${res.statusText()}`,
            timestamp: new Date().toISOString(),
          };
          networkErrors.push(entry);
        }
      });

      // 6. Navigate to Target URL
      this.logger.log('navigating_to_target', { url: safeUrl });
      const response = await page.goto(safeUrl, {
        waitUntil: 'load',
        timeout: this.options.navigationTimeoutMs,
      });

      if (response) {
        statusCode = response.status();
        this.logger.log('page_loaded', { statusCode });

        // Treat HTTP 5xx as fatal failure
        if (statusCode >= 500) {
          status = 'failed';
          failureReason = `Target returned server error response HTTP ${statusCode}`;
        }
      } else {
        this.logger.warn('page_loaded_no_response');
      }

      pageTitle = await page.title();
      finalUrl = page.url();

      this.logger.log('page_metadata_captured', {
        title: pageTitle,
        finalUrl,
      });

      // 7. Capture Viewport Screenshot
      try {
        const buffer = await page.screenshot({
          fullPage: false,
          type: 'png',
        });

        screenshots.push({
          title: `Initial Viewport Capture — ${pageTitle || 'Page'}`,
          buffer,
          mimeType: 'image/png',
          timestamp: new Date().toISOString(),
        });
        this.logger.log('screenshot_captured', { sizeBytes: buffer.length });
      } catch (screenshotErr: any) {
        this.logger.warn('screenshot_capture_failed', {
          message: screenshotErr.message,
        });
      }

      // Close the initial probe page and context before discovery
      await page.close().catch(() => {});
      page = null;
      await context.close().catch(() => {});
      context = null;

      // 8. Run Application Discovery if enabled and initial navigation did not fatally fail
      if (this.options.enableDiscovery !== false && status !== 'failed' && !cancellationToken?.isCancelled) {
        this.logger.log('invoking_application_discovery');
        const discovery = new ApplicationDiscovery(browser, safeUrl, {
          limits: this.options.discoveryLimits,
          allowLocalhost: this.options.allowLocalhost,
          cancellationToken,
          logger: this.logger,
        });

        applicationMap = await discovery.discover();

        // Collect discovery evidence into runner result
        for (const discoveredPage of applicationMap.pages) {
          if (discoveredPage.screenshot) {
            screenshots.push(discoveredPage.screenshot);
          }
          for (const cErr of discoveredPage.consoleErrors) {
            if (!consoleErrors.some((e) => e.message === cErr.message && e.url === cErr.url)) {
              consoleErrors.push(cErr);
            }
          }
          for (const nErr of discoveredPage.networkErrors) {
            if (!networkErrors.some((e) => e.url === nErr.url && e.status === nErr.status)) {
              networkErrors.push(nErr);
            }
          }
        }

        // Collect responsive viewport screenshots
        if (applicationMap.responsiveCaptures) {
          for (const rCap of applicationMap.responsiveCaptures) {
            if (rCap.screenshot) {
              screenshots.push(rCap.screenshot);
            }
          }
        }

        // 9. Run User Journey Planning & Execution
        if (this.options.enableJourneys !== false && applicationMap && !cancellationToken?.isCancelled) {
          this.logger.log('planning_user_journeys');
          const planner = new DeterministicJourneyPlanner();
          const journeys = await planner.plan(applicationMap);

          if (journeys.length > 0) {
            this.logger.log('executing_user_journeys', { count: journeys.length });
            const journeyExecutor = new JourneyExecutor(browser, {
              allowLocalhost: this.options.allowLocalhost,
              cancellationToken,
              logger: this.logger,
            });

            journeyResults = await journeyExecutor.executeJourneys(journeys);

            // Collect journey screenshots & telemetry
            for (const jRes of journeyResults) {
              for (const step of jRes.steps) {
                if (step.screenshot) {
                  screenshots.push(step.screenshot);
                }
                for (const cErr of step.consoleErrors) {
                  if (!consoleErrors.some((e) => e.message === cErr.message && e.url === cErr.url)) {
                    consoleErrors.push(cErr);
                  }
                }
                for (const nErr of step.networkErrors) {
                  if (!networkErrors.some((e) => e.url === nErr.url && e.status === nErr.status)) {
                    networkErrors.push(nErr);
                  }
                }
              }
            }
          }
        }
        // 10. Run Deterministic Visual & Responsive QA Engine
        if (
          this.options.enableVisual !== false &&
          !cancellationToken?.isCancelled &&
          browser
        ) {
          this.logger.log('invoking_visual_responsive_engine');
          try {
            const visualEngine = new ResponsiveVisualEngine(
              browser,
              {
                allowLocalhost: this.options.allowLocalhost,
              },
              this.logger
            );

            const visualOutput = await visualEngine.execute(
              this.testRunId,
              this.projectId || 'unassigned',
              safeUrl,
              applicationMap?.pages || [],
              cancellationToken
            );

            visualResult = visualOutput.result;
            bugObservations.push(...visualOutput.bugObservations);

            // Collect visual snapshots as screenshots
            for (const snap of visualResult.snapshots) {
              if (snap.buffer) {
                screenshots.push({
                  title: `Responsive Viewport: ${snap.viewport.name.toUpperCase()} (${snap.viewport.width}x${snap.viewport.height}) — ${snap.pageUrl}`,
                  buffer: snap.buffer,
                  mimeType: 'image/png',
                  timestamp: snap.capturedAt,
                  viewportName: snap.viewport.name as any,
                });
              }
            }
          } catch (visualErr: any) {
            this.logger.warn('visual_engine_execution_warning', {
              message: visualErr.message,
            });
          }
        }

        // 11. Run AI QA Orchestrator (Provider-Agnostic, Bounded Iterations)
        if (
          this.options.enableAiQa !== false &&
          !cancellationToken?.isCancelled &&
          browser
        ) {
          this.logger.log('invoking_ai_qa_orchestrator');
          try {
            const aiOrchestrator = new AIQAOrchestrator(browser, safeUrl, {
              config: this.options.aiQaConfig,
              logger: this.logger,
              allowLocalhost: this.options.allowLocalhost,
            });

            const aiOutput = await aiOrchestrator.execute(
              this.testRunId,
              this.projectId || 'unassigned',
              undefined,
              applicationMap,
              journeyResults || [],
              bugObservations,
              cancellationToken
            );

            aiQaPlans = aiOutput.plans;
            aiQaResults = aiOutput.results;
            aiQaStateSummary = aiOutput.stateSummary;
            strategyDecisions = aiOutput.strategyDecisions;
            strategyTargets = aiOutput.strategyTargets;

            // Merge executed journeys into telemetry
            if (aiOutput.executedJourneys.length > 0) {
              if (!journeyResults) journeyResults = [];
              journeyResults.push(...aiOutput.executedJourneys);

              for (const jRes of aiOutput.executedJourneys) {
                for (const step of jRes.steps) {
                  if (step.screenshot) screenshots.push(step.screenshot);
                  for (const cErr of step.consoleErrors) {
                    if (!consoleErrors.some((e) => e.message === cErr.message && e.url === cErr.url)) {
                      consoleErrors.push(cErr);
                    }
                  }
                  for (const nErr of step.networkErrors) {
                    if (!networkErrors.some((e) => e.url === nErr.url && e.status === nErr.status)) {
                      networkErrors.push(nErr);
                    }
                  }
                }
              }
            }
          } catch (aiErr: any) {
            this.logger.warn('ai_qa_orchestrator_warning', {
              message: aiErr.message,
            });
          }
        }
      }

      // 12. Deterministic Issue Classification
      if (!cancellationToken?.isCancelled) {
        this.logger.log('invoking_issue_classifier');
        const classifier = new DeterministicIssueClassifier();
        const functionalBugs = classifier.classify({
          testRunId: this.testRunId,
          projectId: this.projectId || 'unassigned',
          targetUrl: safeUrl,
          journeyResults,
          consoleErrors,
          networkErrors,
          screenshots,
        });

        // Merge functional bugs with visual bug observations (deduplicating by fingerprint)
        for (const fBug of functionalBugs) {
          if (!bugObservations.some((b) => b.fingerprint === fBug.fingerprint)) {
            bugObservations.push(fBug);
          }
        }

        this.logger.log('issue_classification_completed', {
          bugsDetected: bugObservations.length,
          criticalCount: bugObservations.filter((b) => b.severity === 'critical').length,
          highCount: bugObservations.filter((b) => b.severity === 'high').length,
          mediumCount: bugObservations.filter((b) => b.severity === 'medium').length,
        });

        // 12.5 Authenticated Test Identities, Role Discovery & Authorization Checks
        const identities: TestIdentity[] = this.options.testIdentities
          ? [...this.options.testIdentities]
          : this.options.authConfig
          ? [
              {
                id: 'identity-primary',
                name: `${this.options.authConfig.role} Test Identity`,
                role: this.options.authConfig.role,
                authMethod: this.options.authConfig.method,
                status: 'ACTIVE',
                loginUrl: this.options.authConfig.loginUrl,
                usernameSecretRef: this.options.authConfig.usernameSecretRef,
                passwordSecretRef: this.options.authConfig.passwordSecretRef,
                successIndicator: this.options.authConfig.successIndicator,
                usernameFieldSelector: this.options.authConfig.usernameFieldSelector,
                passwordFieldSelector: this.options.authConfig.passwordFieldSelector,
                submitButtonSelector: this.options.authConfig.submitButtonSelector,
              },
            ]
          : [];

        if (identities.length > 0 && browser && !cancellationToken?.isCancelled) {
          this.logger.log('authenticated_testing_initiated', { identitiesCount: identities.length });
          const secretProvider = new EnvironmentSecretProvider();
          const roleAppMaps = new Map<string, ApplicationMap>();

          for (const identity of identities) {
            if (identity.status === 'DISABLED' || cancellationToken?.isCancelled) continue;

            let authContext: BrowserContext | null = null;
            try {
              authContext = await browser.newContext({
                viewport: this.options.viewport,
                userAgent: 'Sculra-Autonomous-QA-Engine/1.0',
                ignoreHTTPSErrors: false,
              });

              // 1. Authenticate Identity
              const session = await FormLoginEngine.login(
                authContext,
                identity,
                secretProvider,
                {
                  timeoutMs: this.options.navigationTimeoutMs,
                  logger: this.logger,
                }
              );
              authenticatedSessions.push(session);

              if (session.authenticated) {
                // 2. Authenticated Application Discovery
                this.logger.log('authenticated_discovery_started', { role: identity.role, identityId: identity.id });
                const discoveryStartUrl = session.finalUrl || safeUrl;
                const authDiscovery = new ApplicationDiscovery(browser, discoveryStartUrl, {
                  limits: this.options.discoveryLimits,
                  allowLocalhost: this.options.allowLocalhost,
                  cancellationToken,
                  logger: this.logger,
                  existingContext: authContext,
                });

                const roleMap = await authDiscovery.discover();
                session.discoveredPagesCount = roleMap.totalPages;
                roleAppMaps.set(identity.role, roleMap);

                this.logger.log('authenticated_discovery_completed', {
                  role: identity.role,
                  pagesCount: roleMap.totalPages,
                });

                // Create RoleContext
                const roleCtx: RoleContext = {
                  identityId: identity.id,
                  roleId: `role-${identity.role.toLowerCase()}`,
                  roleName: identity.name || identity.role,
                  authenticated: true,
                  capabilities:
                    identity.role.toUpperCase() === 'ADMIN'
                      ? ['Admin console access', 'User management', 'Workspace administration']
                      : ['Workspace project access', 'Standard member capabilities'],
                  workflowIds: [],
                  discoveredPageUrls: roleMap.pages.map((p) => p.url),
                };
                roleContexts.push(roleCtx);

                // 3. Deterministic Authorization Checks
                const matchingChecks = (this.options.authorizationChecks || []).filter(
                  (c) => c.role.toUpperCase() === identity.role.toUpperCase()
                );

                for (const check of matchingChecks) {
                  if (cancellationToken?.isCancelled) break;
                  const authResult = await AuthorizationEvaluator.evaluateCheck(
                    authContext,
                    safeUrl,
                    check,
                    this.logger
                  );
                  authorizationResults.push(authResult);

                  if (authResult.isUnauthorizedAccess) {
                    // Generate deterministic security bug observation
                    bugObservations.push({
                      id: `bug-unauth-${this.testRunId}-${identity.role.toLowerCase()}-${Date.now()}`,
                      testRunId: this.testRunId,
                      projectId: this.projectId || 'unassigned',
                      type: 'UNKNOWN_FUNCTIONAL_FAILURE',
                      severity: 'critical',
                      confidence: 'high',
                      status: 'open',
                      title: `Security Violation: Unauthorized Access (${identity.role} -> ${check.path})`,
                      summary: `Role "${identity.role}" was granted access to restricted route "${check.path}" violating authorization boundaries.`,
                      description: `Observed unauthorized access to ${check.path}. Evidence: ${authResult.evidence.join('; ')}`,
                      url: authResult.finalUrl || safeUrl,
                      reproductionSteps: [
                        {
                          stepNumber: 1,
                          action: 'AUTHENTICATE',
                          target: `Role ${identity.role}`,
                          url: identity.loginUrl,
                          expectedBehavior: `Authenticate as ${identity.role}`,
                          observedBehavior: 'Authenticated successfully',
                        },
                        {
                          stepNumber: 2,
                          action: 'NAVIGATE',
                          target: check.path,
                          url: check.path,
                          expectedBehavior: 'Access Denied (401/403 or redirect)',
                          observedBehavior: `Access Granted (${authResult.statusCode || '200 OK'})`,
                        },
                      ],
                      fingerprint: `unauthorized_access_${identity.role.toLowerCase()}_${check.path.replace(/[^a-zA-Z0-9]/g, '_')}`,
                      timestamp: new Date().toISOString(),
                    });
                  }
                }
              }
            } catch (authErr: any) {
              this.logger.warn('authenticated_testing_identity_error', {
                identityId: identity.id,
                error: authErr.message,
              });
            } finally {
              if (authContext) {
                await authContext.close().catch(() => {});
              }
            }
          }

          // 4. Deterministic Role Surface Comparison
          if (roleAppMaps.has('ADMIN') && (roleAppMaps.has('MEMBER') || applicationMap)) {
            const adminMap = roleAppMaps.get('ADMIN')!;
            const memberMap = roleAppMaps.get('MEMBER') || applicationMap!;
            const comparison = RoleComparator.compareRoleSurfaces(
              'ADMIN',
              adminMap,
              roleAppMaps.has('MEMBER') ? 'MEMBER' : 'PUBLIC',
              memberMap
            );
            roleComparisons.push(comparison);
          }
        }

        // 12.6 Deterministic API QA Engine Execution
        if (this.options.enableApiQa !== false && !cancellationToken?.isCancelled) {
          this.logger.log('api_qa_execution_initiated');
          try {
            const apiEngine = new ApiQAEngine(this.options.apiLimits, this.logger);
            const networkObs = networkErrors.map((n) => ({
              url: n.url,
              method: n.method,
              status: n.status,
            }));

            const apiOutput = await apiEngine.execute({
              testRunId: this.testRunId,
              projectId: this.projectId || 'unassigned',
              targetUrl: safeUrl,
              applicationMap,
              networkObservations: networkObs,
              projectConfig: this.options.apiConfig,
              testIdentities: identities,
              authenticatedSessions,
              authorizationChecks: this.options.authorizationChecks?.map((c) => ({
                path: c.path,
                method: 'GET',
                role: c.role,
                restrictedToRole: c.expectedAccess === 'DENY_401_403' || c.expectedAccess === 'DENIED' || c.expectedAccess === 'DENY' ? 'ADMIN' : c.role,
                unauthorizedRole: c.expectedAccess === 'DENY_401_403' || c.expectedAccess === 'DENIED' || c.expectedAccess === 'DENY' ? c.role : (c.role.toUpperCase() === 'ADMIN' ? 'MEMBER' : 'ANONYMOUS'),
                expectedAccess: c.expectedAccess,
              })),
              allowLocalhost: this.options.allowLocalhost,
              logger: this.logger,
              cancellationToken,
            });

            apiEndpoints = apiOutput.endpoints;
            apiTestResults = apiOutput.testResults;
            apiObservations = apiOutput.observations;
            apiCoverage = apiOutput.coverage;

            // Merge API bug observations (deduplicating by fingerprint)
            for (const apiBug of apiOutput.bugObservations) {
              if (!bugObservations.some((b) => b.fingerprint === apiBug.fingerprint)) {
                bugObservations.push(apiBug);
              }
            }
          } catch (apiErr: any) {
            this.logger.warn('api_qa_engine_warning', { message: apiErr.message });
          }
        }

        // 12.7 Deterministic Security & Authorization QA Scanner
        if (this.options.enableSecurityQa !== false && !cancellationToken?.isCancelled) {
          this.logger.log('security_qa_execution_initiated');
          try {
            const secScanner = new SecurityScanner(this.options.securityPolicy, this.logger);
            const secOutput = await secScanner.scan({
              testRunId: this.testRunId,
              projectId: this.projectId || 'unassigned',
              targetUrl: safeUrl,
              applicationMap,
              apiEndpoints,
              roleContexts,
              authenticatedSessions,
              allowLocalhost: this.options.allowLocalhost,
              logger: this.logger,
              cancellationToken,
            });

            securityResult = secOutput;
            securityFindings = secOutput.findings;
            securityCoverage = secOutput.coverage;

            // Merge security bug observations (deduplicating by fingerprint)
            for (const secBug of secOutput.bugObservations) {
              if (!bugObservations.some((b) => b.fingerprint === secBug.fingerprint)) {
                bugObservations.push(secBug);
              }
            }

            this.logger.log('security_qa_execution_completed', {
              findingsCount: secOutput.findings.length,
              criticalCount: secOutput.coverage.criticalFindings,
              highCount: secOutput.coverage.highFindings,
              mediumCount: secOutput.coverage.mediumFindings,
              checksExecuted: secOutput.coverage.checksExecuted,
            });
          } catch (secErr: any) {
            this.logger.warn('security_qa_scanner_warning', { message: secErr.message });
          }
        }

        // 12.8 Deterministic Performance & Reliability QA Scanner
        if (this.options.enablePerformanceQa !== false && status !== 'failed' && !cancellationToken?.isCancelled && browser) {
          this.logger.log('performance_qa_execution_initiated');
          let perfContext: BrowserContext | null = null;
          let perfPage: Page | null = null;
          try {
            perfContext = await browser.newContext({
              viewport: this.options.viewport,
              userAgent: 'Sculra-Autonomous-QA-Engine/1.0',
            });
            perfPage = await perfContext.newPage();
            perfPage.setDefaultNavigationTimeout(this.options.navigationTimeoutMs || 15000);

            const perfScanner = new PerformanceScanner(this.options.performancePolicy, this.logger);
            const perfOutput = await perfScanner.scan({
              testRunId: this.testRunId,
              projectId: this.projectId || 'unassigned',
              targetUrl: safeUrl,
              page: perfPage,
              browserContext: perfContext,
              applicationMap,
              apiEndpoints,
              journeyResults,
              roleContexts,
              allowLocalhost: this.options.allowLocalhost,
              logger: this.logger,
              cancellationToken,
            });

            performanceResult = perfOutput;
            performanceFindings = perfOutput.findings;
            performanceCoverage = perfOutput.coverage;

            // Merge performance bug observations (deduplicating by fingerprint)
            for (const perfBug of perfOutput.bugObservations) {
              if (!bugObservations.some((b) => b.fingerprint === perfBug.fingerprint)) {
                bugObservations.push(perfBug);
              }
            }

            this.logger.log('performance_qa_execution_completed', {
              findingsCount: perfOutput.findings.length,
              criticalCount: perfOutput.coverage.criticalFindings,
              highCount: perfOutput.coverage.highFindings,
              mediumCount: perfOutput.coverage.mediumFindings,
              checksExecuted: perfOutput.coverage.targetsTested,
            });
          } catch (perfErr: any) {
            this.logger.warn('performance_qa_scanner_warning', { message: perfErr.message });
          } finally {
            if (perfPage) await perfPage.close().catch(() => {});
            if (perfContext) await perfContext.close().catch(() => {});
          }
        }

        // Set test run failure if deterministic functional, visual, or security bugs were detected
        if (
          !cancellationToken?.isCancelled &&
          bugObservations.some(
            (b) => b.severity === 'critical' || b.severity === 'high' || b.severity === 'medium'
          )
        ) {
          status = 'failed';
          failureReason =
            failureReason ||
            `Detected ${bugObservations.length} deterministic issue(s).`;
        }
        // 13. AI Product Understanding & Workflow Discovery
        if (applicationMap && !cancellationToken?.isCancelled) {
          this.logger.log('invoking_product_model_builder');
          try {
            productModel = await ProductModelBuilder.build({
              testRunId: this.testRunId,
              targetUrl: safeUrl,
              applicationMap,
              journeyResults,
              bugObservations,
              roleContexts,
              logger: this.logger,
              cancellationToken,
            });
            productCoverage = productModel.coverage;
          } catch (prodErr: any) {
            this.logger.warn('product_model_builder_warning', {
              message: prodErr.message,
            });
          }
        }
      }

    } catch (err: any) {
      status = 'failed';
      failureReason = err.message || 'Browser execution failed';
      this.logger.error('execution_exception', err);
    } finally {
      // Clean up browser resources
      try {
        if (page) await page.close().catch(() => {});
        if (context) await context.close().catch(() => {});
        if (browser) await browser.close().catch(() => {});
        this.logger.log('browser_closed');
      } catch (cleanupErr: any) {
        this.logger.warn('cleanup_warning', { message: cleanupErr.message });
      }
    }

    const durationMs = Date.now() - startTime;

    this.logger.log('test_run_completed', {
      status,
      durationMs,
      consoleErrorsCount: consoleErrors.length,
      networkErrorsCount: networkErrors.length,
      screenshotsCount: screenshots.length,
      totalPagesDiscovered: applicationMap?.totalPages || 0,
      journeysExecuted: journeyResults?.length || 0,
      bugsDetected: bugObservations.length,
      authenticatedSessionsCount: authenticatedSessions.length,
      authorizationChecksCount: authorizationResults.length,
    });

    return {
      status,
      pageTitle,
      finalUrl,
      statusCode,
      durationMs,
      consoleErrors,
      networkErrors,
      screenshots,
      applicationMap,
      journeyResults,
      bugObservations,
      visualResult,
      aiQaPlans,
      aiQaResults,
      aiQaStateSummary,
      strategyDecisions,
      strategyTargets,
      productModel,
      productCoverage,
      authenticatedSessions,
      roleContexts,
      authorizationResults,
      roleComparisons,
      apiEndpoints,
      apiTestResults,
      apiObservations,
      apiCoverage,
      securityResult,
      securityFindings,
      securityCoverage,
      performanceResult,
      performanceFindings,
      performanceCoverage,
      failureReason,
    };
  }
}
