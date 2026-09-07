// ==============================================================================
// Sculra Text Overflow Detection Engine (worker/src/visual/text.ts)
// ==============================================================================

import { Page } from 'playwright';
import { ViewportProfile, VisualObservation } from './types';

export class TextOverflowDetector {
  async detect(page: Page, viewport: ViewportProfile, pageUrl: string): Promise<VisualObservation[]> {
    const rawTextOverflows = await page.evaluate(() => {
      const candidates = Array.from(
        document.querySelectorAll(
          'button, a[href], h1, h2, h3, h4, .card, label, [role="button"], nav a'
        )
      );

      function isVisible(el: Element): boolean {
        const style = window.getComputedStyle(el);
        if (
          style.display === 'none' ||
          style.visibility === 'hidden' ||
          parseFloat(style.opacity || '1') === 0
        ) {
          return false;
        }
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }

      function getElementSelector(el: Element): string {
        if (el.id) return `#${CSS.escape(el.id)}`;
        const testId = el.getAttribute('data-testid');
        if (testId) return `[data-testid="${testId}"]`;

        let path = '';
        let curr: Element | null = el;
        while (curr && curr !== document.body && curr !== document.documentElement) {
          let segment = curr.tagName.toLowerCase();
          if (curr.id) {
            segment += `#${CSS.escape(curr.id)}`;
            path = segment + (path ? ' > ' + path : '');
            break;
          }
          if (curr.className && typeof curr.className === 'string') {
            const firstClass = curr.className.trim().split(/\s+/)[0];
            if (firstClass && !firstClass.includes(':')) {
              segment += `.${firstClass}`;
            }
          }
          path = segment + (path ? ' > ' + path : '');
          curr = curr.parentElement;
        }
        return path || el.tagName.toLowerCase();
      }

      const results: Array<{
        selector: string;
        tagName: string;
        text: string;
        scrollWidth: number;
        clientWidth: number;
        overflowAmount: number;
        boundingBox: { x: number; y: number; width: number; height: number };
      }> = [];

      for (const el of candidates) {
        if (!isVisible(el)) continue;

        const style = window.getComputedStyle(el);

        // Ignore intentional ellipsis truncation
        if (style.textOverflow === 'ellipsis') continue;
        if (style.webkitLineClamp && style.webkitLineClamp !== 'none') continue;

        // Check horizontal text clipping (scrollWidth > clientWidth)
        const scrollWidth = el.scrollWidth;
        const clientWidth = el.clientWidth;

        // Allow 2px subpixel layout tolerance
        if (scrollWidth > clientWidth + 4 && clientWidth > 0) {
          const rect = el.getBoundingClientRect();
          const overflowAmount = Math.round(scrollWidth - clientWidth);

          results.push({
            selector: getElementSelector(el),
            tagName: el.tagName.toLowerCase(),
            text: (el.textContent || '').trim().slice(0, 50),
            scrollWidth,
            clientWidth,
            overflowAmount,
            boundingBox: {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            },
          });

          if (results.length >= 5) break;
        }
      }

      return results;
    });

    const observations: VisualObservation[] = [];
    const timestamp = new Date().toISOString();

    for (const item of rawTextOverflows) {
      observations.push({
        id: `obs-text-overflow-${Math.random().toString(36).substring(2, 10)}`,
        type: 'TEXT_OVERFLOW',
        pageUrl,
        viewport,
        severity: 'low',
        title: `Text content overflow on ${viewport.name} (${viewport.width}px)`,
        description: `Text inside "${item.selector}" (${item.tagName}) overflows container by ${item.overflowAmount}px without ellipsis (${item.scrollWidth}px text width vs ${item.clientWidth}px container width). Content: "${item.text}"`,
        selector: item.selector,
        boundingBox: item.boundingBox,
        overflowAmount: item.overflowAmount,
        timestamp,
        metadata: {
          viewportName: viewport.name,
          scrollWidth: item.scrollWidth,
          clientWidth: item.clientWidth,
          textSnippet: item.text,
        },
      });
    }

    return observations;
  }
}
