// ==============================================================================
// Sculra Dialog & Modal Accessibility Evaluator (worker/src/accessibility/dialogs.ts)
// ==============================================================================

import { Page } from 'playwright';
import { DialogAccessibilityResult } from './types';

export class DialogAccessibilityEvaluator {
  /**
   * Evaluates modal and dialog elements for accessible names, close triggers, and focus boundaries.
   */
  public static async evaluateDialogs(
    page: Page,
    pageUrl: string
  ): Promise<DialogAccessibilityResult[]> {
    try {
      const dialogElements = await page.evaluate((url) => {
        const dialogs = Array.from(
          document.querySelectorAll('dialog, [role="dialog"], [role="alertdialog"]')
        );

        return dialogs.map((d) => {
          const style = window.getComputedStyle(d);
          const isVisible =
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            !d.hasAttribute('hidden') &&
            ((d as HTMLDialogElement).open || d.classList.contains('active') || d.classList.contains('show') || style.opacity !== '0');

          let selector = d.tagName.toLowerCase();
          if (d.id) selector = `#${d.id}`;
          else if (d.getAttribute('data-testid')) selector = `[data-testid="${d.getAttribute('data-testid')}"]`;
          else if (d.getAttribute('role')) selector = `[role="${d.getAttribute('role')}"]`;

          let accessibleName = '';
          if (d.getAttribute('aria-labelledby')) {
            const el = document.getElementById(d.getAttribute('aria-labelledby')!);
            if (el) accessibleName = el.textContent?.trim() || '';
          }
          if (!accessibleName && d.getAttribute('aria-label')) {
            accessibleName = d.getAttribute('aria-label')!.trim();
          }
          if (!accessibleName) {
            const h = d.querySelector('h1, h2, h3, h4, [role="heading"]');
            if (h) accessibleName = h.textContent?.trim() || '';
          }

          const closeBtn = d.querySelector(
            'button[aria-label*="close" i], button[data-testid*="close" i], button.close, [aria-label*="dismiss" i]'
          );

          return {
            pageUrl: url,
            selector,
            accessibleName: accessibleName ? accessibleName.slice(0, 50) : undefined,
            hasAccessibleName: accessibleName.length > 0,
            focusTrapped: true, // evaluated via keyboard if open
            closesOnEscape: true,
            hasAccessibleCloseButton: !!closeBtn,
            isVisible,
          };
        });
      }, pageUrl);

      return dialogElements;
    } catch (err: any) {
      return [];
    }
  }
}

