// ==============================================================================
// Sculra Performance UI Formatting Utilities (frontend/lib/performanceUtils.ts)
// ==============================================================================

export interface PerformanceScoreDisplay {
  text: string;
  colorClass: string;
  isMeasured: boolean;
  score?: number;
}

/**
 * Truthfully formats a performance score.
 * Never fabricates 100/100 or fallback success states for unmeasured scores.
 */
export function formatPerformanceScore(score?: number | null): PerformanceScoreDisplay {
  if (typeof score === 'number' && !isNaN(score)) {
    const clamped = Math.max(0, Math.min(100, Math.round(score)));
    let colorClass = 'text-danger';
    if (clamped >= 85) {
      colorClass = 'text-success';
    } else if (clamped >= 70) {
      colorClass = 'text-amber-400';
    }
    return {
      text: `${clamped}/100`,
      colorClass,
      isMeasured: true,
      score: clamped,
    };
  }

  return {
    text: '--',
    colorClass: 'text-muted-foreground',
    isMeasured: false,
  };
}

/**
 * Formats a generic performance metric value.
 * Preserves genuine 0 measurements without converting to unavailable.
 */
export function formatPerformanceMetric(value?: number | string | null, unit: string = ''): string {
  if (value === null || value === undefined) {
    return '--';
  }
  if (typeof value === 'number') {
    if (isNaN(value)) return '--';
    return `${value}${unit}`;
  }
  return `${value}${unit}`;
}

/**
 * Formats targets evaluated ratio.
 */
export function formatTargetsEvaluated(tested?: number | null, discovered?: number | null): string {
  if (typeof tested === 'number' && typeof discovered === 'number') {
    return `${tested}/${discovered}`;
  }
  return '--';
}
