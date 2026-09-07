// ==============================================================================
// Sculra Viewport & Page Stability Module (worker/src/visual/stability.ts)
// ==============================================================================

import { Page } from 'playwright';

export interface StabilityOptions {
  networkIdleTimeoutMs?: number;
  fontsTimeoutMs?: number;
  settlingDelayMs?: number;
  disableAnimations?: boolean;
}

export async function stabilizePageForCapture(
  page: Page,
  options: StabilityOptions = {}
): Promise<void> {
  const settlingDelay = options.settlingDelayMs ?? 200;
  const networkTimeout = options.networkIdleTimeoutMs ?? 1000;
  const fontsTimeout = options.fontsTimeoutMs ?? 1000;
  const disableAnimations = options.disableAnimations ?? true;

  try {
    // 1. Wait for DOM readiness if not already loaded
    await page.waitForLoadState('domcontentloaded', { timeout: 3000 }).catch(() => {});

    // 2. Inject CSS to pause/disable volatile animations and transitions
    if (disableAnimations) {
      await page.addStyleTag({
        content: `
          *, *::before, *::after {
            -moz-animation-delay: -1ms !important;
            -moz-animation-duration: 1ms !important;
            -moz-animation-iteration-count: 1 !important;
            -moz-transition-duration: 0s !important;
            -moz-transition-delay: 0s !important;
            -webkit-animation-delay: -1ms !important;
            -webkit-animation-duration: 1ms !important;
            -webkit-animation-iteration-count: 1 !important;
            -webkit-transition-duration: 0s !important;
            -webkit-transition-delay: 0s !important;
            animation-delay: -1ms !important;
            animation-duration: 1ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0s !important;
            transition-delay: 0s !important;
            caret-color: transparent !important;
          }
        `,
      }).catch(() => {});
    }

    // 3. Wait for document.fonts.ready with bounded timeout
    await page.evaluate(async (timeoutMs) => {
      if ('fonts' in document && document.fonts && typeof document.fonts.ready?.then === 'function') {
        const timeout = new Promise((resolve) => setTimeout(resolve, timeoutMs));
        await Promise.race([document.fonts.ready, timeout]);
      }
    }, fontsTimeout).catch(() => {});

    // 4. Bounded network idle wait
    await page.waitForLoadState('networkidle', { timeout: networkTimeout }).catch(() => {});

    // 5. Short settling pause
    if (settlingDelay > 0) {
      await page.waitForTimeout(settlingDelay);
    }
  } catch {
    // Non-blocking: continue even if partial stabilization failed
  }
}
