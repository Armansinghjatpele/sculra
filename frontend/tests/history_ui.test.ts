import { describe, it, expect } from 'vitest';
import {
  formatScoreDelta,
  getScoreDeltaColor,
  getTrendBadge,
  getFindingHistoricalBadge,
  getStabilityBadge,
} from '../lib/historyUtils';

describe('Historical QA Memory & Regression UI Formatters', () => {
  describe('formatScoreDelta', () => {
    it('returns -- when delta is undefined, null, or NaN (non-fabrication rule)', () => {
      expect(formatScoreDelta(undefined)).toBe('--');
      expect(formatScoreDelta(null)).toBe('--');
      expect(formatScoreDelta(NaN)).toBe('--');
    });

    it('formats positive delta with leading plus sign', () => {
      expect(formatScoreDelta(12)).toBe('+12 pts');
      expect(formatScoreDelta(14.8)).toBe('+15 pts');
    });

    it('formats negative delta accurately', () => {
      expect(formatScoreDelta(-18)).toBe('-18 pts');
      expect(formatScoreDelta(-5.2)).toBe('-5 pts');
    });

    it('formats zero delta as 0 pts', () => {
      expect(formatScoreDelta(0)).toBe('0 pts');
    });
  });

  describe('getScoreDeltaColor', () => {
    it('returns muted class for missing delta', () => {
      expect(getScoreDeltaColor(undefined)).toBe('text-muted-foreground');
      expect(getScoreDeltaColor(null)).toBe('text-muted-foreground');
    });

    it('returns green for positive, red for negative, slate for zero', () => {
      expect(getScoreDeltaColor(10)).toBe('text-emerald-400');
      expect(getScoreDeltaColor(-15)).toBe('text-rose-400');
      expect(getScoreDeltaColor(0)).toBe('text-slate-400');
    });
  });

  describe('getTrendBadge', () => {
    it('returns Improving badge for IMPROVING trend', () => {
      const badge = getTrendBadge('IMPROVING');
      expect(badge.label).toBe('Improving');
      expect(badge.iconName).toBe('trending-up');
    });

    it('returns Degrading badge for DEGRADING trend', () => {
      const badge = getTrendBadge('DEGRADING');
      expect(badge.label).toBe('Degrading');
      expect(badge.iconName).toBe('trending-down');
    });

    it('returns Stable badge for STABLE trend', () => {
      const badge = getTrendBadge('STABLE');
      expect(badge.label).toBe('Stable');
      expect(badge.iconName).toBe('minus');
    });

    it('returns Volatile badge for VOLATILE trend', () => {
      const badge = getTrendBadge('VOLATILE');
      expect(badge.label).toContain('Volatile');
      expect(badge.iconName).toBe('alert-triangle');
    });

    it('returns Initial Baseline for INSUFFICIENT_DATA or missing', () => {
      const badge = getTrendBadge('INSUFFICIENT_DATA');
      expect(badge.label).toBe('Initial Baseline');
      expect(badge.iconName).toBe('help-circle');
    });
  });

  describe('getFindingHistoricalBadge', () => {
    it('returns NEW REGRESSION badge', () => {
      const badge = getFindingHistoricalBadge('NEW_REGRESSION');
      expect(badge.label).toBe('NEW REGRESSION');
      expect(badge.text).toContain('rose');
    });

    it('returns RECOVERED badge', () => {
      const badge = getFindingHistoricalBadge('RECOVERED');
      expect(badge.label).toBe('RECOVERED');
      expect(badge.text).toContain('emerald');
    });

    it('returns RECURRING badge', () => {
      const badge = getFindingHistoricalBadge('RECURRING');
      expect(badge.label).toBe('RECURRING');
      expect(badge.text).toContain('amber');
    });

    it('returns UN-RETESTED badge', () => {
      const badge = getFindingHistoricalBadge('NOT_RETESTED');
      expect(badge.label).toBe('UN-RETESTED');
      expect(badge.text).toContain('slate');
    });

    it('returns FLAKY / INTERMITTENT badge', () => {
      const badge = getFindingHistoricalBadge('INTERMITTENT');
      expect(badge.label).toBe('FLAKY / INTERMITTENT');
      expect(badge.text).toContain('purple');
    });
  });

  describe('getStabilityBadge', () => {
    it('returns Stable Pass badge for STABLE_PASS', () => {
      const badge = getStabilityBadge('STABLE_PASS');
      expect(badge.label).toBe('Stable Pass');
      expect(badge.text).toContain('emerald');
    });

    it('returns Persistent Failure badge for STABLE_FAILURE', () => {
      const badge = getStabilityBadge('STABLE_FAILURE');
      expect(badge.label).toBe('Persistent Failure');
      expect(badge.text).toContain('rose');
    });

    it('returns Intermittent badge for INTERMITTENT', () => {
      const badge = getStabilityBadge('INTERMITTENT');
      expect(badge.label).toContain('Intermittent');
      expect(badge.text).toContain('purple');
    });

    it('returns Single Run badge for INSUFFICIENT_HISTORY', () => {
      const badge = getStabilityBadge('INSUFFICIENT_HISTORY');
      expect(badge.label).toBe('Single Run');
    });
  });
});
