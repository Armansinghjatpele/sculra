// ==============================================================================
// Sculra Historical Coverage Trends Engine (worker/src/history/coverage.ts)
// ==============================================================================

import { CoverageTrend } from './types';

export class CoverageTrendTracker {
  /**
   * Tracks structural coverage evolution between previous and current test runs.
   */
  static evaluateCoverageTrends(
    currentBreakdown?: any,
    previousBreakdown?: any
  ): CoverageTrend[] {
    const trends: CoverageTrend[] = [];

    const curCov = currentBreakdown?.coverage;
    const prevCov = previousBreakdown?.coverage;

    this.addTrend(trends, 'pages', prevCov?.pages?.ratio, curCov?.pages?.ratio);
    this.addTrend(trends, 'forms', prevCov?.forms?.ratio, curCov?.forms?.ratio);
    this.addTrend(trends, 'buttons', prevCov?.buttons?.ratio, curCov?.buttons?.ratio);
    this.addTrend(trends, 'links', prevCov?.links?.ratio, curCov?.links?.ratio);
    this.addTrend(trends, 'viewports', prevCov?.viewports?.ratio, curCov?.viewports?.ratio);

    return trends;
  }

  private static addTrend(
    trends: CoverageTrend[],
    dimension: 'pages' | 'forms' | 'buttons' | 'links' | 'viewports' | 'apis' | 'security' | 'accessibility',
    previousRatio?: number,
    currentRatio?: number
  ) {
    if (typeof currentRatio !== 'number') return;

    if (typeof previousRatio !== 'number') {
      trends.push({
        dimension,
        currentRatio: parseFloat(currentRatio.toFixed(2)),
        trendState: 'INSUFFICIENT_DATA',
      });
      return;
    }

    const delta = currentRatio - previousRatio;
    let trendState: 'IMPROVING' | 'DEGRADING' | 'STABLE' = 'STABLE';
    if (delta >= 0.05) trendState = 'IMPROVING';
    else if (delta <= -0.05) trendState = 'DEGRADING';

    trends.push({
      dimension,
      previousRatio: parseFloat(previousRatio.toFixed(2)),
      currentRatio: parseFloat(currentRatio.toFixed(2)),
      delta: parseFloat(delta.toFixed(2)),
      trendState,
    });
  }
}
