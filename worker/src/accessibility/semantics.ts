// ==============================================================================
// Sculra Accessible Name Computation & Evaluation Engine (worker/src/accessibility/semantics.ts)
// ==============================================================================

import { Page } from 'playwright';

export interface EvaluatedAccessibleElement {
  selector: string;
  tagName: string;
  type?: string;
  role?: string;
  accessibleName: string;
  hasAccessibleName: boolean;
  nameSource?: string;
  isButton: boolean;
  isLink: boolean;
  isInput: boolean;
  isVisible: boolean;
}

export class AccessibleNameEvaluator {
  /**
   * Evaluates all visible interactive elements on the page for valid accessible names.
   */
  public static async evaluateAccessibleNames(page: Page): Promise<EvaluatedAccessibleElement[]> {
    try {
      return await page.evaluate(() => {
        const results: EvaluatedAccessibleElement[] = [];
        const interactiveSelectors = [
          'button',
          'a[href]',
          'input:not([type="hidden"])',
          'select',
          'textarea',
          '[role="button"]',
          '[role="link"]',
          '[role="checkbox"]',
          '[role="radio"]',
          '[role="combobox"]',
          '[role="menuitem"]',
          '[role="tab"]',
        ];

        const elements = Array.from(document.querySelectorAll(interactiveSelectors.join(', '))).slice(0, 150);

        for (const el of elements) {
          const style = window.getComputedStyle(el);
          const isVisible =
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            !el.hasAttribute('hidden') &&
            !el.closest('[aria-hidden="true"]');

          if (!isVisible) continue;

          let selector = el.tagName.toLowerCase();
          if (el.id) selector = `#${el.id}`;
          else if (el.getAttribute('name')) selector = `${el.tagName.toLowerCase()}[name="${el.getAttribute('name')}"]`;
          else if (el.getAttribute('data-testid')) selector = `[data-testid="${el.getAttribute('data-testid')}"]`;

          let accessibleName = '';
          let nameSource: string | undefined;

          // 1. aria-labelledby
          const labelledBy = el.getAttribute('aria-labelledby');
          if (labelledBy) {
            const ids = labelledBy.trim().split(/\s+/);
            const textParts = ids
              .map((id) => document.getElementById(id)?.textContent || '')
              .filter(Boolean);
            if (textParts.length > 0) {
              accessibleName = textParts.join(' ').trim();
              nameSource = 'aria-labelledby';
            }
          }

          // 2. aria-label
          if (!accessibleName && el.hasAttribute('aria-label')) {
            accessibleName = (el.getAttribute('aria-label') || '').trim();
            if (accessibleName) nameSource = 'aria-label';
          }

          // 3. Associated Label (<label for="..."> or enclosing label)
          if (!accessibleName && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA')) {
            const inputEl = el as HTMLInputElement;
            if (inputEl.labels && inputEl.labels.length > 0) {
              const labelTexts = Array.from(inputEl.labels)
                .map((l) => (l.textContent || '').trim())
                .filter(Boolean);
              if (labelTexts.length > 0) {
                accessibleName = labelTexts.join(' ').trim();
                nameSource = 'label_element';
              }
            }
          }

          // 4. Input value for submit / button
          if (!accessibleName && el.tagName === 'INPUT') {
            const inputType = (el.getAttribute('type') || '').toLowerCase();
            if (inputType === 'submit' || inputType === 'button' || inputType === 'reset') {
              accessibleName = (el.getAttribute('value') || '').trim();
              if (accessibleName) nameSource = 'input_value';
            }
          }

          // 5. Image Alt text inside button / link
          if (!accessibleName) {
            const img = el.querySelector('img');
            if (img && img.hasAttribute('alt')) {
              accessibleName = (img.getAttribute('alt') || '').trim();
              if (accessibleName) nameSource = 'img_alt';
            }
          }

          // 6. Direct textContent
          if (!accessibleName && el.tagName !== 'INPUT') {
            accessibleName = (el.textContent || '').trim();
            if (accessibleName) nameSource = 'text_content';
          }

          // 7. Title attribute
          if (!accessibleName && el.hasAttribute('title')) {
            accessibleName = (el.getAttribute('title') || '').trim();
            if (accessibleName) nameSource = 'title';
          }

          // 8. Placeholder (fallback note)
          if (!accessibleName && el.hasAttribute('placeholder')) {
            accessibleName = (el.getAttribute('placeholder') || '').trim();
            if (accessibleName) nameSource = 'placeholder';
          }

          const hasAccessibleName = accessibleName.length > 0;
          const isButton = el.tagName === 'BUTTON' || el.getAttribute('role') === 'button';
          const isLink = el.tagName === 'A' || el.getAttribute('role') === 'link';
          const isInput = el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA';

          results.push({
            selector,
            tagName: el.tagName.toLowerCase(),
            type: el.getAttribute('type') || undefined,
            role: el.getAttribute('role') || undefined,
            accessibleName,
            hasAccessibleName,
            nameSource,
            isButton,
            isLink,
            isInput,
            isVisible,
          });
        }

        return results;
      });
    } catch (err: any) {
      return [];
    }
  }
}

