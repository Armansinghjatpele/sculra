// ==============================================================================
// Sculra Cross-Branch Regression Comparator (worker/src/change-intelligence/branch-comparator.ts)
// Answers: "What changed between two branches/commits?" & "Did a regression reproduce across branches?"
// ==============================================================================

import {
  BranchComparisonResult,
  ChangeSnapshot,
  RegressionComparisonResult,
  AffectedWorkflow,
  AffectedRoute,
  AffectedApi,
} from './types';

export interface CompareBranchesInput {
  baseBranch: string;
  headBranch: string;
  baseCommit?: string;
  headCommit?: string;
  snapshot?: ChangeSnapshot;
  regressionComparison?: RegressionComparisonResult;
  affectedWorkflows?: AffectedWorkflow[];
  affectedRoutes?: AffectedRoute[];
  affectedApis?: AffectedApi[];
}

export class BranchComparator {
  /**
   * Deterministically compares two branches/commits (e.g. main@abc123 vs feature/payment@def456),
   * aggregating mutated files, affected application areas, regressions, and recoveries.
   */
  static compare(input: CompareBranchesInput): BranchComparisonResult {
    const {
      baseBranch,
      headBranch,
      baseCommit = input.snapshot?.baseCommit || input.snapshot?.baseSha || input.baseCommit,
      headCommit = input.snapshot?.headCommit || input.snapshot?.commitSha || input.headCommit,
      snapshot,
      regressionComparison,
      affectedWorkflows = [],
      affectedRoutes = [],
      affectedApis = [],
    } = input;

    // Collect affected areas deterministically
    const affectedAreasSet = new Set<string>();

    for (const c of snapshot?.classifications || []) {
      affectedAreasSet.add(`category:${c}`);
    }
    for (const r of affectedRoutes) {
      affectedAreasSet.add(`route:${r.route}`);
    }
    for (const a of affectedApis) {
      affectedAreasSet.add(`api:${a.method || 'ANY'} ${a.path}`);
    }
    for (const wf of affectedWorkflows) {
      affectedAreasSet.add(`workflow:${wf.workflowName}`);
    }

    const affectedAreas = Array.from(affectedAreasSet).sort();

    return {
      comparedAt: new Date().toISOString(),
      baseBranch,
      headBranch,
      baseCommit: baseCommit ? baseCommit.slice(0, 7) : undefined,
      headCommit: headCommit ? headCommit.slice(0, 7) : undefined,
      changedFilesCount: snapshot?.files?.length ?? 0,
      affectedAreas,
      regressionsCount: regressionComparison?.regressionsCount ?? 0,
      recoveriesCount: regressionComparison?.recoveriesCount ?? 0,
      targetComparisons: regressionComparison?.targets ?? [],
    };
  }
}
