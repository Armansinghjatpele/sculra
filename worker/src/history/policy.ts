// ==============================================================================
// Sculra Historical QA Policy & Query Bounds (worker/src/history/policy.ts)
// ==============================================================================

export interface HistoricalPolicyConfig {
  maxHistoricalRuns: number;
  maxCompatibleRuns: number;
  maxHistoryFindings: number;
  maxHistorySignals: number;
  maxHistoricalTargets: number;
  maxTrendPoints: number;
  maxExecutionTimeMs: number;
  intermittentThreshold: number; // Ratio of outcome flips (e.g. 0.3 = 30%)
  stableThreshold: number; // Ratio of consistent outcomes (e.g. 0.85 = 85%)
  minObservationsForTrend: number; // Minimum 2 points for directional trend
  minObservationsForVolatility: number; // Minimum 3 points for volatility assessment
  consecutiveFailureThreshold: number; // e.g. 3 consecutive runs
  enableAiHistoricalInterpretation: boolean;
}

export const DEFAULT_HISTORICAL_POLICY: HistoricalPolicyConfig = {
  maxHistoricalRuns: 30,
  maxCompatibleRuns: 15,
  maxHistoryFindings: 500,
  maxHistorySignals: 500,
  maxHistoricalTargets: 200,
  maxTrendPoints: 30,
  maxExecutionTimeMs: 30000,
  intermittentThreshold: 0.3,
  stableThreshold: 0.85,
  minObservationsForTrend: 2,
  minObservationsForVolatility: 3,
  consecutiveFailureThreshold: 3,
  enableAiHistoricalInterpretation: true,
};
