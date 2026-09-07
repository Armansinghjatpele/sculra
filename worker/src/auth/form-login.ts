// ==============================================================================
// Sculra Deterministic Form Login Engine (worker/src/auth/form-login.ts)
// ==============================================================================
// Executes deterministic form-based authentication in an isolated Playwright BrowserContext.
//
// STRICT ZERO CREDENTIAL EXPOSURE GUARANTEE:
// Credentials are read in-memory from SecretProvider solely to fill form fields.
// Form input values and passwords are NEVER logged, screenshotted, or passed to AI/evidence.

import { BrowserContext, Page } from 'playwright';
import { TestIdentity, AuthenticatedSession, AuthOutcome } from './types';
import { SecretProvider } from './secrets';
import { AuthVerifier } from './verifier';
import { WorkerLogger } from '../logger';

export interface FormLoginOptions {
  timeoutMs?: number;
  logger?: WorkerLogger;
}

export class FormLoginEngine {
  /**
   * Executes deterministic form login for a test identity.
   */
  public static async login(
    context: BrowserContext,
    identity: TestIdentity,
    secretProvider: SecretProvider,
    options: FormLoginOptions = {}
  ): Promise<AuthenticatedSession> {
    const timeoutMs = options.timeoutMs || 15000;
    const logger = options.logger;
    const telemetryEvidence: string[] = [];

    logger?.log('authentication_started', {
      identityId: identity.id,
      role: identity.role,
      method: identity.authMethod,
      loginUrl: identity.loginUrl,
    });

    // 1. Resolve Credentials from SecretProvider
    const usernameRef = identity.usernameSecretRef || `${identity.role.toLowerCase()}_username`;
    const passwordRef = identity.passwordSecretRef || `${identity.role.toLowerCase()}_password`;

    const username = await secretProvider.getSecret(usernameRef);
    const password = await secretProvider.getSecret(passwordRef);

    if (!username || !password) {
      const errMessage = `Missing test credentials in secret provider (looked up keys: "${usernameRef}", "${passwordRef}").`;
      logger?.warn('authentication_config_error', { identityId: identity.id, role: identity.role });
      telemetryEvidence.push(`Configuration Error: ${errMessage}`);
      return {
        identityId: identity.id,
        role: identity.role,
        authenticated: false,
        outcome: 'TEST_CONFIGURATION_ERROR',
        error: errMessage,
        telemetryEvidence,
      };
    }

    let page: Page | null = null;

    try {
      page = await context.newPage();
      page.setDefaultNavigationTimeout(timeoutMs);
      page.setDefaultTimeout(timeoutMs);

      // 2. Navigate to Login URL
      telemetryEvidence.push(`Navigating to login URL: ${identity.loginUrl}`);
      await page.goto(identity.loginUrl, { waitUntil: 'load', timeout: timeoutMs });

      // 3. Locate Username & Password Inputs
      const usernameSelector =
        identity.usernameFieldSelector ||
        'input[type="email"], input[name*="user"], input[name*="email"], input[name="login"], input[type="text"]';
      const passwordSelector = identity.passwordFieldSelector || 'input[type="password"]';

      const usernameInput = await page.$(usernameSelector);
      const passwordInput = await page.$(passwordSelector);

      if (!usernameInput || !passwordInput) {
        const error = `Login form elements not found at ${identity.loginUrl} (username found: ${!!usernameInput}, password found: ${!!passwordInput}).`;
        logger?.warn('login_form_not_found', { identityId: identity.id, loginUrl: identity.loginUrl });
        telemetryEvidence.push(error);
        return {
          identityId: identity.id,
          role: identity.role,
          authenticated: false,
          outcome: 'LOGIN_FORM_NOT_FOUND',
          finalUrl: page.url(),
          error,
          telemetryEvidence,
        };
      }

      // 4. Fill Fields (Credentials kept strictly in memory, no logging)
      telemetryEvidence.push('Filling authentication inputs');
      await usernameInput.fill(username);
      await passwordInput.fill(password);

      // 5. Submit Form
      telemetryEvidence.push('Submitting authentication credentials');
      const submitSelector = identity.submitButtonSelector || 'button[type="submit"], input[type="submit"], button:has-text("Sign in"), button:has-text("Log in")';
      const submitBtn = await page.$(submitSelector);

      const navigationPromise = page.waitForNavigation({ timeout: timeoutMs, waitUntil: 'domcontentloaded' }).catch(() => null);

      if (submitBtn) {
        await submitBtn.click();
      } else {
        await passwordInput.press('Enter');
      }

      // Wait for either navigation or network idle
      await navigationPromise;
      await page.waitForLoadState('networkidle').catch(() => {});

      // 6. Check for Explicit Error Feedback on Page
      const bodyText = (await page.textContent('body')) || '';
      const hasErrorText = /invalid (?:credentials|password|email|username)|incorrect password|authentication failed/i.test(bodyText);

      if (hasErrorText) {
        logger?.warn('authentication_failed_invalid_credentials', { identityId: identity.id, role: identity.role });
        telemetryEvidence.push('Application displayed invalid credentials error feedback.');
        return {
          identityId: identity.id,
          role: identity.role,
          authenticated: false,
          outcome: 'AUTHENTICATION_FAILED',
          finalUrl: page.url(),
          error: 'Invalid credentials error feedback detected on target page.',
          telemetryEvidence,
        };
      }

      // 7. Verify Authenticated State Deterministically
      const verification = await AuthVerifier.verifySession(
        page,
        context,
        identity.loginUrl,
        identity.successIndicator
      );

      telemetryEvidence.push(...verification.evidence);

      if (verification.verified) {
        logger?.log('authentication_succeeded', {
          identityId: identity.id,
          role: identity.role,
          finalUrl: verification.finalUrl,
        });

        return {
          identityId: identity.id,
          role: identity.role,
          authenticated: true,
          outcome: 'AUTHENTICATED',
          authenticatedAt: new Date().toISOString(),
          finalUrl: verification.finalUrl,
          telemetryEvidence,
        };
      } else {
        logger?.warn('authentication_unverified', {
          identityId: identity.id,
          role: identity.role,
          reason: verification.reason,
        });

        return {
          identityId: identity.id,
          role: identity.role,
          authenticated: false,
          outcome: verification.outcome,
          finalUrl: verification.finalUrl,
          error: verification.reason || 'Authenticated state could not be verified.',
          telemetryEvidence,
        };
      }
    } catch (err: any) {
      const isTimeout = /timeout/i.test(err.message || '');
      const outcome: AuthOutcome = isTimeout ? 'AUTHENTICATION_TIMEOUT' : 'AUTHENTICATION_FAILED';
      const errorMsg = `Authentication error: ${err.message}`;

      logger?.warn('authentication_exception', { identityId: identity.id, error: err.message });
      telemetryEvidence.push(errorMsg);

      return {
        identityId: identity.id,
        role: identity.role,
        authenticated: false,
        outcome,
        finalUrl: page?.url(),
        error: errorMsg,
        telemetryEvidence,
      };
    } finally {
      if (page) {
        await page.close().catch(() => {});
      }
    }
  }
}
