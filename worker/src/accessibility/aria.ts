// ==============================================================================
// Sculra WAI-ARIA Deterministic Validation Engine (worker/src/accessibility/aria.ts)
// ==============================================================================

import { Page } from 'playwright';
import { AriaValidationItem } from './types';

// Standard WAI-ARIA 1.2 / 1.3 Role Registry
const VALID_ARIA_ROLES = new Set([
  'alert', 'alertdialog', 'application', 'article', 'banner', 'button', 'cell', 'checkbox',
  'columnheader', 'combobox', 'complementary', 'contentinfo', 'definition', 'dialog', 'directory',
  'document', 'feed', 'figure', 'form', 'generic', 'grid', 'gridcell', 'group', 'heading',
  'img', 'link', 'list', 'listbox', 'listitem', 'log', 'main', 'marquee', 'math', 'menu',
  'menubar', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'navigation', 'none', 'note',
  'option', 'presentation', 'progressbar', 'radio', 'radiogroup', 'region', 'row', 'rowgroup',
  'rowheader', 'scrollbar', 'search', 'searchbox', 'separator', 'slider', 'spinbutton',
  'status', 'switch', 'tab', 'table', 'tablist', 'tabpanel', 'term', 'textbox', 'timer',
  'toolbar', 'tooltip', 'tree', 'treegrid', 'treeitem'
]);

// Valid WAI-ARIA Global and Widget Attributes
const VALID_ARIA_ATTRIBUTES = new Set([
  'aria-activedescendant', 'aria-atomic', 'aria-autocomplete', 'aria-busy', 'aria-checked',
  'aria-colcount', 'aria-colindex', 'aria-colspan', 'aria-controls', 'aria-current',
  'aria-describedby', 'aria-description', 'aria-details', 'aria-disabled', 'aria-errormessage',
  'aria-expanded', 'aria-flowto', 'aria-haspopup', 'aria-hidden', 'aria-invalid',
  'aria-keyshortcuts', 'aria-label', 'aria-labelledby', 'aria-level', 'aria-live',
  'aria-modal', 'aria-multiline', 'aria-multiselectable', 'aria-orientation', 'aria-owns',
  'aria-placeholder', 'aria-posinset', 'aria-pressed', 'aria-readonly', 'aria-relevant',
  'aria-required', 'aria-roledescription', 'aria-rowcount', 'aria-rowindex', 'aria-rowspan',
  'aria-selected', 'aria-setsize', 'aria-sort', 'aria-valuemax', 'aria-valuemin',
  'aria-valuenow', 'aria-valuetext'
]);

export class AriaValidator {
  /**
   * Validates ARIA attributes, roles, hidden focusables, and reference associations.
   */
  public static async validateAria(page: Page): Promise<AriaValidationItem[]> {
    try {
      return await page.evaluate(
        ({ validRolesList, validAttrsList }) => {
          const validRoles = new Set(validRolesList);
          const validAttrs = new Set(validAttrsList);
          const results: AriaValidationItem[] = [];

          const allElements = Array.from(document.querySelectorAll('*')).slice(0, 300);

          for (const el of allElements) {
            const invalidRoles: string[] = [];
            const invalidAttributes: string[] = [];
            let hiddenFocusable = false;
            const brokenReferences: string[] = [];

            // 1. Role validation
            const roleAttr = el.getAttribute('role');
            if (roleAttr) {
              const roles = roleAttr.trim().split(/\s+/);
              for (const r of roles) {
                if (!validRoles.has(r.toLowerCase())) {
                  invalidRoles.push(r);
                }
              }
            }

            // 2. ARIA attribute validation
            const attrNames = el.getAttributeNames();
            for (const name of attrNames) {
              if (name.startsWith('aria-')) {
                if (!validAttrs.has(name.toLowerCase())) {
                  invalidAttributes.push(name);
                }
              }
            }

            // 3. aria-hidden on focusable content
            if (el.getAttribute('aria-hidden') === 'true') {
              const isNaturallyFocusable =
                el.tagName === 'A' && el.hasAttribute('href') ||
                el.tagName === 'BUTTON' ||
                el.tagName === 'INPUT' ||
                el.tagName === 'SELECT' ||
                el.tagName === 'TEXTAREA' ||
                (el.hasAttribute('tabindex') && el.getAttribute('tabindex') !== '-1');

              const hasFocusableChild = el.querySelector(
                'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
              ) !== null;

              if (isNaturallyFocusable || hasFocusableChild) {
                hiddenFocusable = true;
              }
            }

            // 4. Broken reference checks (aria-labelledby, aria-describedby, aria-controls, aria-owns)
            const refAttrs = ['aria-labelledby', 'aria-describedby', 'aria-controls', 'aria-owns'];
            for (const refAttr of refAttrs) {
              const val = el.getAttribute(refAttr);
              if (val) {
                const ids = val.trim().split(/\s+/);
                for (const id of ids) {
                  if (!document.getElementById(id)) {
                    brokenReferences.push(`${refAttr} references non-existent ID "${id}"`);
                  }
                }
              }
            }

            if (
              invalidRoles.length > 0 ||
              invalidAttributes.length > 0 ||
              hiddenFocusable ||
              brokenReferences.length > 0
            ) {
              let selector = el.tagName.toLowerCase();
              if (el.id) selector = `#${el.id}`;
              else if (el.getAttribute('data-testid')) selector = `[data-testid="${el.getAttribute('data-testid')}"]`;
              else if (el.getAttribute('name')) selector = `${el.tagName.toLowerCase()}[name="${el.getAttribute('name')}"]`;

              results.push({
                selector,
                invalidRoles,
                invalidAttributes,
                hiddenFocusable,
                brokenReferences,
              });
            }
          }

          return results;
        },
        {
          validRolesList: Array.from(VALID_ARIA_ROLES),
          validAttrsList: Array.from(VALID_ARIA_ATTRIBUTES),
        }
      );
    } catch (err: any) {
      return [];
    }
  }
}

