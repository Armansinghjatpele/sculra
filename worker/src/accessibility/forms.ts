// ==============================================================================
// Sculra Form Accessibility & Association Evaluator (worker/src/accessibility/forms.ts)
// ==============================================================================

import { Page } from 'playwright';
import { FormAccessibilityResult } from './types';

export class FormAccessibilityEvaluator {
  /**
   * Evaluates forms and their inputs for labeling, associations, required states, and error handling.
   */
  public static async evaluateForms(
    page: Page,
    pageUrl: string
  ): Promise<FormAccessibilityResult[]> {
    try {
      return await page.evaluate((url) => {
        const results: FormAccessibilityResult[] = [];
        const forms = Array.from(document.querySelectorAll('form'));

        if (forms.length === 0) {
          // Also inspect orphan input elements outside explicit form tags
          const orphanInputs = Array.from(
            document.querySelectorAll('input:not([type="hidden"]), select, textarea')
          ).filter((el) => !el.closest('form'));

          if (orphanInputs.length > 0) {
            const inputDetails = orphanInputs.map((el) => {
              const inputEl = el as HTMLInputElement;
              let selector = el.tagName.toLowerCase();
              if (el.id) selector = `#${el.id}`;
              else if (el.getAttribute('name')) selector = `${el.tagName.toLowerCase()}[name="${el.getAttribute('name')}"]`;
              else if (el.getAttribute('data-testid')) selector = `[data-testid="${el.getAttribute('data-testid')}"]`;

              let hasLabel = false;
              let labelSource: any = undefined;
              let accessibleName = '';

              if (el.getAttribute('aria-labelledby')) {
                const labelTarget = document.getElementById(el.getAttribute('aria-labelledby')!);
                if (labelTarget && labelTarget.textContent?.trim()) {
                  hasLabel = true;
                  labelSource = 'aria_labelledby';
                  accessibleName = labelTarget.textContent.trim();
                }
              } else if (el.getAttribute('aria-label')) {
                hasLabel = true;
                labelSource = 'aria_label';
                accessibleName = el.getAttribute('aria-label')!.trim();
              } else if (inputEl.labels && inputEl.labels.length > 0) {
                const txt = Array.from(inputEl.labels).map((l) => l.textContent?.trim()).filter(Boolean).join(' ');
                if (txt) {
                  hasLabel = true;
                  labelSource = el.id && document.querySelector(`label[for="${el.id}"]`) ? 'for_id' : 'enclosing_label';
                  accessibleName = txt;
                }
              }

              const isRequired = el.hasAttribute('required');
              const hasAriaRequired = el.getAttribute('aria-required') === 'true';
              const isInvalid = el.getAttribute('aria-invalid') === 'true' || el.classList.contains('is-invalid') || el.classList.contains('error');
              const describedBy = el.getAttribute('aria-describedby');
              const errTarget = describedBy ? document.getElementById(describedBy) : null;
              const hasAssociatedError = isInvalid && (!!errTarget || el.hasAttribute('aria-errormessage'));

              return {
                selector,
                name: el.getAttribute('name') || undefined,
                type: el.getAttribute('type') || el.tagName.toLowerCase(),
                accessibleName: accessibleName ? accessibleName.slice(0, 50) : undefined,
                hasAssociatedLabel: hasLabel,
                labelSource,
                isRequired,
                hasAriaRequired,
                hasAutocomplete: el.hasAttribute('autocomplete') && el.getAttribute('autocomplete') !== 'off',
                autocompleteValue: el.getAttribute('autocomplete') || undefined,
                isInvalid,
                hasAssociatedError,
                errorAssociationSource: el.hasAttribute('aria-errormessage') ? ('aria_errormessage' as const) : describedBy ? ('aria_describedby' as const) : undefined,
                errorMessageText: errTarget ? errTarget.textContent?.trim() : undefined,
              };
            });

            const defects: string[] = [];
            for (const inp of inputDetails) {
              if (!inp.hasAssociatedLabel) defects.push(`Input ${inp.selector} is missing an associated label`);
              if (inp.isInvalid && !inp.hasAssociatedError) defects.push(`Input ${inp.selector} has error state without programmatic association`);
            }

            results.push({
              pageUrl: url,
              formSelector: 'body (orphan inputs)',
              inputsCount: inputDetails.length,
              inputs: inputDetails,
              isAccessible: defects.length === 0,
              defects,
            });
          }
        }

        for (let i = 0; i < forms.length; i++) {
          const form = forms[i];
          const formSelector = form.id ? `#${form.id}` : form.getAttribute('action') ? `form[action="${form.getAttribute('action')}"]` : `form:nth-of-type(${i + 1})`;

          const inputs = Array.from(
            form.querySelectorAll('input:not([type="hidden"]), select, textarea')
          );

          const inputDetails = inputs.map((el) => {
            const inputEl = el as HTMLInputElement;
            let selector = el.tagName.toLowerCase();
            if (el.id) selector = `#${el.id}`;
            else if (el.getAttribute('name')) selector = `${el.tagName.toLowerCase()}[name="${el.getAttribute('name')}"]`;
            else if (el.getAttribute('data-testid')) selector = `[data-testid="${el.getAttribute('data-testid')}"]`;

            let hasLabel = false;
            let labelSource: any = undefined;
            let accessibleName = '';

            if (el.getAttribute('aria-labelledby')) {
              const labelTarget = document.getElementById(el.getAttribute('aria-labelledby')!);
              if (labelTarget && labelTarget.textContent?.trim()) {
                hasLabel = true;
                labelSource = 'aria_labelledby';
                accessibleName = labelTarget.textContent.trim();
              }
            } else if (el.getAttribute('aria-label')) {
              hasLabel = true;
              labelSource = 'aria_label';
              accessibleName = el.getAttribute('aria-label')!.trim();
            } else if (inputEl.labels && inputEl.labels.length > 0) {
              const txt = Array.from(inputEl.labels).map((l) => l.textContent?.trim()).filter(Boolean).join(' ');
              if (txt) {
                hasLabel = true;
                labelSource = el.id && document.querySelector(`label[for="${el.id}"]`) ? 'for_id' : 'enclosing_label';
                accessibleName = txt;
              }
            }

            const isRequired = el.hasAttribute('required');
            const hasAriaRequired = el.getAttribute('aria-required') === 'true';
            const isInvalid = el.getAttribute('aria-invalid') === 'true' || el.classList.contains('is-invalid') || el.classList.contains('error');
            const describedBy = el.getAttribute('aria-describedby');
            const errTarget = describedBy ? document.getElementById(describedBy) : null;
            const hasAssociatedError = isInvalid && (!!errTarget || el.hasAttribute('aria-errormessage'));

            return {
              selector,
              name: el.getAttribute('name') || undefined,
              type: el.getAttribute('type') || el.tagName.toLowerCase(),
              accessibleName: accessibleName ? accessibleName.slice(0, 50) : undefined,
              hasAssociatedLabel: hasLabel,
              labelSource,
              isRequired,
              hasAriaRequired,
              hasAutocomplete: el.hasAttribute('autocomplete') && el.getAttribute('autocomplete') !== 'off',
              autocompleteValue: el.getAttribute('autocomplete') || undefined,
              isInvalid,
              hasAssociatedError,
              errorAssociationSource: el.hasAttribute('aria-errormessage') ? ('aria_errormessage' as const) : describedBy ? ('aria_describedby' as const) : undefined,
              errorMessageText: errTarget ? errTarget.textContent?.trim() : undefined,
            };
          });

          const defects: string[] = [];
          for (const inp of inputDetails) {
            if (!inp.hasAssociatedLabel) defects.push(`Input ${inp.selector} is missing an associated label`);
            if (inp.isInvalid && !inp.hasAssociatedError) defects.push(`Input ${inp.selector} has error state without programmatic association`);
          }

          results.push({
            pageUrl: url,
            formSelector,
            inputsCount: inputDetails.length,
            inputs: inputDetails,
            isAccessible: defects.length === 0,
            defects,
          });
        }

        return results;
      }, pageUrl);
    } catch (err: any) {
      return [];
    }
  }
}

