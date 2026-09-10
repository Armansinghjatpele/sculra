// ==============================================================================
// Sculra Playwright Keyboard Navigation & Trap Detection Engine (worker/src/accessibility/keyboard.ts)
// ==============================================================================

import { Page } from 'playwright';
import { FocusedElementTrace, KeyboardNavigationResult } from './types';
import { AccessibilityPolicyConfig, DEFAULT_ACCESSIBILITY_POLICY } from './policy';
import { WorkerLogger } from '../logger';

export class KeyboardNavigationEngine {
  private policy: AccessibilityPolicyConfig;
  private logger?: WorkerLogger;

  constructor(policy?: Partial<AccessibilityPolicyConfig>, logger?: WorkerLogger) {
    this.policy = { ...DEFAULT_ACCESSIBILITY_POLICY, ...policy };
    this.logger = logger;
  }

  /**
   * Performs bounded keyboard tab navigation on the page, tracking focus order and detecting traps.
   */
  public async evaluateKeyboardNavigation(
    page: Page,
    pageUrl: string,
    viewport: 'desktop' | 'tablet' | 'mobile' = 'desktop'
  ): Promise<KeyboardNavigationResult> {
    const startTime = Date.now();
    const focusedSequence: FocusedElementTrace[] = [];
    const seenElementSelectors: string[] = [];
    let trapsDetected = false;
    let trapDetails: { selector: string; cyclicStepCount: number } | undefined;

    try {
      // 1. Discover all naturally focusable interactive elements on the page first
      const focusableCandidates: string[] = await page.evaluate(() => {
        const selectorList = [
          'a[href]',
          'button:not([disabled])',
          'input:not([type="hidden"]):not([disabled])',
          'select:not([disabled])',
          'textarea:not([disabled])',
          '[tabindex]:not([tabindex="-1"])',
          '[role="button"]:not([aria-disabled="true"])',
          '[role="link"]',
          '[role="checkbox"]',
          '[role="combobox"]',
          '[role="menuitem"]',
        ];

          function getElementSelector(el: Element): string {
            if (el.id) return `#${el.id}`;
            const testId = el.getAttribute('data-testid');
            if (testId) return `[data-testid="${testId}"]`;
            const name = el.getAttribute('name');
            if (name) return `${el.tagName.toLowerCase()}[name="${name}"]`;
            const ariaLabel = el.getAttribute('aria-label');
            if (ariaLabel) return `${el.tagName.toLowerCase()}[aria-label="${ariaLabel}"]`;
            const href = el.getAttribute('href');
            if (href) return `${el.tagName.toLowerCase()}[href="${href}"]`;
            const role = el.getAttribute('role');
            if (role) return `[role="${role}"]`;
            return el.tagName.toLowerCase();
          }

          const elements = Array.from(document.querySelectorAll(selectorList.join(', ')));
          return elements
            .filter((el) => {
              const rect = el.getBoundingClientRect();
              const style = window.getComputedStyle(el);
              return (
                style.display !== 'none' &&
                style.visibility !== 'hidden' &&
                style.opacity !== '0' &&
                rect.width > 0 &&
                rect.height > 0 &&
                !el.closest('[aria-hidden="true"]')
              );
            })
            .map((el) => getElementSelector(el));
        });

      // 2. Focus the page at the top
      await page.evaluate(() => {
        window.scrollTo(0, 0);
        if (document.body) {
          document.body.focus();
        }
      });

      // 3. Tab through elements up to maxKeyboardSteps
      const maxSteps = Math.min(this.policy.maxKeyboardSteps, 150);
      const recentSelectors: string[] = [];

      for (let step = 1; step <= maxSteps; step++) {
        await page.keyboard.press('Tab');
        await page.waitForTimeout(30);

        const currentActive = await page.evaluate((orderNum) => {
          const active = document.activeElement;
          if (!active || active === document.body || active === document.documentElement) {
            return null;
          }

          const rect = active.getBoundingClientRect();
          const style = window.getComputedStyle(active);

          function getElementSelector(el: Element): string {
            if (el.id) return `#${el.id}`;
            const testId = el.getAttribute('data-testid');
            if (testId) return `[data-testid="${testId}"]`;
            const name = el.getAttribute('name');
            if (name) return `${el.tagName.toLowerCase()}[name="${name}"]`;
            const ariaLabel = el.getAttribute('aria-label');
            if (ariaLabel) return `${el.tagName.toLowerCase()}[aria-label="${ariaLabel}"]`;
            const href = el.getAttribute('href');
            if (href) return `${el.tagName.toLowerCase()}[href="${href}"]`;
            const role = el.getAttribute('role');
            if (role) return `[role="${role}"]`;
            return el.tagName.toLowerCase();
          }

          const selector = getElementSelector(active);

          // Accessible name
          let accessibleName = active.getAttribute('aria-label') || '';
          if (!accessibleName && active.getAttribute('aria-labelledby')) {
            const labelEl = document.getElementById(active.getAttribute('aria-labelledby')!);
            if (labelEl) accessibleName = labelEl.textContent || '';
          }
          if (!accessibleName && (active as HTMLInputElement).labels && (active as HTMLInputElement).labels!.length > 0) {
            accessibleName = (active as HTMLInputElement).labels![0].textContent || '';
          }
          if (!accessibleName) {
            accessibleName = (active.textContent || '').trim();
          }

          const hasVisibleOutline =
            style.outlineStyle !== 'none' &&
            style.outlineStyle !== '' &&
            parseFloat(style.outlineWidth) > 0;
          const hasBoxShadow = style.boxShadow !== 'none' && style.boxShadow !== '';

          return {
            order: orderNum,
            selector,
            tagName: active.tagName.toLowerCase(),
            role: active.getAttribute('role') || undefined,
            accessibleName: accessibleName ? accessibleName.slice(0, 100) : undefined,
            tabIndex: (active as HTMLElement).tabIndex,
            hasVisibleFocus: hasVisibleOutline || hasBoxShadow,
            computedOutline: `${style.outlineWidth} ${style.outlineStyle} ${style.outlineColor}`,
            computedBoxShadow: style.boxShadow,
            isVisible: style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0,
            boundingBox: {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
            },
          };
        }, step);

        if (!currentActive) {
          // Reached end of tab cycle or body
          if (step > 1 && focusedSequence.length > 0) {
            break;
          }
          continue;
        }

        focusedSequence.push(currentActive);
        seenElementSelectors.push(currentActive.selector);
        recentSelectors.push(currentActive.selector);

        // Trap Detection: Check if focus is cycling endlessly in a small loop of <= 4 elements
        if (recentSelectors.length >= 12) {
          const tail = recentSelectors.slice(-8);
          const firstHalf = tail.slice(0, 4).join('|');
          const secondHalf = tail.slice(4, 8).join('|');
          if (firstHalf === secondHalf) {
            trapsDetected = true;
            trapDetails = {
              selector: currentActive.selector,
              cyclicStepCount: 4,
            };
            this.logger?.warn('keyboard_trap_detected', {
              pageUrl,
              selector: currentActive.selector,
              loop: tail,
            });
            break;
          }
        }
      }

      // 4. Identify Unreachable Focusable Elements
      const uniqueVisited = new Set(seenElementSelectors);
      const unreachable = focusableCandidates.filter((cand) => !uniqueVisited.has(cand));

      return {
        pageUrl,
        viewport,
        totalSteps: focusedSequence.length,
        focusedSequence,
        unreachableElementsCount: unreachable.length,
        unreachableSelectors: unreachable.slice(0, 20),
        trapsDetected,
        trapDetails,
        durationMs: Date.now() - startTime,
      };
    } catch (err: any) {
      return {
        pageUrl,
        viewport,
        totalSteps: focusedSequence.length,
        focusedSequence,
        unreachableElementsCount: 0,
        unreachableSelectors: [],
        trapsDetected: false,
        durationMs: Date.now() - startTime,
      };
    }
  }
}

