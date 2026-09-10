import { describe, it, expect } from 'vitest';
import {
  ContrastEvaluator,
} from '../src/accessibility/contrast';
import {
  AriaValidator,
} from '../src/accessibility/aria';
import {
  AccessibilitySeverityClassifier,
} from '../src/accessibility/severity';
import {
  AccessibilityAnalyzer,
} from '../src/accessibility/analyzer';

describe('Accessibility QA Engine — Unit & Deterministic Checks', () => {
  describe('Contrast & Luminance Mathematics', () => {
    it('calculates relative luminance accurately', () => {
      const whiteLum = ContrastEvaluator.calculateRelativeLuminance([255, 255, 255]);
      const blackLum = ContrastEvaluator.calculateRelativeLuminance([0, 0, 0]);
      expect(whiteLum).toBeCloseTo(1.0, 4);
      expect(blackLum).toBeCloseTo(0.0, 4);
    });

    it('calculates WCAG contrast ratio for pure black on pure white as 21:1', () => {
      const ratio = ContrastEvaluator.calculateContrastRatio([0, 0, 0], [255, 255, 255]);
      expect(ratio).toBeCloseTo(21.0, 1);
    });

    it('calculates WCAG contrast ratio for identical colors as 1:1', () => {
      const ratio = ContrastEvaluator.calculateContrastRatio([255, 255, 255], [255, 255, 255]);
      expect(ratio).toBeCloseTo(1.0, 1);
    });
  });

  describe('Accessibility Severity Classifier & WCAG Metadata', () => {
    it('classifies KEYBOARD_TRAP as CRITICAL severity', () => {
      const meta = AccessibilitySeverityClassifier.getMetadata('KEYBOARD_TRAP');
      expect(meta.defaultSeverity).toBe('critical');
      expect(meta.defaultConfidence).toBe('high');
      expect(meta.wcagReference).toContain('2.1.2');
      expect(meta.principle).toBe('Operable');
    });

    it('classifies INPUT_MISSING_LABEL as HIGH severity', () => {
      const meta = AccessibilitySeverityClassifier.getMetadata('INPUT_MISSING_LABEL');
      expect(meta.defaultSeverity).toBe('high');
      expect(meta.wcagReference).toContain('3.3.2');
      expect(meta.principle).toBe('Understandable');
    });

    it('classifies CONTRAST_FAILURE as MEDIUM severity', () => {
      const meta = AccessibilitySeverityClassifier.getMetadata('CONTRAST_FAILURE');
      expect(meta.defaultSeverity).toBe('medium');
      expect(meta.wcagReference).toContain('1.4.3');
      expect(meta.principle).toBe('Perceivable');
    });

    it('classifies HEADING_HIERARCHY_ERROR as LOW severity', () => {
      const meta = AccessibilitySeverityClassifier.getMetadata('HEADING_HIERARCHY_ERROR');
      expect(meta.defaultSeverity).toBe('low');
      expect(meta.wcagReference).toContain('1.3.1');
    });
  });

  describe('Accessibility Analyzer & Scoring Math', () => {
    it('returns score of 100 when there are measurements and zero findings', () => {
      const res = AccessibilityAnalyzer.analyze({
        targetsDiscovered: 5,
        pagesTested: 1,
        findings: [],
        keyboardResults: [{ url: 'http://localhost', totalSteps: 10, focusedSequence: [{ order: 1, tagName: 'button', selector: '#btn', hasVisibleFocus: true }], unreachableElements: [], trappedAtStep: null, isTrapped: false, durationMs: 100 }],
        contrastResults: [],
        touchTargetResults: [],
        formResults: [],
        semanticResults: [],
        textScalingResults: [],
        reducedMotionResults: [],
        dialogResults: [],
        durationMs: 500,
      });

      expect(res.accessibilityScore).toBe(100);
      expect(res.coverage.criticalFindings).toBe(0);
      expect(res.coverage.highFindings).toBe(0);
    });

    it('leaves accessibilityScore undefined when 0 measurements and 0 findings exist', () => {
      const res = AccessibilityAnalyzer.analyze({
        targetsDiscovered: 0,
        pagesTested: 0,
        findings: [],
        keyboardResults: [],
        contrastResults: [],
        touchTargetResults: [],
        formResults: [],
        semanticResults: [],
        textScalingResults: [],
        reducedMotionResults: [],
        dialogResults: [],
        durationMs: 0,
      });

      expect(res.accessibilityScore).toBeUndefined();
    });

    it('accurately deducts points for critical, high, and medium defects', () => {
      const mockFindings: any[] = [
        { severity: 'critical', type: 'KEYBOARD_TRAP' },
        { severity: 'high', type: 'CONTRAST_INSUFFICIENT' },
        { severity: 'medium', type: 'HEADING_LEVEL_SKIPPED' },
      ];

      const res = AccessibilityAnalyzer.analyze({
        targetsDiscovered: 5,
        pagesTested: 1,
        findings: mockFindings,
        keyboardResults: [{ url: 'http://localhost', totalSteps: 5, focusedSequence: [], unreachableElements: [], trappedAtStep: null, isTrapped: false, durationMs: 50 }],
        contrastResults: [],
        touchTargetResults: [],
        formResults: [],
        semanticResults: [],
        textScalingResults: [],
        reducedMotionResults: [],
        dialogResults: [],
        durationMs: 200,
      });

      // Deductions: 35 (crit) + 15 (high) + 6 (med) = 56 deduction -> score = 44
      expect(res.accessibilityScore).toBe(44);
      expect(res.coverage.criticalFindings).toBe(1);
      expect(res.coverage.highFindings).toBe(1);
      expect(res.coverage.mediumFindings).toBe(1);
    });
  });
});
