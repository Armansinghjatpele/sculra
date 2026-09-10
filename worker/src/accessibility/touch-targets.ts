// ==============================================================================
// Sculra Mobile Touch Target Size Evaluator (worker/src/accessibility/touch-targets.ts)
// ==============================================================================

import { Page } from 'playwright';
import { TouchTargetResult } from './types';
import { AccessibilityPolicyConfig, DEFAULT_ACCESSIBILITY_POLICY } from './policy';

export class TouchTargetEvaluator {
  /**
   * Measures interactive target bounding boxes on mobile viewports to enforce touch target guidelines.
   */
  public static async evaluateTouchTargets(
    page: Page,
    pageUrl: string,
    policy?: Partial<AccessibilityPolicyConfig>
  ): Promise<TouchTargetResult[]> {
    const activePolicy = { ...DEFAULT_ACCESSIBILITY_POLICY, ...policy };

    try {
      return await page.evaluate(
        ({ url, maxChecks, minDimension }) => {
          const results: TouchTargetResult[] = [];
          const targetSelectors = [
            'button',
            'a[href]',
            'input:not([type="hidden"])',
            'select',
            'textarea',
            '[role="button"]',
            '[role="checkbox"]',
            '[role="radio"]',
            '[tabindex="0"]',
          ];

          const elements = Array.from(document.querySelectorAll(targetSelectors.join(', '))).slice(0, maxChecks);

          for (const el of elements) {
            const style = window.getComputedStyle(el);
            const rect = el.getBoundingClientRect();

            if (
              style.display === 'none' ||
              style.visibility === 'hidden' ||
              el.hasAttribute('hidden') ||
              rect.width === 0 ||
              rect.height === 0
            ) {
              continue;
            }

            // Exclude inline text links that flow within normal paragraph text
            const isInlineLink =
              el.tagName === 'A' &&
              style.display === 'inline' &&
              el.parentElement &&
              (el.parentElement.tagName === 'P' || el.parentElement.tagName === 'LI');

            if (isInlineLink) {
              continue;
            }

            let selector = el.tagName.toLowerCase();
            if (el.id) selector = `#${el.id}`;
            else if (el.getAttribute('data-testid')) selector = `[data-testid="${el.getAttribute('data-testid')}"]`;
            else if (el.getAttribute('name')) selector = `${el.tagName.toLowerCase()}[name="${el.getAttribute('name')}"]`;

            const isCompliant = rect.width >= minDimension && rect.height >= minDimension;

            results.push({
              pageUrl: url,
              selector,
              role: el.getAttribute('role') || el.tagName.toLowerCase(),
              accessibleName: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 50),
              width: Math.round(rect.width * 10) / 10,
              height: Math.round(rect.height * 10) / 10,
              x: Math.round(rect.x * 10) / 10,
              y: Math.round(rect.y * 10) / 10,
              isCompliant,
              minimumRequired: minDimension,
            });
          }

          return results;
        },
        {
          url: pageUrl,
          maxChecks: activePolicy.maxTouchTargetChecks,
          minDimension: activePolicy.touchTargetMinDimension,
        }
      );
    } catch (err: any) {
      return [];
    }
  }
}

