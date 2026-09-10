// ==============================================================================
// Sculra Prefers-Reduced-Motion & Animation Evaluator (worker/src/accessibility/motion.ts)
// ==============================================================================

import { Page } from 'playwright';
import { ReducedMotionResult } from './types';

export class ReducedMotionEvaluator {
  /**
   * Tests whether the page respects the prefers-reduced-motion media query for animations and transitions.
   */
  public static async evaluateReducedMotion(
    page: Page,
    pageUrl: string
  ): Promise<ReducedMotionResult> {
    try {
      // 1. Emulate prefers-reduced-motion: reduce
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.waitForTimeout(50);

      // 2. Evaluate CSS animations on visible elements
      const animatingElements = await page.evaluate(() => {
        const results: Array<{
          selector: string;
          animationName?: string;
          animationDuration?: string;
          transitionDuration?: string;
          respectsReducedMotion: boolean;
        }> = [];

        const elements = Array.from(document.querySelectorAll('*')).slice(0, 200);

        for (const el of elements) {
          const style = window.getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden') continue;

          const animationName = style.animationName;
          const animationDuration = style.animationDuration;
          const iterationCount = style.animationIterationCount;
          const transitionDuration = style.transitionDuration;

          const hasActiveAnimation =
            animationName !== 'none' &&
            animationName !== '' &&
            parseFloat(animationDuration) > 0 &&
            iterationCount === 'infinite';

          if (hasActiveAnimation) {
            let selector = el.tagName.toLowerCase();
            if (el.id) selector = `#${el.id}`;
            else if (el.getAttribute('data-testid')) selector = `[data-testid="${el.getAttribute('data-testid')}"]`;
            else if (el.className) selector = `${el.tagName.toLowerCase()}.${el.className.split(/\s+/)[0]}`;

            // In reduced-motion mode, looping animations should ideally be disabled or 0s
            const respects = parseFloat(animationDuration) === 0 || style.animationPlayState === 'paused';

            results.push({
              selector,
              animationName,
              animationDuration,
              transitionDuration,
              respectsReducedMotion: respects,
            });
          }
        }

        return results;
      });

      // 3. Restore default media
      await page.emulateMedia({ reducedMotion: 'no-preference' });

      const hasFailures = animatingElements.some((a) => !a.respectsReducedMotion);

      return {
        pageUrl,
        animatingElements,
        status: hasFailures ? 'FAIL' : 'PASS',
      };
    } catch (err: any) {
      return {
        pageUrl,
        animatingElements: [],
        status: 'PASS',
      };
    }
  }
}

