// ==============================================================================
// Sculra Canonical Change Snapshot Builder (worker/src/change-intelligence/snapshot.ts)
// ==============================================================================

import {
  ChangeSnapshot,
  ChangedFile,
  ChangeSource,
  ChangeClassification,
} from './types';
import { classifyChangeSize } from './policy';

export interface BuildChangeSnapshotInput {
  commitSha: string;
  baseSha?: string;
  branch?: string;
  pullRequestNumber?: number;
  source?: ChangeSource;
  files: ChangedFile[];
  totalAdditions?: number;
  totalDeletions?: number;
  isPartial?: boolean;
  partialReason?: string;
  createdAt?: string;
}

/**
 * Builds a deterministic, validated ChangeSnapshot answering "What changed?".
 * Analyzes whether changes are documentation-only, test-only, or full product surface mutations.
 */
export function buildChangeSnapshot(input: BuildChangeSnapshotInput): ChangeSnapshot {
  const {
    commitSha,
    baseSha,
    branch,
    pullRequestNumber,
    source = 'GIT',
    files,
    isPartial = false,
    partialReason,
    createdAt = new Date().toISOString(),
  } = input;

  // Calculate totals if not provided
  let calculatedAdditions = 0;
  let calculatedDeletions = 0;
  const classificationSet = new Set<ChangeClassification>();

  for (const file of files) {
    calculatedAdditions += file.additions || 0;
    calculatedDeletions += file.deletions || 0;
    for (const c of file.classifications || []) {
      classificationSet.add(c);
    }
  }

  const totalAdditions = input.totalAdditions ?? calculatedAdditions;
  const totalDeletions = input.totalDeletions ?? calculatedDeletions;
  const totalLines = totalAdditions + totalDeletions;

  const sizeCategory = classifyChangeSize(files.length, totalLines);
  const classifications = Array.from(classificationSet);

  // Deterministic check for Documentation-Only changes
  const isDocumentationOnly =
    files.length > 0 &&
    files.every(
      (f) =>
        f.isDocumentation ||
        (f.classifications.length === 1 && f.classifications[0] === 'DOCUMENTATION')
    );

  // Deterministic check for Test-Only changes (all files are test files or test configs)
  const isTestOnly =
    !isDocumentationOnly &&
    files.length > 0 &&
    files.some((f) => f.classifications.includes('TEST') || f.classifications.includes('TEST_ONLY')) &&
    files.every(
      (f) =>
        f.classifications.includes('TEST') ||
        f.classifications.includes('TEST_ONLY') ||
        f.isDocumentation
    );

  return {
    id: `snap-${commitSha.slice(0, 7)}-${Date.now().toString(36)}`,
    commitSha,
    baseSha,
    branch,
    pullRequestNumber,
    source,
    files,
    totalAdditions,
    totalDeletions,
    sizeCategory,
    classifications,
    isDocumentationOnly,
    isTestOnly,
    isPartial,
    partialReason,
    createdAt,
  };
}
