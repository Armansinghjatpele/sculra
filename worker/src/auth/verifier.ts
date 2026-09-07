// ==============================================================================
// Sculra Deterministic Authenticated State Verifier (worker/src/auth/verifier.ts)
// ==============================================================================
// Verifies whether a browser session has successfully transitioned to an authenticated state.

import { Page, BrowserContext } from 'playwright';
import { AuthOutcome, AuthSuccessIndicator } from './types';

export interface VerificationResult {
  outcome: AuthOutcome;
  verified: boolean;
  finalUrl: string;
  evidence: string[];
  reason?: string;
}

export class AuthVerifier {
  /**
   * Evaluates deterministic signals to verify authenticated session state.
   */
  public static async verifySession(
    page: Page,
    context: BrowserContext,
    initialLoginUrl: string,
    indicator?: AuthSuccessIndicator
  ): Promise<VerificationResult> {
    const evidence: string[] = [];
    const currentUrl = page.url();
    const loginPath = new URL(initialLoginUrl, 'http://localhost').pathname.toLowerCase();
    const currentPath = new URL(currentUrl, 'http://localhost').pathname.toLowerCase();

    // 1. Explicit Success Indicator evaluation if configured
    if (indicator) {
      if (indicator.type === 'URL_CHANGE' && indicator.expectedUrlPattern) {
        const regex = new RegExp(indicator.expectedUrlPattern, 'i');
        if (regex.test(currentUrl)) {
          evidence.push(`URL matches expected pattern: ${indicator.expectedUrlPattern} (${currentUrl})`);
          return { outcome: 'AUTHENTICATED', verified: true, finalUrl: currentUrl, evidence };
        }
      }

      if (indicator.type === 'ELEMENT_VISIBLE' && indicator.expectedSelector) {
        try {
          const el = await page.waitForSelector(indicator.expectedSelector, { timeout: 3000, state: 'visible' });
          if (el) {
            evidence.push(`Expected authenticated indicator element is visible: ${indicator.expectedSelector}`);
            return { outcome: 'AUTHENTICATED', verified: true, finalUrl: currentUrl, evidence };
          }
        } catch {
          // Fall through to generic checks
        }
      }

      if (indicator.type === 'COOKIE_PRESENT' && indicator.cookieName) {
        const cookies = await context.cookies();
        const found = cookies.some((c) => c.name.toLowerCase() === indicator.cookieName!.toLowerCase());
        if (found) {
          evidence.push(`Expected session cookie present: ${indicator.cookieName}`);
          return { outcome: 'AUTHENTICATED', verified: true, finalUrl: currentUrl, evidence };
        }
      }
    }

    // 2. Generic Deterministic Verification Heuristics
    let positiveSignals = 0;

    // Signal A: URL transitioned away from login page
    if (currentPath !== loginPath && !currentPath.includes('/login') && !currentPath.includes('/sign-in')) {
      positiveSignals++;
      evidence.push(`Page navigated away from login URL (${loginPath} -> ${currentPath})`);
    }

    // Signal B: Login form password field is no longer present/visible
    try {
      const passwordInput = await page.$('input[type="password"]');
      if (!passwordInput) {
        positiveSignals++;
        evidence.push('Password input field is no longer present in DOM');
      } else {
        const isVisible = await passwordInput.isVisible();
        if (!isVisible) {
          positiveSignals++;
          evidence.push('Password input field is hidden');
        }
      }
    } catch {
      // Ignore DOM inspection error
    }

    // Signal C: Authenticated UI indicators present (e.g. logout/signout button, avatar, user menu, dashboard)
    try {
      const authUiSelector = [
        'a[href*="logout"]',
        'a[href*="signout"]',
        'button[data-testid*="logout"]',
        'button[data-testid*="user-menu"]',
        'button[aria-label*="account"]',
        'button[aria-label*="profile"]',
        'nav [data-testid*="avatar"]',
        '[data-testid*="dashboard"]',
        '[data-testid*="admin"]',
      ].join(', ');

      const authElement = await page.$(authUiSelector);
      if (authElement) {
        positiveSignals += 2;
        evidence.push('Authenticated UI controls (avatar/user menu/logout/dashboard) detected in DOM');
      }
    } catch {
      // Ignore selector failure
    }

    // Signal D: Non-empty session/auth cookies present in browser context
    try {
      const cookies = await context.cookies();
      const authCookies = cookies.filter((c) =>
        /auth|session|token|jwt|user|login|sid/i.test(c.name)
      );
      if (authCookies.length > 0) {
        positiveSignals++;
        evidence.push(`Detected ${authCookies.length} session/auth cookie(s) set by application`);
      }
    } catch {
      // Ignore cookie error
    }

    // 3. Verdict Resolution
    // Require at least 2 independent signals (e.g. URL transition + cookie, or URL transition + no password form)
    if (positiveSignals >= 2) {
      return {
        outcome: 'AUTHENTICATED',
        verified: true,
        finalUrl: currentUrl,
        evidence,
      };
    }

    return {
      outcome: 'AUTHENTICATED_STATE_UNVERIFIED',
      verified: false,
      finalUrl: currentUrl,
      evidence,
      reason: `Insufficient authenticated state signals observed (signals: ${positiveSignals}/2).`,
    };
  }
}
