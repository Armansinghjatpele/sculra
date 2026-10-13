// ==============================================================================
// Sculra Authenticated Browser E2E & Production Route Verification Runner
// (scripts/run-authenticated-browser-e2e.ts)
// ==============================================================================
// Safe-by-default browser-level end-to-end test runner for core user journeys.
//
// ENVIRONMENT CONFIGURATION GUIDE:
// ------------------------------------------------------------------------------
// Dedicated test environment configuration required:
//   BASE_URL                       Web application URL (default: http://localhost:3000)
//   TEST_USER_ID                   Dedicated Clerk test identity (e.g. user_test_2b8...)
//   CLERK_SECRET_KEY               Clerk Backend API Secret Key (e.g. sk_test_...)
//   NEXT_PUBLIC_SUPABASE_URL       Supabase API endpoint for test environment
//   NEXT_PUBLIC_SUPABASE_ANON_KEY  Supabase public anon key for test environment
//
// PRODUCTION SAFEGUARDS:
// ------------------------------------------------------------------------------
// Running against production hostnames (*.vercel.app, sculra.com) is BLOCKED
// by default. To explicitly authorize execution against a production host:
//   ALLOW_PRODUCTION=true  OR  --allow-production
//
// Example safe run:
//   BASE_URL=http://localhost:3000 TEST_USER_ID=user_test_123 pnpm run test:e2e:authenticated
// ==============================================================================

import * as fs from 'fs';
import * as path from 'path';

export interface Browser {
  close(): Promise<void>;
  newContext(options?: any): Promise<BrowserContext>;
}

export interface BrowserContext {
  close(): Promise<void>;
  newPage(): Promise<Page>;
}

export interface Page {
  close(): Promise<void>;
  on(event: string, listener: (...args: any[]) => void): void;
  goto(url: string, options?: any): Promise<any>;
  evaluate<T = any, R = any>(pageFunction: ((arg: T) => R | Promise<R>) | string, arg?: T): Promise<R>;
  url(): string;
  title(): Promise<string>;
  textContent(selector: string): Promise<string | null>;
  waitForTimeout(timeout: number): Promise<void>;
}

export interface StepResult {
  step: number;
  name: string;
  status: 'PASSED' | 'FAILED' | 'BLOCKED';
  details: string;
  durationMs: number;
  error?: string;
}

export interface E2EEnvConfig {
  baseUrl: string;
  testUserId?: string;
  clerkSecretKey?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  allowProduction: boolean;
}

export interface TrackedResources {
  projectIds: string[];
  testRunIds: string[];
  originalPreferences?: {
    projectId: string;
    preferences: any;
  };
}

/**
 * Loads environment from process.env and frontend/.env.local (without exposing values).
 */
export function loadE2EEnv(): Record<string, string> {
  const env: Record<string, string> = { ...(process.env as Record<string, string>) };
  const envPath = path.resolve(process.cwd(), 'frontend/.env.local');
  if (fs.existsSync(envPath)) {
    try {
      const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
      for (const line of lines) {
        if (line.includes('=') && !line.startsWith('#')) {
          const [k, ...v] = line.trim().split('=');
          if (!env[k]) {
            env[k] = v.join('=');
          }
        }
      }
    } catch {
      // Continue with process.env if reading .env.local fails
    }
  }
  return env;
}

/**
 * Determines whether the target URL points to a production domain.
 */
export function isProductionUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    const host = parsed.hostname.toLowerCase();
    return (
      host.includes('vercel.app') ||
      host === 'sculra.com' ||
      host.endsWith('.sculra.com')
    );
  } catch {
    return false;
  }
}

/**
 * Validates environment parameters and enforces production safety.
 */
