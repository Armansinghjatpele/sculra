// ==============================================================================
// Sculra Status Message & Accessible State Evaluator (worker/src/accessibility/errors.ts)
// ==============================================================================

import { Page } from 'playwright';

export interface EvaluatedStatusState {
  selector: string;
  role?: string;
  ariaLive?: string;
  ariaBusy?: boolean;
  ariaDisabled?: boolean;
  text?: string;
  isAnnounced: boolean;
  isLiveRegion: boolean;
}

export class StatusMessageEvaluator {
  /**
   * Evaluates dynamic status messages, alerts, and live region announcements.
   */
  public static async evaluateStatusMessages(page: Page): Promise<EvaluatedStatusState[]> {
    try {
      return await page.evaluate(() => {
        const results: EvaluatedStatusState[] = [];
        const liveSelectors = [
          '[role="status"]',
          '[role="alert"]',
          '[aria-live]',
          '[aria-busy="true"]',
          '[role="progressbar"]',
          'button[disabled]',
          '[aria-disabled="true"]',
        ];

        const elements = Array.from(document.querySelectorAll(liveSelectors.join(', '))).slice(0, 50);

        for (const el of elements) {
          let selector = el.tagName.toLowerCase();
          if (el.id) selector = `#${el.id}`;
          else if (el.getAttribute('data-testid')) selector = `[data-testid="${el.getAttribute('data-testid')}"]`;
          else if (el.getAttribute('role')) selector = `[role="${el.getAttribute('role')}"]`;

          const role = el.getAttribute('role') || undefined;
          const ariaLive = el.getAttribute('aria-live') || undefined;
          const ariaBusy = el.getAttribute('aria-busy') === 'true';
          const ariaDisabled = el.getAttribute('aria-disabled') === 'true' || el.hasAttribute('disabled');
          const isLiveRegion = role === 'alert' || role === 'status' || ariaLive === 'polite' || ariaLive === 'assertive';

          results.push({
            selector,
            role,
            ariaLive,
            ariaBusy,
            ariaDisabled,
            text: (el.textContent || '').trim().slice(0, 50),
            isAnnounced: isLiveRegion,
            isLiveRegion,
          });
        }

        return results;
      });
    } catch (err: any) {
      return [];
    }
  }
}

