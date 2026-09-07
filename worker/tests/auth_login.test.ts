import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { chromium, Browser } from 'playwright';
import { createTestServer, FixtureServer } from './fixtures/app';
import { FormLoginEngine } from '../src/auth/form-login';
import { AuthVerifier } from '../src/auth/verifier';
import { EnvironmentSecretProvider } from '../src/auth/secrets';
import { TestIdentity } from '../src/auth/types';

describe('FormLoginEngine & AuthVerifier', () => {
  let server: FixtureServer;
  let baseUrl: string;
  let browser: Browser;

  beforeAll(async () => {
    server = await createTestServer();
    baseUrl = server.url;
    browser = await chromium.launch({ headless: true });
  }, 30000);

  afterAll(async () => {
    if (browser) await browser.close();
    if (server) await server.close();
  });

  it('successfully authenticates with valid credentials in isolated context', async () => {
    const context = await browser.newContext();

    const identity: TestIdentity = {
      id: 'admin_user',
      name: 'Admin User',
      role: 'ADMIN',
      authMethod: 'FORM_LOGIN',
      status: 'ACTIVE',
      loginUrl: `${baseUrl}/login`,
      usernameSecretRef: 'raw:admin@example.com',
      passwordSecretRef: 'raw:admin123',
      successIndicator: {
        type: 'URL_CHANGE',
        expectedUrlPattern: '/dashboard',
      },
    };

    const secretProvider = new EnvironmentSecretProvider();
    const session = await FormLoginEngine.login(context, identity, secretProvider);

    expect(session.authenticated).toBe(true);
    expect(session.outcome).toBe('AUTHENTICATED');
    expect(session.finalUrl).toBe(`${baseUrl}/dashboard`);
    expect(session.role).toBe('ADMIN');
    expect(session.identityId).toBe('admin_user');

    // Verify session cookies exist
    const cookies = await context.cookies();
    const authCookie = cookies.find((c) => c.name === 'sculra_auth');
    expect(authCookie).toBeDefined();

    // Verify password is NOT in session or telemetry
    expect(JSON.stringify(session)).not.toContain('admin123');

    await context.close();
  }, 20000);

  it('handles invalid credentials gracefully and reports AUTHENTICATION_FAILED', async () => {
    const context = await browser.newContext();

    const identity: TestIdentity = {
      id: 'bad_user',
      name: 'Bad User',
      role: 'MEMBER',
      authMethod: 'FORM_LOGIN',
      status: 'ACTIVE',
      loginUrl: `${baseUrl}/login`,
      usernameSecretRef: 'raw:member@example.com',
      passwordSecretRef: 'raw:WrongPassword123!',
    };

    const secretProvider = new EnvironmentSecretProvider();
    const session = await FormLoginEngine.login(context, identity, secretProvider);

    expect(session.authenticated).toBe(false);
    expect(session.outcome).toBe('AUTHENTICATION_FAILED');

    // Verify zero credentials in result
    expect(JSON.stringify(session)).not.toContain('WrongPassword123!');

    await context.close();
  }, 20000);

  it('reports LOGIN_FORM_NOT_FOUND when login page lacks login form fields', async () => {
    const context = await browser.newContext();

    const identity: TestIdentity = {
      id: 'test_user',
      name: 'Test User',
      role: 'MEMBER',
      authMethod: 'FORM_LOGIN',
      status: 'ACTIVE',
      loginUrl: `${baseUrl}/`, // Home page lacks login form inputs
      usernameSecretRef: 'raw:test@example.com',
      passwordSecretRef: 'raw:Pass123!',
    };

    const secretProvider = new EnvironmentSecretProvider();
    const session = await FormLoginEngine.login(context, identity, secretProvider);

    expect(session.authenticated).toBe(false);
    expect(session.outcome).toBe('LOGIN_FORM_NOT_FOUND');

    await context.close();
  }, 20000);

  it('AuthVerifier deterministically detects authenticated state via cookies and UI elements', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Directly login on page
    await page.goto(`${baseUrl}/login`);
    await page.fill('input#username, input[name="username"]', 'admin@example.com');
    await page.fill('input#password, input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');

    const result = await AuthVerifier.verifySession(
      page,
      context,
      `${baseUrl}/login`,
      {
        type: 'URL_CHANGE',
        expectedUrlPattern: '/dashboard',
      }
    );

    expect(result.verified).toBe(true);
    expect(result.outcome).toBe('AUTHENTICATED');
    expect(result.finalUrl).toBe(`${baseUrl}/dashboard`);

    await context.close();
  }, 20000);
});
