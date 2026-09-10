// ==============================================================================
// Sculra Image & Non-Text Content Accessibility Evaluator (worker/src/accessibility/images.ts)
// ==============================================================================

import { Page } from 'playwright';
import { ImageAccessibilityItem } from './types';

const PLACEHOLDER_ALT_PATTERNS = [
  /^image$/i,
  /^img$/i,
  /^picture$/i,
  /^photo$/i,
  /^graphic$/i,
  /^icon$/i,
  /^logo$/i,
  /^banner$/i,
  /^untitled$/i,
  /\.(png|jpe?g|gif|webp|svg|bmp)$/i,
];

export class ImageAccessibilityEvaluator {
  /**
   * Evaluates all visible image elements for missing, empty, or placeholder alt text.
   */
  public static async evaluateImages(page: Page): Promise<ImageAccessibilityItem[]> {
    try {
      return await page.evaluate(
        ({ placeholderPatterns }) => {
          const results: ImageAccessibilityItem[] = [];
          const regexes = placeholderPatterns.map((p) => new RegExp(p.source, p.flags));

          const images = Array.from(document.querySelectorAll('img, [role="img"]')).slice(0, 100);

          for (const img of images) {
            const style = window.getComputedStyle(img);
            if (style.display === 'none' || style.visibility === 'hidden' || img.hasAttribute('hidden')) {
              continue;
            }

            let selector = img.tagName.toLowerCase();
            if (img.id) selector = `#${img.id}`;
            else if (img.getAttribute('data-testid')) selector = `[data-testid="${img.getAttribute('data-testid')}"]`;
            else if (img.getAttribute('src')) selector = `img[src="${img.getAttribute('src')}"]`;

            const hasAltAttr = img.hasAttribute('alt');
            const altVal = img.getAttribute('alt');
            const ariaLabel = img.getAttribute('aria-label');
            const role = img.getAttribute('role') || undefined;

            const isDecorative =
              (hasAltAttr && altVal === '') ||
              img.getAttribute('aria-hidden') === 'true' ||
              role === 'presentation' ||
              role === 'none';

            let isMissingAlt = false;
            let isInvalidAlt = false;

            if (!isDecorative && !ariaLabel) {
              if (!hasAltAttr) {
                isMissingAlt = true;
              } else if (altVal) {
                const trimmed = altVal.trim();
                if (regexes.some((re) => re.test(trimmed))) {
                  isInvalidAlt = true;
                }
              }
            }

            results.push({
              selector,
              src: (img as HTMLImageElement).src || img.getAttribute('src') || '',
              alt: altVal !== null ? altVal : ariaLabel || null,
              isMissingAlt,
              isInvalidAlt,
              isDecorative,
              role,
            });
          }

          return results;
        },
        {
          placeholderPatterns: PLACEHOLDER_ALT_PATTERNS.map((r) => ({
            source: r.source,
            flags: r.flags,
          })),
        }
      );
    } catch (err: any) {
      return [];
    }
  }
}

