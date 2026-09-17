// ==============================================================================
// Sculra Git Change Provider Interface (worker/src/change-intelligence/git-provider.ts)
// ==============================================================================

import { ChangeType } from './types';

export interface RawChangedFile {
  filename: string;
  previousFilename?: string;
  status: ChangeType;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
}

export interface RawChangeData {
  commitSha: string;
  baseSha?: string;
  branch?: string;
  pullRequestNumber?: number;
  files: RawChangedFile[];
  totalAdditions: number;
  totalDeletions: number;
  isPartial: boolean;
  partialReason?: string;
}

export interface GitFetchContext {
  owner: string;
  repo: string;
  commitSha: string;
  baseSha?: string;
  pullRequestNumber?: number;
  branch?: string;
  githubToken?: string;
  webhookPayloadFiles?: RawChangedFile[];
  unifiedDiffText?: string;
}

export interface IGitChangeProvider {
  fetchChanges(context: GitFetchContext): Promise<RawChangeData>;
}
