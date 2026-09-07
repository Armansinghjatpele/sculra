// ==============================================================================
// Sculra Resilient Selector Strategy & Locator Resolution (worker/src/journeys/selectors.ts)
// ==============================================================================

import { Page, Locator } from 'playwright';

export interface LocatorLookupInput {
  selector?: string;
  targetDescription?: string;
  action?: string;
}

export async function resolveResilientLocator(
  page: Page,
  input: LocatorLookupInput,
  timeoutMs: number = 3000
): Promise<Locator | null> {
  // 1. Primary Strategy: Try explicit resilient selector
  if (input.selector) {
    try {
      const primary = page.locator(input.selector).first();
      const count = await primary.count();
      if (count > 0) {
        return primary;
      }
    } catch {
      // Stale or invalid selector, proceed to semantic fallback
    }
  }

  const desc = (input.targetDescription || '').trim();
  if (!desc) return null;

  // 2. Semantic Role Strategy
  try {
    if (input.action === 'CLICK') {
      // Try button role by accessible name
      const btnLocator = page.getByRole('button', { name: desc, exact: false }).first();
      if ((await btnLocator.count()) > 0) {
        return btnLocator;
      }

      // Try link role
      const linkLocator = page.getByRole('link', { name: desc, exact: false }).first();
      if ((await linkLocator.count()) > 0) {
        return linkLocator;
      }

      // Try text matching button / a
      const textBtn = page.locator(`button:has-text("${desc.replace(/"/g, '\\"')}")`).first();
      if ((await textBtn.count()) > 0) {
        return textBtn;
      }

      const textLink = page.locator(`a:has-text("${desc.replace(/"/g, '\\"')}")`).first();
      if ((await textLink.count()) > 0) {
        return textLink;
      }
    }

    if (input.action === 'FILL' || input.action === 'SELECT' || input.action === 'CHECK') {
      // Try by label
      const labelLocator = page.getByLabel(desc, { exact: false }).first();
      if ((await labelLocator.count()) > 0) {
        return labelLocator;
      }

      // Try by placeholder
      const placeholderLocator = page.getByPlaceholder(desc, { exact: false }).first();
      if ((await placeholderLocator.count()) > 0) {
        return placeholderLocator;
      }

      // Try by name attribute
      const nameLocator = page.locator(`[name="${desc.replace(/"/g, '\\"')}"]`).first();
      if ((await nameLocator.count()) > 0) {
        return nameLocator;
      }
    }
  } catch {
    // Semantic lookup exception, return null
  }

  return null;
}
