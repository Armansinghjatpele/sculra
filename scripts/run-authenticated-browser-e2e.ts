// ==============================================================================
// Sculra Authenticated Browser E2E & Production Route Verification Runner
// (scripts/run-authenticated-browser-e2e.ts)
// ==============================================================================

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

// ------------------------------------------------------------------------------
// 1. Environment & Credential Loading (Safe & Bound)
// ------------------------------------------------------------------------------
function loadEnv(): Record<string, string> {
  const env: Record<string, string> = { ...process.env as Record<string, string> };
  const envPath = path.resolve(process.cwd(), 'frontend/.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      if (line.includes('=') && !line.startsWith('#')) {
        const [k, ...v] = line.trim().split('=');
        if (!env[k]) {
          env[k] = v.join('=');
        }
      }
    }
  }
  return env;
}

const env = loadEnv();
const CLERK_SECRET_KEY = env['CLERK_SECRET_KEY'];
const SUPABASE_URL = env['NEXT_PUBLIC_SUPABASE_URL'] || 'https://vycrimzpywqyjhtvvuax.supabase.co';
const SUPABASE_ANON_KEY = env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] || '';
const BASE_URL = process.env.BASE_URL || 'https://sculra-frontend.vercel.app';
const TEST_USER_ID = process.env.TEST_USER_ID || 'user_3IRZsuFc5J7Rc9etXvawfwuCEx7';

interface StepResult {
  step: number;
  name: string;
  status: 'PASSED' | 'FAILED' | 'BLOCKED';
  details: string;
  durationMs: number;
}

const results: StepResult[] = [];
const browserErrors: string[] = [];

