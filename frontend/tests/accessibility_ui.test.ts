import { describe, it, expect } from 'vitest';
import {
  formatAccessibilityScore,
  getAccessibilityScoreColor,
  getAccessibilitySeverityBadge,
} from '../lib/accessibilityUtils';

describe('Accessibility UI Formatters & Non-Fabrication Rules', () => {
  it('returns -- when accessibility score is undefined or null', () => {
    expect(formatAccessibilityScore(undefined)).toBe('--');
    expect(formatAccessibilityScore(null)).toBe('--');
    expect(formatAccessibilityScore(NaN)).toBe('--');
  });

  it('formats genuine 0 score truthfully as 0/100', () => {
    expect(formatAccessibilityScore(0)).toBe('0/100');
  });

  it('formats measured scores accurately', () => {
    expect(formatAccessibilityScore(92)).toBe('92/100');
    expect(formatAccessibilityScore(68.4)).toBe('68/100');
  });

  it('applies correct color classes based on WCAG score thresholds', () => {
    expect(getAccessibilityScoreColor(undefined)).toBe('text-muted-foreground');
    expect(getAccessibilityScoreColor(90)).toBe('text-emerald-400');
    expect(getAccessibilityScoreColor(75)).toBe('text-amber-400');
    expect(getAccessibilityScoreColor(45)).toBe('text-rose-500');
  });

  it('maps accessibility severity badges', () => {
    expect(getAccessibilitySeverityBadge('critical').label).toBe('CRITICAL');
    expect(getAccessibilitySeverityBadge('high').label).toBe('HIGH');
    expect(getAccessibilitySeverityBadge('medium').label).toBe('MEDIUM');
    expect(getAccessibilitySeverityBadge('low').label).toBe('LOW');
  });
});
