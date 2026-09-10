// ==============================================================================
// Sculra Heading Structure & Hierarchy Evaluator (worker/src/accessibility/headings.ts)
// ==============================================================================

import { Page } from 'playwright';
import { HeadingItem } from './types';

export class HeadingHierarchyEvaluator {
  /**
   * Analyzes the heading hierarchy on the page to identify structural gaps or empty headings.
   */
  public static async evaluateHeadings(page: Page): Promise<{
    headings: HeadingItem[];
    hasSkippedHeadings: boolean;
  }> {
    try {
      return await page.evaluate(() => {
        const headings: HeadingItem[] = [];
        const headingElements = Array.from(
          document.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]')
        );

        let previousLevel = 0;
        let hasSkippedHeadings = false;

        for (const el of headingElements) {
          const style = window.getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden' || el.hasAttribute('hidden')) {
            continue;
          }

          let level = 1;
          const tagName = el.tagName.toLowerCase();
          if (tagName.startsWith('h') && tagName.length === 2) {
            level = parseInt(tagName.substring(1), 10);
          } else if (el.getAttribute('aria-level')) {
            level = parseInt(el.getAttribute('aria-level')!, 10) || 2;
          } else {
            level = 2; // Default heading role level
          }

          const text = (el.textContent || '').trim();
          const isEmpty = text.length === 0;

          // Skipped hierarchy: increasing by more than 1 level (e.g. h1 to h3)
          let isSkipped = false;
          if (previousLevel > 0 && level > previousLevel + 1) {
            isSkipped = true;
            hasSkippedHeadings = true;
          }

          previousLevel = level;

          let selector = tagName;
          if (el.id) selector = `#${el.id}`;
          else if (el.getAttribute('data-testid')) selector = `[data-testid="${el.getAttribute('data-testid')}"]`;
          else if (text) selector = `${tagName}:has-text("${text.slice(0, 20)}")`;

          headings.push({
            level,
            text: text.slice(0, 100),
            selector,
            isSkipped,
            isEmpty,
          });
        }

        return {
          headings,
          hasSkippedHeadings,
        };
      });
    } catch (err: any) {
      return { headings: [], hasSkippedHeadings: false };
    }
  }
}

