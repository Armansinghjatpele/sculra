// ==============================================================================
// Sculra Deterministic Change Risk Calculator (worker/src/change-intelligence/risk.ts)
// ==============================================================================

import {
  AffectedApi,
  AffectedWorkflow,
  ChangeClassification,
  ChangeRisk,
  ChangeRiskFactor,
  ChangeSet,
} from './types';
import { HistoricalAssociation } from './historical-impact';
import { getRiskLevel } from './policy';

export interface ChangeRiskInput {
  changeSet: ChangeSet;
  classifications: ChangeClassification[];
  affectedWorkflows: AffectedWorkflow[];
  affectedApis: AffectedApi[];
  historicalAssociations: HistoricalAssociation[];
}

/**
 * Deterministically computes ChangeRisk (0 - 100) using explicit weighted factors.
 * Invariant: Fully explainable, reproducible, and never hallucinated by AI.
 */
export function calculateChangeRisk(input: ChangeRiskInput): ChangeRisk {
  const { changeSet, classifications, affectedWorkflows, affectedApis, historicalAssociations } = input;

  const classSet = new Set(classifications);
  const isDocOnly = classSet.has('DOCUMENTATION') && classSet.size === 1;
  const isTestOnly = classSet.has('TEST') && classSet.size === 1;

  // Early return for doc-only changes
  if (isDocOnly) {
    return {
      score: 5,
      level: 'LOW',
      factors: [
        {
          factor: 'DOCUMENTATION_ONLY',
          scoreAdjustment: 5,
          reason: 'Documentation changes only; zero runtime logic affected',
        },
      ],
      explanation: 'Low risk documentation change.',
    };
  }

  // Early return for test-only changes
  if (isTestOnly) {
    return {
      score: 15,
      level: 'LOW',
      factors: [
        {
          factor: 'TEST_SUITE_ONLY',
          scoreAdjustment: 15,
          reason: 'Test files only; application runtime code untouched',
        },
      ],
      explanation: 'Low risk test suite modification.',
    };
  }

  const factors: ChangeRiskFactor[] = [];
  let score = 15; // Base neutral starting point for active logic modifications
  factors.push({
    factor: 'BASE_LOGIC_CHANGE',
    scoreAdjustment: 15,
    reason: 'Application source code modified',
  });

  // 1. Business Criticality of Affected Workflows
  const hasCriticalWorkflow = affectedWorkflows.some((w) => w.criticality === 'CRITICAL');
  const hasHighWorkflow = affectedWorkflows.some((w) => w.criticality === 'HIGH');

  if (hasCriticalWorkflow) {
    score += 25;
    factors.push({
      factor: 'CRITICAL_WORKFLOW_IMPACT',
      scoreAdjustment: 25,
      reason: 'Impacts business-critical workflow (e.g. checkout, auth, core transaction)',
    });
  } else if (hasHighWorkflow) {
    score += 15;
    factors.push({
      factor: 'HIGH_WORKFLOW_IMPACT',
      scoreAdjustment: 15,
      reason: 'Impacts high-criticality product workflow',
    });
  }

  // 2. Payment & Checkout Involvement
  if (classSet.has('PAYMENT')) {
    score += 25;
    factors.push({
      factor: 'PAYMENT_FLOW_MODIFIED',
      scoreAdjustment: 25,
      reason: 'Touches payment processing, checkout flow, or financial transaction logic',
    });
  }

  // 3. Security, Authentication & Authorization Boundaries
  if (classSet.has('SECURITY') || classSet.has('AUTHENTICATION') || classSet.has('AUTHORIZATION')) {
    score += 20;
    factors.push({
      factor: 'SECURITY_AUTH_BOUNDARY',
      scoreAdjustment: 20,
      reason: 'Modifies security, authentication sessions, or authorization access controls',
    });
  }

  // 4. Database Schema & Migration Changes
  if (classSet.has('DATABASE')) {
    score += 15;
    factors.push({
      factor: 'DATABASE_MIGRATION',
      scoreAdjustment: 15,
      reason: 'Database schema, table structure, or data migrations modified',
    });
  }

  // 5. API Routes & Endpoint Changes
  if (classSet.has('API') || affectedApis.length > 0) {
    score += 10;
    factors.push({
      factor: 'API_SURFACE_MODIFIED',
      scoreAdjustment: 10,
      reason: `${affectedApis.length > 0 ? affectedApis.length : 'One or more'} API route endpoints touched`,
    });
  }

  // 6. Historical Regressions or Flakiness on Touched Targets
  if (historicalAssociations.length > 0) {
    const hasRegression = historicalAssociations.some((h) => h.signalType === 'NEW_REGRESSION');
    const points = hasRegression ? 15 : 10;
    score += points;
    factors.push({
      factor: 'HISTORICAL_REGRESSION_ASSOCIATION',
      scoreAdjustment: points,
      reason: hasRegression
        ? 'Touched application areas with historically recorded regressions'
        : 'Touched targets previously exhibiting flakiness or recurring defects',
    });
  }

  // 7. Magnitude of Change & Deletions
  if (changeSet.sizeCategory === 'VERY_LARGE') {
    score += 15;
    factors.push({
      factor: 'VERY_LARGE_DIFF',
      scoreAdjustment: 15,
      reason: `Very large change footprint (${changeSet.files.length} files, ${changeSet.totalAdditions + changeSet.totalDeletions} lines)`,
    });
  } else if (changeSet.sizeCategory === 'LARGE') {
    score += 10;
    factors.push({
      factor: 'LARGE_DIFF',
      scoreAdjustment: 10,
      reason: `Large change footprint (${changeSet.files.length} files)`,
    });
  }

  if (changeSet.totalDeletions > 500 || changeSet.totalDeletions > changeSet.totalAdditions * 2) {
    score += 10;
    factors.push({
      factor: 'HIGH_DELETION_RATIO',
      scoreAdjustment: 10,
      reason: 'High deletion magnitude indicates potential code or safety check removal',
    });
  }

  // Clamp strictly 0 - 100
  const finalScore = Math.max(0, Math.min(100, Math.round(score)));
  const level = getRiskLevel(finalScore);

  const factorSummaries = factors.slice(1).map((f) => f.reason);
  const explanation = `Change risk calculated as ${finalScore}/100 (${level}) based on: ${factorSummaries.join('; ') || 'Standard code modification'}.`;

  return {
    score: finalScore,
    level,
    factors,
    explanation,
  };
}
