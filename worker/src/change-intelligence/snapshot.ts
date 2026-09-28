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
  // Prompt 61 Cross-Branch Inputs
  baseBranch?: string;
  headBranch?: string;
  baseCommit?: string;
  headCommit?: string;
  changedSymbols?: string[];
  changedRoutes?: string[];
  changedApis?: string[];
  changedDatabaseAreas?: string[];
  changedAuthAreas?: string[];
  changedConfigurations?: string[];
  changedDependencies?: string[];
}

/**
 * Builds a deterministic, validated ChangeSnapshot answering "What changed?".
 * Analyzes whether changes are documentation-only, test-only, or full product surface mutations.
 * Supports cross-branch diffing (baseBranch@baseCommit -> headBranch@headCommit).
 */
export function buildChangeSnapshot(input: BuildChangeSnapshotInput): ChangeSnapshot {
  const commitSha = input.headCommit || input.commitSha;
  const baseSha = input.baseCommit || input.baseSha;
  const branch = input.headBranch || input.branch;
  const baseBranch = input.baseBranch;
  const headBranch = input.headBranch || branch;
  const baseCommit = input.baseCommit || baseSha;
  const headCommit = input.headCommit || commitSha;

  const {
    pullRequestNumber,
    source = 'GIT',
    files = [],
    isPartial = false,
    partialReason,
    createdAt = new Date().toISOString(),
  } = input;

  // Calculate totals if not provided
  let calculatedAdditions = 0;
  let calculatedDeletions = 0;
  const classificationSet = new Set<ChangeClassification>();

  // Area sets
  const symbolSet = new Set<string>(input.changedSymbols || []);
  const routeSet = new Set<string>(input.changedRoutes || []);
  const apiSet = new Set<string>(input.changedApis || []);
  const dbSet = new Set<string>(input.changedDatabaseAreas || []);
  const authSet = new Set<string>(input.changedAuthAreas || []);
  const configSet = new Set<string>(input.changedConfigurations || []);
  const depSet = new Set<string>(input.changedDependencies || []);
  const renamedFiles: Array<{ oldPath: string; newPath: string }> = [];

  for (const file of files) {
    calculatedAdditions += file.additions || 0;
    calculatedDeletions += file.deletions || 0;
    for (const c of file.classifications || []) {
      classificationSet.add(c);
    }

    const filePath = file.path || (file as any).filename || '';

    if (file.status === 'RENAMED' && file.previousPath) {
      renamedFiles.push({ oldPath: file.previousPath, newPath: filePath });
    }

    const normPath = filePath.toLowerCase();

    // Route and API detection
    if (
      normPath.startsWith('app/') ||
      normPath.includes('/app/') ||
      normPath.startsWith('pages/') ||
      normPath.includes('/pages/') ||
      normPath.startsWith('routes/') ||
      normPath.includes('/routes/') ||
      normPath.startsWith('api/') ||
      normPath.includes('/api/')
    ) {
      const routeMatch = filePath.match(/(?:^|\/)(?:app|pages|routes|src\/app|src\/pages)\/(.+?)(?:\/page|\/route|\.tsx|\.ts|\.jsx|\.js|$)/);
      if (routeMatch && routeMatch[1]) {
        const route = '/' + routeMatch[1].replace(/\/page$/, '').replace(/\/route$/, '');
        if (normPath.includes('api/')) {
          apiSet.add(route);
        } else {
          routeSet.add(route);
        }
      } else if (normPath.startsWith('api/') || normPath.includes('/api/')) {
        const apiMatch = filePath.match(/(?:^|\/)(api\/.+?)(?:\/route|\.tsx|\.ts|\.jsx|\.js|$)/);
        if (apiMatch && apiMatch[1]) {
          apiSet.add('/' + apiMatch[1]);
        }
      }
    }

    // Database / Schema detection
    if (normPath.includes('migration') || normPath.includes('schema') || normPath.includes('prisma') || normPath.includes('/db/')) {
      dbSet.add(filePath);
    }

    // Auth / Security detection
    if (normPath.includes('auth') || normPath.includes('session') || normPath.includes('permission') || normPath.includes('secret')) {
      authSet.add(filePath);
    }

    // Config & Infrastructure detection
    if (normPath.endsWith('.json') || normPath.endsWith('.yaml') || normPath.endsWith('.yml') || normPath.includes('docker') || normPath.includes('.env')) {
      configSet.add(filePath);
    }

    // Dependencies
    if (normPath.endsWith('package.json') || normPath.endsWith('pnpm-lock.yaml') || normPath.endsWith('package-lock.json') || normPath.endsWith('yarn.lock')) {
      depSet.add(filePath);
    }

    // Symbol extraction from hunks
    for (const hunk of file.hunks || []) {
      if (hunk.header) {
        const headerMatch = hunk.header.match(/(?:function|class|interface|type|const|let|var|def)\s+([A-Za-z0-9_$]+)/);
        if (headerMatch && headerMatch[1]) {
          symbolSet.add(headerMatch[1]);
        }
      }
      for (const line of hunk.lines || []) {
        if (line.startsWith('+') && !line.startsWith('+++')) {
          const match = line.match(/(?:export\s+(?:default\s+)?)?(?:async\s+)?(?:function|class|const|let|interface|type)\s+([A-Za-z0-9_$]+)/);
          if (match && match[1]) {
            symbolSet.add(match[1]);
          }
        }
      }
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
        (f.classifications && f.classifications.length === 1 && f.classifications[0] === 'DOCUMENTATION')
    );

  // Deterministic check for Test-Only changes (all files are test files or test configs)
  const isTestOnly =
    !isDocumentationOnly &&
    files.length > 0 &&
    files.some((f) => f.classifications?.includes('TEST') || f.classifications?.includes('TEST_ONLY')) &&
    files.every(
      (f) =>
        f.classifications?.includes('TEST') ||
        f.classifications?.includes('TEST_ONLY') ||
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
    baseBranch,
    headBranch,
    baseCommit,
    headCommit,
    renamedFiles: renamedFiles.length > 0 ? renamedFiles : undefined,
    changedSymbols: symbolSet.size > 0 ? Array.from(symbolSet) : undefined,
    changedRoutes: routeSet.size > 0 ? Array.from(routeSet) : undefined,
    changedApis: apiSet.size > 0 ? Array.from(apiSet) : undefined,
    changedDatabaseAreas: dbSet.size > 0 ? Array.from(dbSet) : undefined,
    changedAuthAreas: authSet.size > 0 ? Array.from(authSet) : undefined,
    changedConfigurations: configSet.size > 0 ? Array.from(configSet) : undefined,
    changedDependencies: depSet.size > 0 ? Array.from(depSet) : undefined,
  };
}