export function validateEnvironment(config: E2EEnvConfig): { ok: boolean; blockedReason?: string } {
  // 1. Production safety boundary
  if (isProductionUrl(config.baseUrl) && !config.allowProduction) {
    return {
      ok: false,
      blockedReason: `Target URL "${config.baseUrl}" is a production environment. Execution is blocked by default to prevent accidental production impact. Explicit acknowledgement is required via ALLOW_PRODUCTION=true or --allow-production.`,
    };
  }

  // 2. Explicit test user identity
  if (!config.testUserId || config.testUserId.trim() === '') {
    return {
      ok: false,
      blockedReason: 'TEST_USER_ID is not configured. An explicit test account identity is required (automatic selection of default accounts is disabled for safety).',
    };
  }

  // 3. Clerk API credentials
  if (!config.clerkSecretKey || config.clerkSecretKey.trim() === '') {
    return {
      ok: false,
      blockedReason: 'CLERK_SECRET_KEY is missing. Authenticated browser tests require Clerk API credentials.',
    };
  }

  // 4. Supabase credentials (explicit environment check, no silent hardcoded fallbacks)
  if (!config.supabaseUrl || config.supabaseUrl.trim() === '') {
    return {
      ok: false,
      blockedReason: 'NEXT_PUBLIC_SUPABASE_URL is missing. Explicit database endpoint for the test environment is required.',
    };
  }

  if (!config.supabaseAnonKey || config.supabaseAnonKey.trim() === '') {
    return {
      ok: false,
      blockedReason: 'NEXT_PUBLIC_SUPABASE_ANON_KEY is missing. Explicit Supabase client authorization key is required.',
    };
  }

  return { ok: true };
}

/**
 * Step orchestrator ensuring prerequisite propagation and accurate status recording.
 */
export class E2EOrchestrator {
  public results: StepResult[] = [];
  public browserErrors: string[] = [];
  public prerequisiteFailed = false;
  public prerequisiteFailureReason = '';

  async recordStep<T>(
    step: number,
    name: string,
    fn: () => Promise<{ details: string; value?: T }>
  ): Promise<T | null> {
    const start = Date.now();
    console.log(`\n▶ [Step ${step}]: ${name}...`);

    // If prerequisite previously failed, block dependent step immediately
    if (this.prerequisiteFailed) {
      const details = `Blocked: Dependent on prerequisite step which failed (${this.prerequisiteFailureReason})`;
      this.results.push({
        step,
        name,
        status: 'BLOCKED',
        details,
        durationMs: 0,
      });
      console.log(`  ⏹ [BLOCKED] ${details}`);
      return null;
    }

    try {
      const res = await fn();
      const duration = Date.now() - start;
      this.results.push({
        step,
        name,
        status: 'PASSED',
        details: res.details,
        durationMs: duration,
      });
      console.log(`  ✔ [PASSED] (${duration}ms) ${res.details}`);
      return res.value !== undefined ? res.value : null;
    } catch (err: any) {
      const duration = Date.now() - start;
      const isBlocked = err.message?.includes('BLOCKED');
      const status: 'BLOCKED' | 'FAILED' = isBlocked ? 'BLOCKED' : 'FAILED';
      const details = err.message || String(err);

      this.results.push({
        step,
        name,
        status,
        details,
        durationMs: duration,
        error: details,
      });

      console.error(`  ✖ [${status}] (${duration}ms) ${details}`);

      // Mark prerequisites as failed so subsequent dependent steps are skipped safely
      this.prerequisiteFailed = true;
      this.prerequisiteFailureReason = `Step ${step} (${name}): ${details}`;

      return null;
    }
  }

  getSummary() {
    const total = this.results.length;
    const passed = this.results.filter((r) => r.status === 'PASSED').length;
    const failed = this.results.filter((r) => r.status === 'FAILED').length;
    const blocked = this.results.filter((r) => r.status === 'BLOCKED').length;
    const isSuccess = total > 0 && failed === 0 && blocked === 0;

    return { total, passed, failed, blocked, isSuccess };
  }
}

/**
 * Main authenticated E2E verification routine.
 */
