// ==============================================================================
// Sculra Change Intelligence Guardrails & Policies (worker/src/change-intelligence/policy.ts)
// ==============================================================================

import { ChangeSizeCategory } from './types';

export const MAX_CHANGED_FILES = 500;
export const MAX_PATCH_BYTES = 2 * 1024 * 1024; // 2 MB
export const MAX_HUNKS_PER_FILE = 100;
export const MAX_LINES_PER_HUNK = 300;
export const MAX_TOTAL_CHANGED_LINES = 10000;
export const MAX_GRAPH_NODES = 1000;
export const MAX_GRAPH_EDGES = 3000;
export const MAX_IMPACT_TARGETS = 200;
export const MAX_ANALYSIS_SECONDS = 30;

/**
 * Categorizes the magnitude of a change set based on file and line count thresholds.
 */
export function classifyChangeSize(filesCount: number, changedLines: number): ChangeSizeCategory {
  if (filesCount <= 5 && changedLines <= 100) {
    return 'SMALL';
  }
  if (filesCount <= 20 && changedLines <= 500) {
    return 'MEDIUM';
  }
  if (filesCount <= 50 && changedLines <= 2000) {
    return 'LARGE';
  }
  return 'VERY_LARGE';
}

/**
 * Maps a numeric risk score (0 - 100) to a qualitative risk tier.
 */
export function getRiskLevel(score: number): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
  if (score >= 85) return 'CRITICAL';
  if (score >= 65) return 'HIGH';
  if (score >= 40) return 'MEDIUM';
  return 'LOW';
}
