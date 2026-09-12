// ==============================================================================
// Sculra Score & Metric Trend Analysis Engine (worker/src/history/trends.ts)
// ==============================================================================

import { HistoricalRun, HistoricalMetricDelta, TrendDirection } from './types';

export class TrendAnalyzer {
  /**
   * Evaluates historical score changes across compatible runs.
   */
  static analyzeScoreTrends(
    currentRun: HistoricalRun,
    previousRuns: HistoricalRun[]
  ): {
    scoreDelta?: number;
    trend: TrendDirection;
    categoryDeltas: HistoricalMetricDelta[];
  } {
    const categoryDeltas: HistoricalMetricDelta[] = [];

    // Filter to runs with actual measured overall scores
    const measuredRuns = [currentRun, ...previousRuns].filter(
      (r) => typeof r.overallScore === 'number' && !isNaN(r.overallScore)
    );

    let scoreDelta: number | undefined;
    let trend: TrendDirection = 'INSUFFICIENT_DATA';

    if (measuredRuns.length >= 2) {
      const curScore = currentRun.overallScore!;
      const prevScore = measuredRuns[1].overallScore!;
      scoreDelta = curScore - prevScore;

      // Extract chronological score series (oldest to newest)
      const scoreSeries = measuredRuns.slice(0, 10).map((r) => r.overallScore!).reverse();
      trend = this.classifySeriesTrend(scoreSeries);
    } else if (measuredRuns.length === 1) {
      trend = 'INSUFFICIENT_DATA';
    }

    // Category Metric Deltas
    const prevRun = previousRuns.length > 0 ? previousRuns[0] : undefined;
    if (prevRun) {
      this.addCategoryDelta(categoryDeltas, 'release', 'overall_score', prevRun.overallScore, currentRun.overallScore, 'pts');
      this.addCategoryDelta(categoryDeltas, 'release', 'functional_score', prevRun.functionalityScore, currentRun.functionalityScore, 'pts');
      this.addCategoryDelta(categoryDeltas, 'release', 'visual_score', prevRun.uiScore, currentRun.uiScore, 'pts');
      this.addCategoryDelta(categoryDeltas, 'release', 'responsive_score', prevRun.responsiveScore, currentRun.responsiveScore, 'pts');
      this.addCategoryDelta(categoryDeltas, 'release', 'reliability_score', prevRun.reliabilityScore, currentRun.reliabilityScore, 'pts');
      this.addCategoryDelta(categoryDeltas, 'release', 'coverage_score', prevRun.coverageScore, currentRun.coverageScore, 'pts');
      this.addCategoryDelta(categoryDeltas, 'security', 'security_score', prevRun.securityScore, currentRun.securityScore, 'pts');
      this.addCategoryDelta(categoryDeltas, 'performance', 'performance_score', prevRun.performanceScore, currentRun.performanceScore, 'pts');
      this.addCategoryDelta(categoryDeltas, 'accessibility', 'accessibility_score', prevRun.accessibilityScore, currentRun.accessibilityScore, 'pts');
    }

    return {
      scoreDelta,
      trend,
      categoryDeltas,
    };
  }

  /**
   * Deterministically classifies a numerical time series into a TrendDirection.
   */
  static classifySeriesTrend(series: number[]): TrendDirection {
    if (!series || series.length < 2) {
      return 'INSUFFICIENT_DATA';
    }

    if (series.length === 2) {
      const diff = series[1] - series[0];
      if (diff >= 3) return 'IMPROVING';
      if (diff <= -3) return 'DEGRADING';
      return 'STABLE';
    }

    // Check for volatility (oscillation between rising and falling by > 5 pts)
    let directionChanges = 0;
    let prevSlope = 0;

    for (let i = 1; i < series.length; i++) {
      const diff = series[i] - series[i - 1];
      const currentSlope = diff > 2 ? 1 : diff < -2 ? -1 : 0;
      if (prevSlope !== 0 && currentSlope !== 0 && currentSlope !== prevSlope) {
        directionChanges++;
      }
      if (currentSlope !== 0) prevSlope = currentSlope;
    }

    if (directionChanges >= 2 && series.length >= 4) {
      return 'VOLATILE';
    }

    const netChange = series[series.length - 1] - series[0];
    const recentChange = series[series.length - 1] - series[series.length - 2];

    if (netChange >= 5 || recentChange >= 4) return 'IMPROVING';
    if (netChange <= -5 || recentChange <= -4) return 'DEGRADING';

    return 'STABLE';
  }

  private static addCategoryDelta(
    deltas: HistoricalMetricDelta[],
    category: 'performance' | 'reliability' | 'security' | 'accessibility' | 'api' | 'release',
    metricName: string,
    previousValue?: number,
    currentValue?: number,
    unit: string = 'pts'
  ) {
    if (typeof previousValue !== 'number' || typeof currentValue !== 'number') {
      return;
    }

    const delta = currentValue - previousValue;
    const percentChange = previousValue !== 0 ? (delta / previousValue) * 100 : undefined;
    const direction = delta > 0 ? 'BETTER' : delta < 0 ? 'WORSE' : 'NEUTRAL';
    const isRegression = delta < -5;

    deltas.push({
      category,
      metricName,
      previousValue,
      currentValue,
      unit,
      delta,
      percentChange: percentChange !== undefined ? parseFloat(percentChange.toFixed(1)) : undefined,
      direction,
      isRegression,
    });
  }
}