async function recordStep<T>(
  step: number,
  name: string,
  fn: () => Promise<{ details: string; value?: T }>
): Promise<T | null> {
  const start = Date.now();
  console.log(`\n▶ [Step ${step}]: ${name}...`);
  try {
    const res = await fn();
    const duration = Date.now() - start;
    results.push({
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
    results.push({
      step,
      name,
      status: isBlocked ? 'BLOCKED' : 'FAILED',
      details: err.message,
      durationMs: duration,
    });
    console.error(`  ✖ [${isBlocked ? 'BLOCKED' : 'FAILED'}] (${duration}ms) ${err.message}`);
    return null;
  }
}

async function main() {
  console.log('==============================================================================');
  console.log('SCULRA AUTHENTICATED BROWSER E2E & PRODUCTION VERIFICATION');
  console.log(`Target Base URL: ${BASE_URL}`);
  console.log(`Test User ID:    ${TEST_USER_ID}`);
  console.log('==============================================================================');

  // Check credentials
  if (!CLERK_SECRET_KEY) {
    console.error('\n[BLOCKED]: Missing CLERK_SECRET_KEY in environment or frontend/.env.local.');
    console.error('Cannot run authenticated tests without Clerk API credentials.');
    process.exit(1);
  }

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  let page: Page | null = null;
  let createdProjectId: string | null = null;
  let testRunId: string | null = null;
  let userJwtToken: string | null = null;

  try {
    // --------------------------------------------------------------------------
    // Step 1: Mint Clerk Sign-In Ticket & Authenticate Browser Session
    // --------------------------------------------------------------------------
    await recordStep(1, 'Sign in via Clerk Development/Test Setup', async () => {
      // 1. Request sign_in_token from Clerk
      const ticketResp = await fetch('https://api.clerk.com/v1/sign_in_tokens', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${CLERK_SECRET_KEY}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Sculra-Validation/1.0',
        },
        body: JSON.stringify({ user_id: TEST_USER_ID }),
      });

      if (!ticketResp.ok) {
        throw new Error(`Failed requesting sign_in_token: HTTP ${ticketResp.status}`);
      }

      const ticketData = await ticketResp.json();
      const ticketToken = ticketData.token;
      if (!ticketToken) {
        throw new Error('No sign-in ticket token returned by Clerk API');
      }

      // Also mint a direct session JWT for API calls & cleanup
      const sessResp = await fetch('https://api.clerk.com/v1/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${CLERK_SECRET_KEY}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Sculra-Validation/1.0',
        },
        body: JSON.stringify({ user_id: TEST_USER_ID }),
      });
      const sessData = await sessResp.json();
      const sessId = sessData.id;

      const tokResp = await fetch(`https://api.clerk.com/v1/sessions/${sessId}/tokens`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${CLERK_SECRET_KEY}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Sculra-Validation/1.0',
        },
        body: JSON.stringify({}),
      });
      const tokData = await tokResp.json();
      userJwtToken = tokData.jwt;

      // Launch Playwright Chromium
      browser = await chromium.launch({ headless: true });
      context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      page = await context.newPage();

      // Monitor console & page errors
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          const text = msg.text();
          // Filter known non-app browser warnings
          if (!text.includes('favicon') && !text.includes('fit-content')) {
            browserErrors.push(`[Console Error @ ${page?.url()}]: ${text}`);
          }
        }
      });
      page.on('pageerror', (err) => {
        browserErrors.push(`[Page Error @ ${page?.url()}]: ${err.message}`);
      });

      // Navigate to /sign-in
      await page.goto(`${BASE_URL}/sign-in`, { waitUntil: 'networkidle', timeout: 30000 });

      // Programmatically authenticate via Clerk client
      const authResult = await page.evaluate(async (ticket) => {
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
            return { success: true, sessionId: res.createdSessionId };
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
        details: `Authenticated in browser context as ${TEST_USER_ID} (Clerk session: ${authResult.sessionId})`,
      };
    });

    // --------------------------------------------------------------------------
    // Step 2: Reach Dashboard
    // --------------------------------------------------------------------------
    await recordStep(2, 'Navigate to Authenticated Dashboard', async () => {
      if (!page) throw new Error('Browser page not initialized');
      await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle', timeout: 30000 });

      const url = page.url();
      if (!url.includes('/dashboard')) {
        throw new Error(`Expected to reach /dashboard, but was redirected to: ${url}`);
      }

      const bodyText = await page.textContent('body');
      if (!bodyText?.includes('Varun') && !bodyText?.includes('Dashboard')) {
        throw new Error('Dashboard shell did not render expected greeting or header');
      }

      const title = await page.title();
      return { details: `Dashboard loaded successfully: "${title}" (URL: ${url})` };
    });

    // --------------------------------------------------------------------------
    // Step 3: Open Projects List & Create Project (Safe QA Fixture Target)
    // --------------------------------------------------------------------------
    const proj = await recordStep(3, 'Create Project Pointing to Safe QA Fixture', async () => {
      if (!page) throw new Error('Browser page not initialized');
      await page.goto(`${BASE_URL}/projects`, { waitUntil: 'networkidle', timeout: 30000 });

      const testProjectName = `E2E Playwright Fixture (${Date.now()})`;
      const targetFixtureUrl = `${BASE_URL}/qa-fixture`;

      // Create project using authenticated in-browser fetch (utilizing active browser session)
      const createResp = await page.evaluate(
        async ({ name, url }) => {
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
      createdProjectId = pId;

      return {
        details: `Created project "${testProjectName}" with ID ${pId} (Target: ${targetFixtureUrl})`,
        value: pId,
      };
    });

    // --------------------------------------------------------------------------
    // Step 4: Open Project Detail Page
    // --------------------------------------------------------------------------
    await recordStep(4, 'Open Project Detail Page in Browser', async () => {
      if (!page || !createdProjectId) throw new Error('Project ID missing');
      const projectUrl = `${BASE_URL}/projects/${createdProjectId}`;
      await page.goto(projectUrl, { waitUntil: 'networkidle', timeout: 30000 });

      const url = page.url();
      if (!url.includes(createdProjectId)) {
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
    const runId = await recordStep(5, 'Trigger Test Run for Created Project', async () => {
      if (!page || !createdProjectId) throw new Error('Project ID missing');

      const triggerResp = await page.evaluate(async (pId) => {
        const res = await fetch('/api/test-runs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId: pId }),
        });
        const json = await res.json();
        return { status: res.status, json };
      }, createdProjectId);

      if ((triggerResp.status !== 200 && triggerResp.status !== 201) || !triggerResp.json.success) {
        throw new Error(`Test run trigger failed (HTTP ${triggerResp.status}): ${JSON.stringify(triggerResp.json)}`);
      }

      const tId = triggerResp.json.testRunId;
      testRunId = tId;
      return {
        details: `Test run triggered successfully with ID ${tId} (Initial Status: ${triggerResp.json.status})`,
        value: tId,
      };
    });

    // --------------------------------------------------------------------------
    // Step 6: View Test Run Result & Evidence/Issues
    // --------------------------------------------------------------------------
    await recordStep(6, 'View Test Run Details & Runs Explorer in Browser', async () => {
      if (!page) throw new Error('Browser page missing');

      if (testRunId) {
        const runDetailUrl = `${BASE_URL}/test-runs/${testRunId}`;
        await page.goto(runDetailUrl, { waitUntil: 'networkidle', timeout: 30000 });
        const bodyText = await page.textContent('body');
        if (!bodyText?.includes('Test Run') && !bodyText?.includes('Status')) {
          throw new Error('Test run detail page failed to render run container');
        }
      }

      // Also visit /test-runs explorer
      await page.goto(`${BASE_URL}/test-runs`, { waitUntil: 'networkidle', timeout: 30000 });
      const explorerText = await page.textContent('body');
      if (!explorerText?.includes('Test Runs') && !explorerText?.includes('Explorer')) {
        throw new Error('Test runs explorer failed to render');
      }

      return {
        details: `Navigated to /test-runs and test-run detail (${testRunId}) with clean render`,
      };
    });

    // --------------------------------------------------------------------------
    // Step 7: Open Project Incidents & Notification Settings
    // --------------------------------------------------------------------------
    await recordStep(7, 'Verify Project Incidents & Notification Settings Endpoints', async () => {
      if (!page || !createdProjectId) throw new Error('Project ID missing');

      // 1. GET /api/projects/:id/incidents
      const incidentsResp = await page.evaluate(async (pId) => {
        const res = await fetch(`/api/projects/${pId}/incidents`);
        const json = await res.json();
        return { status: res.status, json };
      }, createdProjectId);

      if (incidentsResp.status !== 200 || !incidentsResp.json.success) {
        throw new Error(`GET incidents failed: HTTP ${incidentsResp.status}`);
      }

      // 2. GET /api/projects/:id/notification-settings
      const notifGetResp = await page.evaluate(async (pId) => {
        const res = await fetch(`/api/projects/${pId}/notification-settings`);
        const json = await res.json();
        return { status: res.status, json };
      }, createdProjectId);

      if (notifGetResp.status !== 200 || !notifGetResp.json.success) {
        throw new Error(`GET notification-settings failed: HTTP ${notifGetResp.status}`);
      }

      // 3. PATCH /api/projects/:id/notification-settings
      const notifPatchResp = await page.evaluate(async (pId) => {
        const res = await fetch(`/api/projects/${pId}/notification-settings`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email_enabled: true }),
        });
        const json = await res.json();
        return { status: res.status, json };
      }, createdProjectId);

      if (notifPatchResp.status !== 200 || !notifPatchResp.json.success) {
        throw new Error(`PATCH notification-settings failed: HTTP ${notifPatchResp.status}`);
      }

      return {
        details: `Incidents count: ${incidentsResp.json.count}, Notification preferences verified and updated`,
      };
    });

    // --------------------------------------------------------------------------
    // Step 8: Multi-Route Navigation Sweep & Zero Console Errors
    // --------------------------------------------------------------------------
    await recordStep(8, 'Navigate Core Routes & Confirm Zero Browser Errors', async () => {
      if (!page) throw new Error('Browser page missing');

      const routesToSweep = [
        '/dashboard',
        '/projects',
        `/projects/${createdProjectId}`,
        '/test-runs',
        '/issues',
        '/reports',
        '/release-readiness',
        '/settings',
        '/settings/team',
      ];

      for (const r of routesToSweep) {
        const url = `${BASE_URL}${r}`;
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForTimeout(1000);
      }

      if (browserErrors.length > 0) {
        throw new Error(`Uncaught browser errors recorded (${browserErrors.length}):\n${browserErrors.join('\n')}`);
      }

      return {
        details: `Traversed ${routesToSweep.length} core authenticated routes with 0 uncaught errors`,
      };
    });

  } finally {
    // --------------------------------------------------------------------------
    // Step 9: Safe Cleanup of Test Data
    // --------------------------------------------------------------------------
    if (createdProjectId && userJwtToken) {
      await recordStep(9, 'Cleanup Test Project from Database', async () => {
        // Delete using Supabase PostgREST client with user's JWT
        const delResp = await fetch(
          `${SUPABASE_URL}/rest/v1/projects?id=eq.${createdProjectId}`,
          {
            method: 'DELETE',
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${userJwtToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        return {
          details: `Cleaned up test project ${createdProjectId} (HTTP ${delResp.status})`,
        };
      });
    }

    if (browser) {
      await browser.close();
    }
  }

  // ----------------------------------------------------------------------------
  // Final Results Summary
  // ----------------------------------------------------------------------------
  console.log('\n==============================================================================');
  console.log('AUTHENTICATED BROWSER E2E TEST SUMMARY');
  console.log('==============================================================================');
  let allPassed = true;
  for (const r of results) {
    const icon = r.status === 'PASSED' ? '✔' : '✖';
    console.log(`${icon} Step ${r.step}: ${r.name.padEnd(50)} [${r.status}] (${r.durationMs}ms)`);
    if (r.status !== 'PASSED') allPassed = false;
  }
  console.log('==============================================================================');
  console.log(`Total Browser Errors Observed: ${browserErrors.length}`);
  if (browserErrors.length > 0) {
    console.log('Errors:');
    for (const e of browserErrors) console.log(' ', e);
  }
  console.log('==============================================================================');

  if (!allPassed) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[Fatal Runner Exception]:', err);
  process.exit(1);
});
