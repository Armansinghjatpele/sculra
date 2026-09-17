// ==============================================================================
// Sculra GitHub Change Provider Implementation (worker/src/change-intelligence/github.ts)
// ==============================================================================

import { GitFetchContext, IGitChangeProvider, RawChangeData, RawChangedFile } from './git-provider';
import { MAX_CHANGED_FILES, MAX_PATCH_BYTES } from './policy';
import { normalizeRepoPath } from './normalizer';

export class GitHubChangeProvider implements IGitChangeProvider {
  /**
   * Retrieves changed files and patch diffs for a commit or pull request.
   */
  async fetchChanges(context: GitFetchContext): Promise<RawChangeData> {
    const { owner, repo, commitSha, baseSha, pullRequestNumber, branch, githubToken, webhookPayloadFiles } = context;

    // 1. If files were supplied directly via webhook payload (or fixture), use them first
    if (webhookPayloadFiles && webhookPayloadFiles.length > 0) {
      return this.processRawFiles(commitSha, baseSha, branch, pullRequestNumber, webhookPayloadFiles);
    }

    // 1.5 If raw unified diff text was supplied directly
    if (context.unifiedDiffText) {
      const parsedFromDiff = this.parseUnifiedDiffText(context.unifiedDiffText);
      if (parsedFromDiff.length > 0) {
        return this.processRawFiles(commitSha, baseSha, branch, pullRequestNumber, parsedFromDiff);
      }
    }

    // 2. If GitHub token is available, attempt fetching via GitHub API
    if (githubToken && owner && repo) {
      try {
        let apiUrl = '';
        if (baseSha) {
          apiUrl = `https://api.github.com/repos/${owner}/${repo}/compare/${baseSha}...${commitSha}`;
        } else if (pullRequestNumber) {
          apiUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${pullRequestNumber}/files?per_page=100`;
        } else {
          apiUrl = `https://api.github.com/repos/${owner}/${repo}/commits/${commitSha}`;
        }

        const res = await fetch(apiUrl, {
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'Sculra-Change-Intelligence/1.0',
          },
        });

        if (res.ok) {
          const data = await res.json();
          const apiFiles = Array.isArray(data) ? data : data.files || [];

          const rawFiles: RawChangedFile[] = apiFiles.map((f: any) => ({
            filename: f.filename,
            previousFilename: f.previous_filename,
            status: (f.status || 'modified').toUpperCase() as any,
            additions: f.additions || 0,
            deletions: f.deletions || 0,
            changes: f.changes || 0,
            patch: f.patch,
          }));

          return this.processRawFiles(commitSha, baseSha, branch, pullRequestNumber, rawFiles);
        }
      } catch {
        // Fall back gracefully to partial analysis
      }
    }

    // 3. Fallback: Return empty/partial change data without failing
    return {
      commitSha,
      baseSha,
      branch,
      pullRequestNumber,
      files: [],
      totalAdditions: 0,
      totalDeletions: 0,
      isPartial: true,
      partialReason: 'GitHub diff data unavailable or no token provided',
    };
  }

  private processRawFiles(
    commitSha: string,
    baseSha: string | undefined,
    branch: string | undefined,
    pullRequestNumber: number | undefined,
    files: RawChangedFile[]
  ): RawChangeData {
    let isPartial = false;
    let partialReason: string | undefined;

    let targetFiles = files;
    if (targetFiles.length > MAX_CHANGED_FILES) {
      targetFiles = targetFiles.slice(0, MAX_CHANGED_FILES);
      isPartial = true;
      partialReason = `Changed files exceed threshold (${MAX_CHANGED_FILES})`;
    }

    let totalAdditions = 0;
    let totalDeletions = 0;
    let totalPatchBytes = 0;

    const sanitizedFiles: RawChangedFile[] = [];

    for (const f of targetFiles) {
      try {
        const cleanPath = normalizeRepoPath(f.filename);
        let patch = f.patch;

        if (patch) {
          totalPatchBytes += patch.length;
          if (totalPatchBytes > MAX_PATCH_BYTES) {
            patch = undefined;
            isPartial = true;
            partialReason = `Total diff patch size exceeded limit (${MAX_PATCH_BYTES} bytes)`;
          }
        }

        totalAdditions += f.additions;
        totalDeletions += f.deletions;

        sanitizedFiles.push({
          filename: cleanPath,
          previousFilename: f.previousFilename ? normalizeRepoPath(f.previousFilename) : undefined,
          status: f.status || 'MODIFIED',
          additions: f.additions,
          deletions: f.deletions,
          changes: f.changes || f.additions + f.deletions,
          patch,
        });
      } catch {
        // Skip malformed paths
      }
    }

    return {
      commitSha,
      baseSha,
      branch,
      pullRequestNumber,
      files: sanitizedFiles,
      totalAdditions,
      totalDeletions,
      isPartial,
      partialReason,
    };
  }

  private parseUnifiedDiffText(diffText: string): RawChangedFile[] {
    const files: RawChangedFile[] = [];
    const chunks = diffText.split(/^diff --git /m);
    for (const chunk of chunks) {
      if (!chunk.trim()) continue;
      const lines = chunk.split('\n');
      const header = lines[0];
      const match = header.match(/a\/(.+?)\s+b\/(.+)/);
      if (match) {
        files.push({
          filename: match[2].trim(),
          status: 'MODIFIED',
          additions: 0,
          deletions: 0,
          changes: 0,
          patch: chunk,
        });
      }
    }
    return files;
  }
}
