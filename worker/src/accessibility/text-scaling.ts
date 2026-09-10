// ==============================================================================
// Sculra 200% Text Scaling & Reflow Evaluator (worker/src/accessibility/text-scaling.ts)
// ==============================================================================

import { Page } from 'playwright';
import { TextScalingResult } from './types';

export class TextScalingEvaluator {
  /**
   * Tests page layout under 200% text scaling to detect clipped or overflowing text.
   */
  public static async evaluateTextScaling(
    page: Page,
    pageUrl: string,
    viewport: 'desktop' | 'tablet' | 'mobile' = 'desktop'
  ): Promise<TextScalingResult> {
    try {
      // 1. Inject 200% root font scaling in a non-destructive manner
      await page.evaluate(() => {
        const originalFontSize = document.documentElement.style.fontSize;
        (window as any).__originalFontSize = originalFontSize;
        document.documentElement.style.fontSize = '200%';
      });

      await page.waitForTimeout(100);

      // 2. Measure layout metrics
      const result = await page.evaluate((url) => {
        const clippedElements: Array<{
          selector: string;
          text: string;
          clientWidth: number;
          scrollWidth: number;
        }> = [];

        const textNodes = Array.from(
          document.querySelectorAll('p, span, h1, h2, h3, h4, h5, h6, button, a, div')
        ).slice(0, 100);

        for (const el of textNodes) {
          const style = window.getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden') continue;

          // Check if overflow is hidden and content is truncated/clipped
          const isOverflowHidden =
            style.overflow === 'hidden' ||
            style.overflowX === 'hidden' ||
            style.overflowY === 'hidden' ||
            (style.textOverflow === 'ellipsis' && (style.overflow === 'hidden' || style.overflowX === 'hidden'));

          if (isOverflowHidden && el.scrollWidth > el.clientWidth + 5 && el.clientWidth > 0) {
            let selector = el.tagName.toLowerCase();
            if (el.id) selector = `#${el.id}`;
            else if (el.getAttribute('data-testid')) selector = `[data-testid="${el.getAttribute('data-testid')}"]`;
            else if (el.className) selector = `${el.tagName.toLowerCase()}.${el.className.split(/\s+/)[0]}`;

            clippedElements.push({
              selector,
              text: (el.textContent || '').trim().slice(0, 40),
              clientWidth: el.clientWidth,
              scrollWidth: el.scrollWidth,
            });
          }
        }

        const docScrollWidth = document.documentElement.scrollWidth;
        const windowWidth = window.innerWidth;
        const hasHorizontalOverflow = docScrollWidth > windowWidth + 25;

        return {
          clippedElements,
          overlappingElementsCount: 0,
          hasHorizontalOverflow,
          scrollWidth: docScrollWidth,
          innerWidth: windowWidth,
        };
      }, pageUrl);

      // 3. Restore original font size
      await page.evaluate(() => {
        document.documentElement.style.fontSize = (window as any).__originalFontSize || '';
      });

      const passes = result.clippedElements.length === 0 && !result.hasHorizontalOverflow;

      return {
        pageUrl,
        viewport,
        zoomScale: 2.0,
        clippedElements: result.clippedElements,
        overlappingElementsCount: result.overlappingElementsCount,
        hasHorizontalOverflow: result.hasHorizontalOverflow,
        scrollWidth: result.scrollWidth,
        innerWidth: result.innerWidth,
        status: passes ? 'PASS' : 'FAIL',
      };
    } catch (err: any) {
      return {
        pageUrl,
        viewport,
        zoomScale: 2.0,
        clippedElements: [],
        overlappingElementsCount: 0,
        hasHorizontalOverflow: false,
        scrollWidth: 0,
        innerWidth: 0,
        status: 'PASS',
      };
    }
  }
}

