import { describe, it, expect } from 'vitest';
import {
  formatPerformanceScore,
  formatPerformanceMetric,
  formatTargetsEvaluated,
} from '../lib/performanceUtils';

describe('Performance QA UI Truthful Metrics & Score Formatting', () => {
  describe('formatPerformanceScore', () => {
    it('does NOT fallback to 100/100 when performance score is missing (undefined/null)', () => {
      const undefinedResult = formatPerformanceScore(undefined);
      expect(undefinedResult.text).toBe('--');
      expect(undefinedResult.text).not.toBe('100/100');
      expect(undefinedResult.isMeasured).toBe(false);
      expect(undefinedResult.colorClass).toBe('text-muted-foreground');

      const nullResult = formatPerformanceScore(null);
      expect(nullResult.text).toBe('--');
      expect(nullResult.isMeasured).toBe(false);
      expect(nullResult.colorClass).toBe('text-muted-foreground');
    });

    it('displays genuinely measured score of 92 with success styling', () => {
      const result = formatPerformanceScore(92);
      expect(result.text).toBe('92/100');
      expect(result.score).toBe(92);
      expect(result.isMeasured).toBe(true);
      expect(result.colorClass).toBe('text-success');
    });

    it('displays moderate score of 75 with warning styling', () => {
      const result = formatPerformanceScore(75);
      expect(result.text).toBe('75/100');
      expect(result.score).toBe(75);
      expect(result.isMeasured).toBe(true);
      expect(result.colorClass).toBe('text-amber-400');
    });

    it('displays poor score of 45 with danger styling', () => {
      const result = formatPerformanceScore(45);
      expect(result.text).toBe('45/100');
      expect(result.score).toBe(45);
      expect(result.isMeasured).toBe(true);
      expect(result.colorClass).toBe('text-danger');
    });

    it('preserves measured score of 0 without treating it as unavailable or 100', () => {
      const result = formatPerformanceScore(0);
      expect(result.text).toBe('0/100');
      expect(result.score).toBe(0);
      expect(result.isMeasured).toBe(true);
      expect(result.colorClass).toBe('text-danger');
    });
  });

  describe('formatPerformanceMetric', () => {
    it('returns truthful unavailable state (--) for missing metrics', () => {
      expect(formatPerformanceMetric(undefined)).toBe('--');
      expect(formatPerformanceMetric(null)).toBe('--');
      expect(formatPerformanceMetric(NaN)).toBe('--');
    });

    it('preserves measured metric value 0 and does not convert to unavailable', () => {
      expect(formatPerformanceMetric(0, 'ms')).toBe('0ms');
      expect(formatPerformanceMetric(0, ' KB')).toBe('0 KB');
      expect(formatPerformanceMetric(0)).toBe('0');
    });

    it('formats positive measured values with proper unit', () => {
      expect(formatPerformanceMetric(120, 'ms')).toBe('120ms');
      expect(formatPerformanceMetric(450, ' KB')).toBe('450 KB');
    });
  });

  describe('formatTargetsEvaluated', () => {
    it('returns -- when targets have not been evaluated', () => {
      expect(formatTargetsEvaluated(undefined, undefined)).toBe('--');
      expect(formatTargetsEvaluated(null, null)).toBe('--');
    });

    it('preserves 0/0 or 0/4 measurements when targets were evaluated', () => {
      expect(formatTargetsEvaluated(0, 0)).toBe('0/0');
      expect(formatTargetsEvaluated(0, 4)).toBe('0/4');
      expect(formatTargetsEvaluated(4, 4)).toBe('4/4');
    });
  });
});
