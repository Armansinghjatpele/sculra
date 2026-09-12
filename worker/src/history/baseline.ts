// ==============================================================================
// Sculra Historical Baseline Management Engine (worker/src/history/baseline.ts)
// ==============================================================================

import { RunNormalizer } from './run-normalizer';
import { normalizeUrlForFingerprint } from '../issues/fingerprint';

export interface DimensionalBaselineKey {
  projectId: string;
  targetType: string;
  path: string;
  method?: string;
  viewport?: string;
  role?: string;
  metricName?: string;
}

export interface DimensionalBaselineRecord {
  key: string;
  projectId: string;
  targetType: string;
  path: string;
  metricName?: string;
  baselineValue: number | string;
  establishedRunId: string;
  establishedAt: string;
  sampleCount: number;
}

export class HistoricalBaselineManager {
  /**
   * Constructs a deterministic, dimension-safe baseline key.
   */
  static constructKey(params: DimensionalBaselineKey): string {
    const normProj = (params.projectId || '').trim();
    const normType = RunNormalizer.normalizeFindingType(params.targetType);
    const normPath = normalizeUrlForFingerprint(params.path);
    const normMethod = (params.method || '').trim().toUpperCase();
    const normViewport = (params.viewport || '').trim().toLowerCase();
    const normRole = (params.role || '').trim().toLowerCase();
    const normMetric = params.metricName ? RunNormalizer.normalizeMetricName(params.metricName) : '';

    return [normProj, normType, normPath, normMethod, normViewport, normRole, normMetric].join('|');
  }
}
