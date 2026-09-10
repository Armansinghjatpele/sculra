// ==============================================================================
// Sculra HTML5 & ARIA Landmark Structure Evaluator (worker/src/accessibility/landmarks.ts)
// ==============================================================================

import { Page } from 'playwright';
import { LandmarkItem } from './types';

export class LandmarkEvaluator {
  /**
   * Analyzes page landmarks for main region availability and duplicate landmarks.
   */
  public static async evaluateLandmarks(page: Page): Promise<{
    landmarks: LandmarkItem[];
    hasMainLandmark: boolean;
    duplicateMainLandmarksCount: number;
  }> {
    try {
      return await page.evaluate(() => {
        const landmarks: LandmarkItem[] = [];
        const mainLandmarks: HTMLElement[] = [];

        const landmarkSelectors = [
          'main', '[role="main"]',
          'header', '[role="banner"]',
          'nav', '[role="navigation"]',
          'footer', '[role="contentinfo"]',
          'aside', '[role="complementary"]',
          '[role="search"]',
        ];

        const elements = Array.from(document.querySelectorAll(landmarkSelectors.join(', ')));

        for (const el of elements) {
          const style = window.getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden' || el.hasAttribute('hidden')) {
            continue;
          }

          const tagName = el.tagName.toLowerCase();
          const roleAttr = el.getAttribute('role');
          let role = roleAttr;

          if (!role) {
            if (tagName === 'main') role = 'main';
            else if (tagName === 'nav') role = 'navigation';
            else if (tagName === 'header' && !el.closest('article, section, aside, nav')) role = 'banner';
            else if (tagName === 'footer' && !el.closest('article, section, aside, nav')) role = 'contentinfo';
            else if (tagName === 'aside') role = 'complementary';
          }

          if (role) {
            let selector = tagName;
            if (el.id) selector = `#${el.id}`;
            else if (el.getAttribute('data-testid')) selector = `[data-testid="${el.getAttribute('data-testid')}"]`;
            else if (roleAttr) selector = `[role="${roleAttr}"]`;

            const name = el.getAttribute('aria-label') ||
              (el.getAttribute('aria-labelledby') ? document.getElementById(el.getAttribute('aria-labelledby')!)?.textContent : undefined) ||
              undefined;

            landmarks.push({
              role,
              tagName,
              name: name ? name.trim().slice(0, 50) : undefined,
              selector,
            });

            if (role === 'main') {
              mainLandmarks.push(el as HTMLElement);
            }
          }
        }

        return {
          landmarks,
          hasMainLandmark: mainLandmarks.length > 0,
          duplicateMainLandmarksCount: mainLandmarks.length > 1 ? mainLandmarks.length : 0,
        };
      });
    } catch (err: any) {
      return {
        landmarks: [],
        hasMainLandmark: false,
        duplicateMainLandmarksCount: 0,
      };
    }
  }
}