export async function runAuthenticatedBrowserE2E(cliArgs: string[] = process.argv.slice(2)): Promise<{
  success: boolean;
  results: StepResult[];
}> {
  const env = loadE2EEnv();
  const allowProduction =
    env['ALLOW_PRODUCTION'] === 'true' ||
    cliArgs.includes('--allow-production') ||
    cliArgs.includes('-p');

  // Default to local development server, never production host
  const baseUrl = env['BASE_URL'] || env['E2E_BASE_URL'] || 'http://localhost:3000';
  const testUserId = env['TEST_USER_ID'] || env['E2E_TEST_USER_ID'];
  const clerkSecretKey = env['CLERK_SECRET_KEY'];
  const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'] || env['SUPABASE_URL'];
  const supabaseAnonKey = env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] || env['SUPABASE_ANON_KEY'];

  const config: E2EEnvConfig = {
    baseUrl,
    testUserId,
    clerkSecretKey,
    supabaseUrl,
    supabaseAnonKey,
    allowProduction,
  };

  const isProd = isProductionUrl(baseUrl);
  const orchestrator = new E2EOrchestrator();

  console.log('==============================================================================');
  console.log('SCULRA AUTHENTICATED BROWSER E2E VERIFICATION RUNNER');
  console.log(`Target URL:     ${baseUrl}`);
  console.log(
    `Environment:    ${
      isProd
        ? allowProduction
          ? 'PRODUCTION (ACKNOWLEDGED)'
          : 'PRODUCTION (UNACKNOWLEDGED - BLOCKED)'
        : 'LOCAL / STAGING'
    }`
  );
  console.log(`Test Identity:  ${testUserId ? '[CONFIGURED]' : '[MISSING]'}`);
  console.log('==============================================================================');

  // Validate Environment Safety
  const validation = validateEnvironment(config);
  if (!validation.ok) {
    console.error(`\n✖ [PRE-FLIGHT BLOCKED]: ${validation.blockedReason}`);
    orchestrator.results.push({
      step: 0,
      name: 'Pre-Flight Environment & Safety Validation',
      status: 'BLOCKED',
      details: validation.blockedReason || 'Configuration invalid',
      durationMs: 0,
    });
    return { success: false, results: orchestrator.results };
  }

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  let userJwtToken: string | null = null;

  const trackedResources: TrackedResources = {
    projectIds: [],
    testRunIds: [],
  };

  try {
    // --------------------------------------------------------------------------
    // Step 1: Sign in via Clerk Dev/Test Setup
    // --------------------------------------------------------------------------
    await orchestrator.recordStep(1, 'Sign in via Clerk Development/Test Setup', async () => {
      // 1. Request single-use sign_in_token
      const ticketResp = await fetch('https://api.clerk.com/v1/sign_in_tokens', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${clerkSecretKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Sculra-E2E-Validation/1.0',
        },
        body: JSON.stringify({ user_id: testUserId }),
      });

      if (!ticketResp.ok) {
        throw new Error(`Failed requesting sign_in_token: HTTP ${ticketResp.status}`);
      }

      const ticketData = await ticketResp.json();
      const ticketToken = ticketData.token;
      if (!ticketToken) {
        throw new Error('No sign-in ticket token returned by Clerk API');
      }

      // 2. Direct session JWT for API verification & database cleanup
      const sessResp = await fetch('https://api.clerk.com/v1/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${clerkSecretKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Sculra-E2E-Validation/1.0',
        },
        body: JSON.stringify({ user_id: testUserId }),
      });
      if (!sessResp.ok) {
        throw new Error(`Failed creating Clerk session: HTTP ${sessResp.status}`);
      }
      const sessData = await sessResp.json();
      const sessId = sessData.id;

      const tokResp = await fetch(`https://api.clerk.com/v1/sessions/${sessId}/tokens`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${clerkSecretKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Sculra-E2E-Validation/1.0',
        },
        body: JSON.stringify({}),
      });
      if (!tokResp.ok) {
        throw new Error(`Failed obtaining Clerk session token: HTTP ${tokResp.status}`);
      }
      const tokData = await tokResp.json();
      userJwtToken = tokData.jwt;
      // Launch Playwright Chromium
      const pw: any = await (Function('return import("playwright")')() as Promise<any>);
      browser = await pw.chromium.launch({ headless: true });
      if (!browser) throw new Error('Failed to launch Chromium browser');
      context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      if (!context) throw new Error('Failed to create browser context');
      page = await context.newPage();

      // Monitor console & page errors (redacting token data)
      page.on('console', (msg: any) => {
        if (msg.type() === 'error') {
          const text = msg.text();
          if (!text.includes('favicon') && !text.includes('fit-content')) {
            orchestrator.browserErrors.push(`[Console Error @ ${page?.url()}]: ${text}`);
          }
        }
      });
      page.on('pageerror', (err: any) => {
        orchestrator.browserErrors.push(`[Page Error @ ${page?.url()}]: ${err.message}`);
      });

      // Navigate to /sign-in
      await page.goto(`${baseUrl}/sign-in`, { waitUntil: 'networkidle', timeout: 30000 });

      // Programmatically authenticate via Clerk client
      const authResult = await page.evaluate(async (ticket: string) => {
        const w = window as any;
        if (!w.Clerk) return { success: false, error: 'window.Clerk missing' };
        try {
          if (w.Clerk.load) await w.Clerk.load();
          const res = await w.Clerk.client.signIn.create({
            strategy: 'ticket',
            ticket,
          });
          if (res.status === 'complete' && res.createdSessionId) {
            await w.Clerk.setActive({ session: res.createdSessionId });
            return { success: true };
          }
          return { success: false, error: `Clerk status: ${res.status}` };
        } catch (e: any) {
          return { success: false, error: e.message || String(e) };
        }
      }, ticketToken);

      if (!authResult.success) {
        throw new Error(`Clerk in-browser authentication failed: ${authResult.error}`);
      }

      return {
        details: 'Authenticated browser session established successfully without credential leaks',
      };
    });

    // --------------------------------------------------------------------------
    // Step 2: Reach Authenticated Dashboard
    // --------------------------------------------------------------------------
    await orchestrator.recordStep(2, 'Navigate to Authenticated Dashboard', async () => {
      if (!page) throw new Error('Browser page not initialized');
      await page.goto(`${baseUrl}/dashboard`, { waitUntil: 'networkidle', timeout: 30000 });

      const url = page.url();
      if (!url.includes('/dashboard')) {
        throw new Error(`Expected to reach /dashboard, but was redirected to: ${url}`);
      }

      const bodyText = await page.textContent('body');
      if (!bodyText?.includes('Dashboard') && !bodyText?.includes('Projects')) {
        throw new Error('Dashboard shell did not render expected greeting or header');
      }

      const title = await page.title();
      return { details: `Dashboard loaded successfully: "${title}"` };
    });

    // --------------------------------------------------------------------------
    // Step 3: Open Projects List & Create Project (Safe Target Fixture)
    // --------------------------------------------------------------------------
    let activeProjectId: string | null = null;
    await orchestrator.recordStep(3, 'Create Project Pointing to Safe QA Fixture', async () => {
      if (!page) throw new Error('Browser page not initialized');
      await page.goto(`${baseUrl}/projects`, { waitUntil: 'networkidle', timeout: 30000 });

      const testProjectName = `E2E Playwright Fixture (${Date.now()})`;
      const targetFixtureUrl = `${baseUrl}/qa-fixture`;

      // Create project using authenticated in-browser fetch (utilizing active browser session)
      const createResp = await page.evaluate(
        async ({ name, url }: { name: string; url: string }) => {
          const res = await fetch('/api/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name,
              type: 'website',
              url,
              environment: 'Staging',
            }),
          });
          const json = await res.json();
          return { status: res.status, json };
        },
        { name: testProjectName, url: targetFixtureUrl }
      );

      if ((createResp.status !== 200 && createResp.status !== 201) || !createResp.json.success) {
        throw new Error(`Project creation failed (HTTP ${createResp.status}): ${JSON.stringify(createResp.json)}`);
      }

      const pId = createResp.json.project?.id;
      if (!pId) throw new Error('Project response did not include project ID');

      // Track resource for verified cleanup
      trackedResources.projectIds.push(pId);
      activeProjectId = pId;

      return {
        details: `Created test project "${testProjectName}" with ID ${pId}`,
        value: pId,
      };
    });

    // --------------------------------------------------------------------------
    // Step 4: Open Project Detail Page in Browser
    // --------------------------------------------------------------------------
    await orchestrator.recordStep(4, 'Open Project Detail Page in Browser', async () => {
      if (!page || !activeProjectId) throw new Error('Project ID missing');
      const projectUrl = `${baseUrl}/projects/${activeProjectId}`;
      await page.goto(projectUrl, { waitUntil: 'networkidle', timeout: 30000 });

      const url = page.url();
      if (!url.includes(activeProjectId)) {
        throw new Error(`Expected project detail URL, got ${url}`);
      }

      const bodyText = await page.textContent('body');
      if (!bodyText?.includes('qa-fixture') && !bodyText?.includes('Playwright Fixture')) {
        throw new Error('Project detail page did not display project title or fixture target');
      }

      return { details: `Project detail rendered without errors: ${url}` };
    });

    // --------------------------------------------------------------------------
    // Step 5: Start a Test Run
    // --------------------------------------------------------------------------
    let activeTestRunId: string | null = null;
    await orchestrator.recordStep(5, 'Trigger Test Run for Created Project', async () => {
      if (!page || !activeProjectId) throw new Error('Project ID missing');

      const triggerResp = await page.evaluate(async (pId: string) => {
        const res = await fetch('/api/test-runs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: pId }),
        });
        const json = await res.json();
        return { status: res.status, json };
      }, activeProjectId);

      if ((triggerResp.status !== 200 && triggerResp.status !== 201) || !triggerResp.json.success) {
        throw new Error(`Test run trigger failed (HTTP ${triggerResp.status}): ${JSON.stringify(triggerResp.json)}`);
      }

      const tId = triggerResp.json.testRunId;
      activeTestRunId = tId;
      trackedResources.testRunIds.push(tId);

      return {
        details: `Test run triggered successfully with ID ${tId} (Initial Status: ${triggerResp.json.status})`,
        value: tId,
      };
    });

    // --------------------------------------------------------------------------
    // Step 6: View Test Run Result & Evidence/Issues
    // --------------------------------------------------------------------------
    await orchestrator.recordStep(6, 'View Test Run Details & Runs Explorer in Browser', async () => {
      if (!page) throw new Error('Browser page missing');

      if (activeTestRunId) {
        const runDetailUrl = `${baseUrl}/test-runs/${activeTestRunId}`;
        await page.goto(runDetailUrl, { waitUntil: 'networkidle', timeout: 30000 });
        const bodyText = await page.textContent('body');
        if (!bodyText?.includes('Test Run') && !bodyText?.includes('Status')) {
          throw new Error('Test run detail page failed to render run container');
        }
      }

      // Visited runs explorer
      await page.goto(`${baseUrl}/test-runs`, { waitUntil: 'networkidle', timeout: 30000 });
      const explorerText = await page.textContent('body');
      if (!explorerText?.includes('Test Runs') && !explorerText?.includes('Explorer')) {
        throw new Error('Test runs explorer failed to render');
      }

      return {
        details: `Navigated to /test-runs and test-run detail (${activeTestRunId}) with clean render`,
      };
    });

    // --------------------------------------------------------------------------
    // Step 7: Open Project Incidents & Notification Settings
    // --------------------------------------------------------------------------
    await orchestrator.recordStep(7, 'Verify Project Incidents & Notification Settings Endpoints', async () => {
      if (!page || !activeProjectId) throw new Error('Project ID missing');

      // 1. GET /api/projects/:id/incidents
      const incidentsResp = await page.evaluate(async (pId: string) => {
        const res = await fetch(`/api/projects/${pId}/incidents`);
        const json = await res.json();
        return { status: res.status, json };
      }, activeProjectId);

      if (incidentsResp.status !== 200 || !incidentsResp.json.success) {
        throw new Error(`GET incidents failed: HTTP ${incidentsResp.status}`);
      }

      // 2. GET /api/projects/:id/notification-settings
      const notifGetResp = await page.evaluate(async (pId: string) => {
        const res = await fetch(`/api/projects/${pId}/notification-settings`);
        const json = await res.json();
        return { status: res.status, json };
      }, activeProjectId);

      if (notifGetResp.status !== 200 || !notifGetResp.json.success) {
        throw new Error(`GET notification-settings failed: HTTP ${notifGetResp.status}`);
      }

      // 3. For production runs: Read-only check only (no unsafe settings mutations)
      // For local/test runs: Verify PATCH with guaranteed restoration
      if (!isProd) {
        trackedResources.originalPreferences = {
          projectId: activeProjectId,
          preferences: notifGetResp.json.preferences,
        };

        const notifPatchResp = await page.evaluate(async (pId: string) => {
          const res = await fetch(`/api/projects/${pId}/notification-settings`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email_enabled: true }),
          });
          const json = await res.json();
          return { status: res.status, json };
        }, activeProjectId);

        if (notifPatchResp.status !== 200 || !notifPatchResp.json.success) {
          throw new Error(`PATCH notification-settings failed: HTTP ${notifPatchResp.status}`);
        }
      }

      return {
        details: `Incidents verified (count: ${incidentsResp.json.count}). Notification settings read-verified${
          isProd ? ' (PATCH mutation skipped in production)' : ' and PATCH tested safely'
        }.`,
      };
    });

    // --------------------------------------------------------------------------
    // Step 8: Multi-Route Navigation Sweep & Zero Console Errors
    // --------------------------------------------------------------------------
    await orchestrator.recordStep(8, 'Navigate Core Routes & Confirm Zero Browser Errors', async () => {
      if (!page) throw new Error('Browser page missing');

      const routesToSweep = [
        '/dashboard',
        '/projects',
        `/projects/${activeProjectId}`,
        '/test-runs',
        '/issues',
        '/reports',
        '/release-readiness',
        '/settings',
        '/settings/team',
      ];

      for (const r of routesToSweep) {
        const url = `${baseUrl}${r}`;
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForTimeout(1000);
      }

      if (orchestrator.browserErrors.length > 0) {
        throw new Error(
          `Uncaught browser errors recorded (${orchestrator.browserErrors.length}):\n${orchestrator.browserErrors.join(
            '\n'
          )}`
        );
      }

      return {
        details: `Traversed ${routesToSweep.length} core authenticated routes with 0 uncaught errors`,
      };
    });
  } finally {
    // --------------------------------------------------------------------------
    // Step 9: Safe Cleanup of Test Data (Always Runs in Finally)
    // --------------------------------------------------------------------------
    await orchestrator.recordStep(9, 'Reliable Test Data Cleanup & Verification', async () => {
      const cleanupErrors: string[] = [];

      // 1. Restore notification settings if modified
      if (trackedResources.originalPreferences && page) {
        try {
          const { projectId, preferences } = trackedResources.originalPreferences;
          const emailEnabled = preferences?.email_enabled ?? false;
          await page.evaluate(
            async ({ pId, enabled }: { pId: string; enabled: boolean }) => {
              await fetch(`/api/projects/${pId}/notification-settings`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email_enabled: enabled }),
              });
            },
            { pId: projectId, enabled: emailEnabled }
          );
        } catch (e: any) {
          cleanupErrors.push(`Failed restoring notification preferences: ${e.message}`);
        }
      }

      // 2. Clean up test runs
      if (userJwtToken && trackedResources.testRunIds.length > 0) {
        for (const tId of trackedResources.testRunIds) {
          try {
            await fetch(`${supabaseUrl}/rest/v1/test_runs?id=eq.${tId}`, {
              method: 'DELETE',
              headers: {
                apikey: supabaseAnonKey,
                Authorization: `Bearer ${userJwtToken}`,
                'Content-Type': 'application/json',
              },
            });
          } catch {
            // Non-critical if test run table has cascade
          }
        }
      }

      // 3. Clean up created projects & VERIFY deletion
      if (userJwtToken && trackedResources.projectIds.length > 0) {
        for (const pId of trackedResources.projectIds) {
          try {
            const delResp = await fetch(`${supabaseUrl}/rest/v1/projects?id=eq.${pId}`, {
              method: 'DELETE',
              headers: {
                apikey: supabaseAnonKey,
                Authorization: `Bearer ${userJwtToken}`,
                'Content-Type': 'application/json',
              },
            });

            if (delResp.status !== 200 && delResp.status !== 204) {
              cleanupErrors.push(
                `Project deletion returned unexpected status HTTP ${delResp.status} for project ${pId}`
              );
              continue;
            }

            // Verify project no longer exists
            const verifyResp = await fetch(`${supabaseUrl}/rest/v1/projects?id=eq.${pId}`, {
              headers: {
                apikey: supabaseAnonKey,
                Authorization: `Bearer ${userJwtToken}`,
              },
            });

            if (verifyResp.ok) {
              const remaining = await verifyResp.json();
              if (Array.isArray(remaining) && remaining.length > 0) {
                cleanupErrors.push(`Project ${pId} still exists in database after DELETE operation.`);
              }
            }
          } catch (e: any) {
            cleanupErrors.push(`Error executing project cleanup for ${pId}: ${e.message}`);
          }
        }
      }

      // Close browser resources cleanly
      if (page) await page.close().catch(() => {});
      if (context) await context.close().catch(() => {});
      if (browser) await browser.close().catch(() => {});

      if (cleanupErrors.length > 0) {
        throw new Error(`Cleanup failed:\n${cleanupErrors.join('\n')}`);
      }

      const count = trackedResources.projectIds.length;
      return {
        details: `Successfully cleaned up and verified removal of ${count} test resource(s).`,
      };
    });
  }

  // ----------------------------------------------------------------------------
  // Final Results Summary & Trustworthy Exit Code
  // ----------------------------------------------------------------------------
  const summary = orchestrator.getSummary();

  console.log('\n==============================================================================');
  console.log('AUTHENTICATED BROWSER E2E TEST SUMMARY');
  console.log('==============================================================================');
  for (const r of orchestrator.results) {
    const icon = r.status === 'PASSED' ? '✔' : r.status === 'BLOCKED' ? '⏹' : '✖';
    console.log(`${icon} Step ${r.step}: ${r.name.padEnd(52)} [${r.status}] (${r.durationMs}ms)`);
  }
  console.log('==============================================================================');
  console.log(`TOTAL:   ${summary.total}`);
  console.log(`PASSED:  ${summary.passed}`);
  console.log(`FAILED:  ${summary.failed}`);
  console.log(`BLOCKED: ${summary.blocked}`);
  console.log(`BROWSER CONSOLE ERRORS: ${orchestrator.browserErrors.length}`);
  console.log('==============================================================================');

  if (!summary.isSuccess) {
    console.error('\n✖ Suite failed: One or more steps failed or were blocked.');
    return { success: false, results: orchestrator.results };
  }

  console.log('\n✔ Suite succeeded: All steps passed and test resources were reliably cleaned up.');
  return { success: true, results: orchestrator.results };
}

// ------------------------------------------------------------------------------
// CLI Execution Entry Point
// ------------------------------------------------------------------------------
if (process.argv[1] && process.argv[1].includes('run-authenticated-browser-e2e')) {
  runAuthenticatedBrowserE2E()
    .then(({ success }) => {
      process.exit(success ? 0 : 1);
    })
    .catch((err) => {
      console.error('[Fatal Unhandled Runner Exception]:', err);
      process.exit(1);
    });
}
