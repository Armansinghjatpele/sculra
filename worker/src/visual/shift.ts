// ==============================================================================
// Sculra Layout Shift Detection Engine (worker/src/visual/shift.ts)
// ==============================================================================

import { Page } from 'playwright';
import { ViewportProfile, VisualObservation } from './types';

export interface ElementGeometrySnapshot {
  selector: string;
  tagName: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export class LayoutShiftDetector {
  async snapshotGeometries(page: Page): Promise<ElementGeometrySnapshot[]> {
    return page.evaluate(() => {
      const candidates = Array.from(
        document.querySelectorAll(
          'header, nav, main, footer, h1, h2, form, button, [role="button"], .card, section'
        )
      );

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

      const snapshots: ElementGeometrySnapshot[] = [];
      for (const el of candidates) {
        const style = window.getComputedStyle(el);
        if (
          style.display === 'none' ||
          style.visibility === 'hidden' ||
          parseFloat(style.opacity || '1') === 0
        ) {
          continue;
        }
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;

        snapshots.push({
          selector: getElementSelector(el),
          tagName: el.tagName.toLowerCase(),
          text: (el.textContent || '').trim().slice(0, 30),
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });

        if (snapshots.length >= 25) break;
      }

      return snapshots;
    });
  }

  detectShifts(
    before: ElementGeometrySnapshot[],
    after: ElementGeometrySnapshot[],
    viewport: ViewportProfile,
    pageUrl: string,
    actionContext?: string
  ): VisualObservation[] {
    const observations: VisualObservation[] = [];
    const timestamp = new Date().toISOString();

    const beforeMap = new Map<string, ElementGeometrySnapshot>();
    for (const b of before) {
      beforeMap.set(b.selector, b);
    }

    for (const a of after) {
      const b = beforeMap.get(a.selector);
      if (!b) continue;

      const deltaX = Math.abs(a.x - b.x);
      const deltaY = Math.abs(a.y - b.y);
      const totalShift = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      // Flag unexpected significant shifts (> 40px)
      if (totalShift >= 40) {
        observations.push({
          id: `obs-shift-${Math.random().toString(36).substring(2, 10)}`,
          type: 'LAYOUT_SHIFT',
          pageUrl,
          viewport,
          severity: totalShift > 100 ? 'medium' : 'low',
          title: `Layout shift detected on ${viewport.name} (${viewport.width}px)`,
          description: `Element "${a.selector}" shifted position by ${Math.round(totalShift)}px (Δx: ${deltaX}px, Δy: ${deltaY}px) after interaction "${actionContext || 'user action'}".`,
          selector: a.selector,
          boundingBox: { x: a.x, y: a.y, width: a.width, height: a.height },
          shiftAmount: Math.round(totalShift),
          timestamp,
          metadata: {
            viewportName: viewport.name,
            deltaX,
            deltaY,
            totalShift: Math.round(totalShift),
            actionContext,
          },
        });

        if (observations.length >= 3) break;
      }
    }

    return observations;
  }
}
