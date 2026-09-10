// ==============================================================================
// Sculra Focus Visibility & Indicator Evaluator (worker/src/accessibility/focus.ts)
// ==============================================================================

import { Page } from 'playwright';
import { FocusVisibilityResult } from './types';

export class FocusVisibilityEvaluator {
  /**
   * Evaluates whether interactive controls on the page have a visible focus indicator when focused.
   */
  public static async evaluateFocusVisibility(
    page: Page,
    pageUrl: string
  ): Promise<FocusVisibilityResult[]> {
    try {
      return await page.evaluate((url) => {
        const results: FocusVisibilityResult[] = [];
        const interactiveSelectors = [
          'button:not([disabled])',
          'a[href]',
          'input:not([type="hidden"]):not([disabled])',
          'select:not([disabled])',
          'textarea:not([disabled])',
          '[tabindex="0"]',
          '[role="button"]',
        ];

        const elements = Array.from(document.querySelectorAll(interactiveSelectors.join(', '))).slice(0, 50);

        for (const el of elements) {
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);

          if (style.display === 'none' || style.visibility === 'hidden' || rect.width === 0) {
            continue;
          }

          let selector = el.tagName.toLowerCase();
          if (el.id) selector = `#${el.id}`;
          else if (el.getAttribute('name')) selector = `${el.tagName.toLowerCase()}[name="${el.getAttribute('name')}"]`;
          else if (el.getAttribute('data-testid')) selector = `[data-testid="${el.getAttribute('data-testid')}"]`;

          // Focus the element to check active computed focus styles
          (el as HTMLElement).focus();
          const focusedStyle = window.getComputedStyle(el);

          const outlineWidth = parseFloat(focusedStyle.outlineWidth) || 0;
          const outlineStyle = focusedStyle.outlineStyle;
          const outlineColor = focusedStyle.outlineColor;
          const boxShadow = focusedStyle.boxShadow;

          const hasVisibleOutline =
            outlineStyle !== 'none' && outlineStyle !== '' && outlineWidth > 0 && outlineColor !== 'transparent';
          const hasVisibleBoxShadow =
            boxShadow !== 'none' && boxShadow !== '' && !boxShadow.includes('rgba(0, 0, 0, 0)');
          const hasDistinctBorderOrBackground =
            focusedStyle.borderWidth !== style.borderWidth ||
            focusedStyle.borderColor !== style.borderColor ||
            focusedStyle.backgroundColor !== style.backgroundColor;

          const isVisible = hasVisibleOutline || hasVisibleBoxShadow || hasDistinctBorderOrBackground;

          results.push({
            pageUrl: url,
            selector,
            role: el.getAttribute('role') || el.tagName.toLowerCase(),
            accessibleName: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 50),
            outlineWidth,
            outlineStyle,
            outlineColor,
            boxShadow,
            hasDistinctBorderOrBackground,
            isVisible,
            isConclusive: true,
          });
        }

        return results;
      }, pageUrl);
    } catch (err: any) {
      return [];
    }
  }
}

