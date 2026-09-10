// ==============================================================================
// Sculra Deterministic Color Contrast & Luminance Evaluator (worker/src/accessibility/contrast.ts)
// ==============================================================================

import { Page } from 'playwright';
import { ContrastCheckResult } from './types';
import { AccessibilityPolicyConfig, DEFAULT_ACCESSIBILITY_POLICY } from './policy';

export class ContrastEvaluator {
  /**
   * Calculates deterministic relative luminance and contrast ratios for text elements.
   */
  public static calculateContrastRatio(foregroundRgb: [number, number, number], backgroundRgb: [number, number, number]): number {
    const l1 = this.calculateRelativeLuminance(foregroundRgb);
    const l2 = this.calculateRelativeLuminance(backgroundRgb);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    const ratio = (lighter + 0.05) / (darker + 0.05);
    return Math.round(ratio * 100) / 100;
  }

  public static calculateRelativeLuminance(rgb: [number, number, number]): number {
    const [r, g, b] = rgb.map((c) => {
      const s = c / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  /**
   * Evaluates text contrast on the page against WCAG 2.1 AA requirements.
   */
  public static async evaluateContrast(
    page: Page,
    pageUrl: string,
    policy?: Partial<AccessibilityPolicyConfig>
  ): Promise<ContrastCheckResult[]> {
    const activePolicy = { ...DEFAULT_ACCESSIBILITY_POLICY, ...policy };

    try {
      return await page.evaluate(
        ({ url, maxChecks, normalThreshold, largeThreshold }) => {
          function parseRgba(colorStr: string): [number, number, number, number] | null {
            if (!colorStr || colorStr === 'transparent') return [0, 0, 0, 0];
            const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
            if (match) {
              return [
                parseInt(match[1], 10),
                parseInt(match[2], 10),
                parseInt(match[3], 10),
                match[4] !== undefined ? parseFloat(match[4]) : 1,
              ];
            }
            return null;
          }

          function getRelativeLuminance(rgb: [number, number, number]): number {
            const [r, g, b] = rgb.map((c) => {
              const s = c / 255;
              return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
            });
            return 0.2126 * r + 0.7152 * g + 0.0722 * b;
          }

          function getContrastRatio(fg: [number, number, number], bg: [number, number, number]): number {
            const l1 = getRelativeLuminance(fg);
            const l2 = getRelativeLuminance(bg);
            const lighter = Math.max(l1, l2);
            const darker = Math.min(l1, l2);
            return Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;
          }

          const results: ContrastCheckResult[] = [];
          const textElements = Array.from(
            document.querySelectorAll('p, h1, h2, h3, h4, h5, h6, span, a, button, label, li, td, th')
          );

          let checkCount = 0;

          for (const el of textElements) {
            if (checkCount >= maxChecks) break;

            const text = (el.textContent || '').trim();
            if (!text || el.children.length > 3) continue; // leaf or near-leaf text elements

            const style = window.getComputedStyle(el);
            const rect = el.getBoundingClientRect();

            if (style.display === 'none' || style.visibility === 'hidden' || rect.width === 0 || rect.height === 0) {
              continue;
            }

            // Check if background image / gradient makes contrast calculation inconclusive
            let hasBgImage = style.backgroundImage !== 'none' && style.backgroundImage !== '';
            let currentParent = el.parentElement;
            let bgRgba = parseRgba(style.backgroundColor);

            // Traverse parent tree to resolve effective background color if transparent
            while (currentParent && (!bgRgba || bgRgba[3] < 0.95)) {
              const pStyle = window.getComputedStyle(currentParent);
              if (pStyle.backgroundImage !== 'none' && pStyle.backgroundImage !== '') {
                hasBgImage = true;
                break;
              }
              const pBg = parseRgba(pStyle.backgroundColor);
              if (pBg && pBg[3] > 0) {
                if (!bgRgba || bgRgba[3] === 0) {
                  bgRgba = pBg;
                } else {
                  // Alpha composite
                  const alpha = bgRgba[3];
                  bgRgba = [
                    Math.round(bgRgba[0] * alpha + pBg[0] * (1 - alpha)),
                    Math.round(bgRgba[1] * alpha + pBg[1] * (1 - alpha)),
                    Math.round(bgRgba[2] * alpha + pBg[2] * (1 - alpha)),
                    1,
                  ];
                }
              }
              currentParent = currentParent.parentElement;
            }

            if (!bgRgba || bgRgba[3] === 0) {
              // Default root background is white
              bgRgba = [255, 255, 255, 1];
            }

            const fgRgba = parseRgba(style.color) || [0, 0, 0, 1];

            let selector = el.tagName.toLowerCase();
            if (el.id) selector = `#${el.id}`;
            else if (el.getAttribute('data-testid')) selector = `[data-testid="${el.getAttribute('data-testid')}"]`;
            else if (el.className) selector = `${el.tagName.toLowerCase()}.${el.className.split(/\s+/)[0]}`;

            const fontSizePx = parseFloat(style.fontSize) || 16;
            const fontWeight = style.fontWeight;
            const isBold = parseInt(fontWeight, 10) >= 700 || fontWeight === 'bold';
            const isLargeText = fontSizePx >= 24 || (fontSizePx >= 18.66 && isBold);
            const requiredRatio = isLargeText ? largeThreshold : normalThreshold;

            if (hasBgImage) {
              results.push({
                pageUrl: url,
                selector,
                textSnippet: text.slice(0, 40),
                fontSizePx,
                fontWeight,
                isLargeText,
                computedColor: style.color,
                computedBgColor: style.backgroundColor,
                contrastRatio: 0,
                requiredRatio,
                isConclusive: false,
                inconclusiveReason: 'Background gradient or image detected; contrast cannot be computed deterministically from flat solid colors',
                status: 'INCONCLUSIVE',
              });
              checkCount++;
              continue;
            }

            const ratio = getContrastRatio([fgRgba[0], fgRgba[1], fgRgba[2]], [bgRgba[0], bgRgba[1], bgRgba[2]]);
            const passes = ratio >= requiredRatio;

            results.push({
              pageUrl: url,
              selector,
              textSnippet: text.slice(0, 40),
              fontSizePx,
              fontWeight,
              isLargeText,
              computedColor: style.color,
              computedBgColor: `rgb(${bgRgba[0]}, ${bgRgba[1]}, ${bgRgba[2]})`,
              contrastRatio: ratio,
              requiredRatio,
              isConclusive: true,
              status: passes ? 'PASS' : 'FAIL',
            });
            checkCount++;
          }

          return results;
        },
        {
          url: pageUrl,
          maxChecks: activePolicy.maxContrastChecks,
          normalThreshold: activePolicy.contrastNormalThreshold,
          largeThreshold: activePolicy.contrastLargeThreshold,
        }
      );
    } catch (err: any) {
      return [];
    }
  }
}

