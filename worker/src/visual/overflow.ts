// ==============================================================================
// Sculra Overflow & Clipping Detection Engine (worker/src/visual/overflow.ts)
// ==============================================================================

import { Page } from 'playwright';
import { ViewportProfile, VisualObservation } from './types';

export interface OverflowDetectionResult {
  hasHorizontalOverflow: boolean;
  docScrollWidth: number;
  viewportWidth: number;
  observations: VisualObservation[];
}

export class OverflowDetector {
  async detect(page: Page, viewport: ViewportProfile, pageUrl: string): Promise<OverflowDetectionResult> {
    const rawResults = await page.evaluate((vp) => {
      const docEl = document.documentElement;
      const body = document.body;
      if (!docEl || !body) {
        return {
          hasHorizontalOverflow: false,
          docScrollWidth: 0,
          bodyScrollWidth: 0,
          viewportWidth: vp.width,
          offendingElements: [],
          clippedElements: [],
        };
      }

      const docScrollWidth = docEl.scrollWidth;
      const bodyScrollWidth = body.scrollWidth;
      const clientWidth = docEl.clientWidth || window.innerWidth;
      const maxDocWidth = Math.max(docScrollWidth, bodyScrollWidth);

      // Allow small browser scrollbar tolerance (up to 20px) on desktop viewports
      const scrollbarTolerance = vp.width > 768 ? 20 : 2;
      const hasHorizontalOverflow = maxDocWidth > vp.width + scrollbarTolerance;

      const offendingElements: Array<{
        selector: string;
        tagName: string;
        text: string;
        boundingBox: { x: number; y: number; width: number; height: number };
        rightEdge: number;
        overflowAmount: number;
      }> = [];

      const clippedElements: Array<{
        selector: string;
        tagName: string;
        text: string;
        boundingBox: { x: number; y: number; width: number; height: number };
        parentSelector: string;
        clippingAmount: number;
      }> = [];

      // Helper to generate a CSS selector for an element
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

      // Helper to check if an element or its ancestors is an intentional horizontal scroll container
      function isIntentionalScrollContainer(el: Element): boolean {
        let current: Element | null = el;
        while (current && current !== document.body) {
          const style = window.getComputedStyle(current);
          const overflowX = style.overflowX;
          if (overflowX === 'auto' || overflowX === 'scroll') {
            return true;
          }
          if (
            current.classList.contains('overflow-x-auto') ||
            current.classList.contains('overflow-x-scroll') ||
            current.getAttribute('role') === 'tablist' ||
            current.hasAttribute('data-carousel') ||
            current.tagName.toLowerCase() === 'pre' ||
            current.tagName.toLowerCase() === 'code'
          ) {
            return true;
          }
          current = current.parentElement;
        }
        return false;
      }

      // Helper to check if element is visible
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

      // 1. If document has horizontal overflow, scan candidate elements
      if (hasHorizontalOverflow) {
        const candidates = Array.from(
          document.querySelectorAll('div, section, article, main, header, footer, table, img, video, canvas, p, h1, h2, h3, button, a, form')
        );

        for (const el of candidates) {
          if (!isVisible(el)) continue;
          if (isIntentionalScrollContainer(el)) continue;

          const rect = el.getBoundingClientRect();
          const rightEdge = rect.x + rect.width;

          if (rightEdge > vp.width + scrollbarTolerance) {
            const style = window.getComputedStyle(el);
            // Ignore fixed elements that are explicitly positioned
            if (style.position === 'fixed' && rect.x < vp.width) {
              continue;
            }

            const overflowAmount = Math.round(rightEdge - vp.width);
            offendingElements.push({
              selector: getElementSelector(el),
              tagName: el.tagName.toLowerCase(),
              text: (el.textContent || '').trim().slice(0, 40),
              boundingBox: {
                x: Math.round(rect.x),
                y: Math.round(rect.y),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
              },
              rightEdge: Math.round(rightEdge),
              overflowAmount,
            });

            if (offendingElements.length >= 5) break;
          }
        }
      }

      // 2. Check for clipped interactive content (buttons, links, inputs inside overflow:hidden containers)
      const interactiveElements = Array.from(
        document.querySelectorAll('button, a[href], input, select, [role="button"]')
      );

      for (const el of interactiveElements) {
        if (!isVisible(el)) continue;
        const rect = el.getBoundingClientRect();
        let parent = el.parentElement;

        while (parent && parent !== document.body && parent !== document.documentElement) {
          const parentStyle = window.getComputedStyle(parent);
          if (
            parentStyle.overflow === 'hidden' ||
            parentStyle.overflowX === 'hidden' ||
            parentStyle.overflowY === 'hidden'
          ) {
            const pRect = parent.getBoundingClientRect();
            // Check if element extends significantly outside parent boundaries
            const isClippedRight = rect.x + rect.width > pRect.x + pRect.width + 2;
            const isClippedBottom = rect.y + rect.height > pRect.y + pRect.height + 2;
            const isClippedLeft = rect.x < pRect.x - 2;
            const isClippedTop = rect.y < pRect.y - 2;

            if (isClippedRight || isClippedBottom || isClippedLeft || isClippedTop) {
              const clippingAmount = Math.round(
                Math.max(
                  rect.x + rect.width - (pRect.x + pRect.width),
                  rect.y + rect.height - (pRect.y + pRect.height),
                  pRect.x - rect.x,
                  pRect.y - rect.y,
                  0
                )
              );

              if (clippingAmount > 4) {
                clippedElements.push({
                  selector: getElementSelector(el),
                  tagName: el.tagName.toLowerCase(),
                  text: (el.textContent || (el as HTMLInputElement).value || '').trim().slice(0, 40),
                  boundingBox: {
                    x: Math.round(rect.x),
                    y: Math.round(rect.y),
                    width: Math.round(rect.width),
                    height: Math.round(rect.height),
                  },
                  parentSelector: getElementSelector(parent),
                  clippingAmount,
                });
                break;
              }
            }
          }
          parent = parent.parentElement;
        }

        if (clippedElements.length >= 5) break;
      }

      return {
        hasHorizontalOverflow,
        docScrollWidth: maxDocWidth,
        bodyScrollWidth,
        viewportWidth: vp.width,
        offendingElements,
        clippedElements,
      };
    }, viewport);

    const observations: VisualObservation[] = [];
    const timestamp = new Date().toISOString();

    // Generate Horizontal Overflow observations
    if (rawResults.hasHorizontalOverflow && rawResults.offendingElements.length > 0) {
      for (const item of rawResults.offendingElements) {
        const isPrimaryCTA =
          item.text.toLowerCase().includes('get started') ||
          item.text.toLowerCase().includes('sign up') ||
          item.selector.includes('cta');
        const severity = isPrimaryCTA ? 'high' : item.overflowAmount > 50 ? 'high' : 'medium';

        observations.push({
          id: `obs-overflow-${Math.random().toString(36).substring(2, 10)}`,
          type: 'HORIZONTAL_OVERFLOW',
          pageUrl,
          viewport,
          severity,
          title: `Horizontal layout overflow on ${viewport.name} (${viewport.width}px)`,
          description: `Element "${item.selector}" (${item.tagName}) extends ${item.overflowAmount}px beyond viewport width (${viewport.width}px). Total scroll width is ${rawResults.docScrollWidth}px.`,
          selector: item.selector,
          boundingBox: item.boundingBox,
          overflowAmount: item.overflowAmount,
          timestamp,
          metadata: {
            viewportName: viewport.name,
            viewportWidth: viewport.width,
            docScrollWidth: rawResults.docScrollWidth,
            rightEdge: item.rightEdge,
          },
        });
      }
    }

    // Generate Content Clipped observations
    for (const item of rawResults.clippedElements) {
      observations.push({
        id: `obs-clipped-${Math.random().toString(36).substring(2, 10)}`,
        type: 'CONTENT_CLIPPED',
        pageUrl,
        viewport,
        severity: 'medium',
        title: `Interactive element clipped on ${viewport.name} (${viewport.width}px)`,
        description: `Interactive control "${item.selector}" is clipped by ${item.clippingAmount}px by container "${item.parentSelector}".`,
        selector: item.selector,
        secondarySelector: item.parentSelector,
        boundingBox: item.boundingBox,
        overflowAmount: item.clippingAmount,
        timestamp,
        metadata: {
          viewportName: viewport.name,
          parentSelector: item.parentSelector,
          clippingAmount: item.clippingAmount,
        },
      });
    }

    return {
      hasHorizontalOverflow: rawResults.hasHorizontalOverflow,
      docScrollWidth: rawResults.docScrollWidth,
      viewportWidth: rawResults.viewportWidth,
      observations,
    };
  }
}
