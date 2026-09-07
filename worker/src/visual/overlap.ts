// ==============================================================================
// Sculra Element Overlap Detection Engine (worker/src/visual/overlap.ts)
// ==============================================================================

import { Page } from 'playwright';
import { ViewportProfile, VisualObservation } from './types';

export class OverlapDetector {
  async detect(page: Page, viewport: ViewportProfile, pageUrl: string): Promise<VisualObservation[]> {
    const rawOverlaps = await page.evaluate(() => {
      // 1. Candidate selection: buttons, inputs, links, headings, cards, badges
      const candidates = Array.from(
        document.querySelectorAll(
          'button, a[href], input, select, textarea, [role="button"], h1, h2, h3, .card, [role="dialog"], [role="alert"]'
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

      const visibleCandidates: Array<{
        element: Element;
        selector: string;
        text: string;
        isInteractive: boolean;
        rect: DOMRect;
        zIndex: number;
        position: string;
      }> = [];

      for (const el of candidates) {
        if (!isVisible(el)) continue;
        const rect = el.getBoundingClientRect();
        // Ignore tiny elements (e.g. spacer dots)
        if (rect.width < 12 || rect.height < 12) continue;

        const style = window.getComputedStyle(el);
        const tagName = el.tagName.toLowerCase();
        const isInteractive =
          tagName === 'button' ||
          tagName === 'input' ||
          tagName === 'select' ||
          tagName === 'textarea' ||
          (tagName === 'a' && el.hasAttribute('href')) ||
          el.getAttribute('role') === 'button';

        visibleCandidates.push({
          element: el,
          selector: getElementSelector(el),
          text: (el.textContent || (el as HTMLInputElement).value || '').trim().slice(0, 40),
          isInteractive,
          rect,
          zIndex: parseInt(style.zIndex, 10) || 0,
          position: style.position,
        });

        if (visibleCandidates.length >= 40) break;
      }

      const detectedOverlaps: Array<{
        selectorA: string;
        textA: string;
        selectorB: string;
        textB: string;
        boundingBoxA: { x: number; y: number; width: number; height: number };
        boundingBoxB: { x: number; y: number; width: number; height: number };
        overlapArea: number;
        overlapRatio: number;
      }> = [];

      // 2. Check candidate pairs
      for (let i = 0; i < visibleCandidates.length; i++) {
        const a = visibleCandidates[i];
        for (let j = i + 1; j < visibleCandidates.length; j++) {
          const b = visibleCandidates[j];

          // Ignore parent/child or ancestor/descendant relationships
          if (a.element.contains(b.element) || b.element.contains(a.element)) {
            continue;
          }

          // Ignore if both are inside the same active dialog/modal overlay
          const aDialog = a.element.closest('dialog, [role="dialog"]');
          const bDialog = b.element.closest('dialog, [role="dialog"]');
          if (aDialog && !bDialog && (aDialog.contains(a.element) || aDialog.contains(b.element))) {
            continue;
          }

          // Compute rectangle intersection
          const xOverlap = Math.max(0, Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left));
          const yOverlap = Math.max(0, Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top));
          const overlapArea = Math.round(xOverlap * yOverlap);

          if (overlapArea > 0) {
            const areaA = a.rect.width * a.rect.height;
            const areaB = b.rect.width * b.rect.height;
            const smallerArea = Math.min(areaA, areaB);
            const overlapRatio = smallerArea > 0 ? overlapArea / smallerArea : 0;

            // Flag significant overlap (≥ 20% of smaller element or ≥ 150px²)
            // Prioritize cases where at least one is interactive
            if (
              (a.isInteractive || b.isInteractive) &&
              (overlapRatio >= 0.2 || overlapArea >= 150)
            ) {
              detectedOverlaps.push({
                selectorA: a.selector,
                textA: a.text,
                selectorB: b.selector,
                textB: b.text,
                boundingBoxA: {
                  x: Math.round(a.rect.x),
                  y: Math.round(a.rect.y),
                  width: Math.round(a.rect.width),
                  height: Math.round(a.rect.height),
                },
                boundingBoxB: {
                  x: Math.round(b.rect.x),
                  y: Math.round(b.rect.y),
                  width: Math.round(b.rect.width),
                  height: Math.round(b.rect.height),
                },
                overlapArea,
                overlapRatio: Math.round(overlapRatio * 100) / 100,
              });

              if (detectedOverlaps.length >= 5) break;
            }
          }
        }
        if (detectedOverlaps.length >= 5) break;
      }

      return detectedOverlaps;
    });

    const observations: VisualObservation[] = [];
    const timestamp = new Date().toISOString();

    for (const item of rawOverlaps) {
      const isHighImpact =
        item.overlapRatio >= 0.5 ||
        item.textA.toLowerCase().includes('submit') ||
        item.textB.toLowerCase().includes('submit') ||
        item.textA.toLowerCase().includes('get started') ||
        item.textB.toLowerCase().includes('get started');

      const severity = isHighImpact ? 'high' : 'medium';

      observations.push({
        id: `obs-overlap-${Math.random().toString(36).substring(2, 10)}`,
        type: 'ELEMENT_OVERLAP',
        pageUrl,
        viewport,
        severity,
        title: `Element overlap detected on ${viewport.name} (${viewport.width}px)`,
        description: `Elements "${item.selectorA}" ("${item.textA}") and "${item.selectorB}" ("${item.textB}") overlap by ${item.overlapArea}px² (${Math.round(item.overlapRatio * 100)}% overlap).`,
        selector: item.selectorA,
        secondarySelector: item.selectorB,
        boundingBox: item.boundingBoxA,
        secondaryBoundingBox: item.boundingBoxB,
        overlapArea: item.overlapArea,
        timestamp,
        metadata: {
          viewportName: viewport.name,
          overlapRatio: item.overlapRatio,
          textA: item.textA,
          textB: item.textB,
        },
      });
    }

    return observations;
  }
}
