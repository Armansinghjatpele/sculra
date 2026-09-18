// ==============================================================================
// Sculra Fix Agent Bounded Code Context Retriever (worker/src/fix-agent/code-context.ts)
// ==============================================================================

import { GitHubContextRetriever } from '../remediation/github-context';
import { redactSecrets } from './redaction';
import { FIX_AGENT_POLICY, DEFAULT_BLOCKED_PATHS } from './policy';

export interface RetrievedFileContext {
  path: string;
  content: string;
  sizeBytes: number;
}

export interface CodeRetrievalOptions {
  files: string[];
  repoOwner?: string;
  repoName?: string;
  ref?: string;
  githubToken?: string;
  fileMap?: Map<string, string>;
}

export class FixCodeContextRetriever {
  /**
   * Retrieves source code context strictly read-only while enforcing ceilings and secret redaction.
   */
  static async retrieveContext(
    options: CodeRetrievalOptions
  ): Promise<{ files: RetrievedFileContext[]; totalBytes: number }> {
    const { files, repoOwner, repoName, ref, githubToken, fileMap } = options;
    const retrieved: RetrievedFileContext[] = [];
    let totalBytes = 0;

    const filesToFetch = files.slice(0, FIX_AGENT_POLICY.MAX_CONTEXT_FILES);

    for (const filePath of filesToFetch) {
      // 1. Skip sensitive blocked paths
      if (this.isBlockedPath(filePath)) {
        continue;
      }

      let content: string | null = null;

      // 2. Fetch from in-memory fileMap if provided (e.g. testing / local workspace)
      if (fileMap && fileMap.has(filePath)) {
        content = fileMap.get(filePath)!;
      } else if (repoOwner && repoName) {
        // 3. Fetch via read-only GitHub API
        try {
          content = await GitHubContextRetriever.fetchFileContent({
            owner: repoOwner,
            repo: repoName,
            path: filePath,
            ref,
            token: githubToken,
          });
        } catch {
          content = null;
        }
      }

      if (content !== null) {
        let safeContent = redactSecrets(content);

        // Cap content per file
        if (safeContent.length > FIX_AGENT_POLICY.MAX_FILE_BYTES) {
          safeContent = safeContent.slice(0, FIX_AGENT_POLICY.MAX_FILE_BYTES);
        }

        const sizeBytes = Buffer.byteLength(safeContent, 'utf-8');

        // Check total ceiling
        if (totalBytes + sizeBytes > FIX_AGENT_POLICY.MAX_CONTEXT_BYTES) {
          break; // Stop collecting files if context limit is exceeded
        }

        retrieved.push({
          path: filePath,
          content: safeContent,
          sizeBytes,
        });

        totalBytes += sizeBytes;
      }
    }

    return { files: retrieved, totalBytes };
  }

  private static isBlockedPath(filePath: string): boolean {
    const normalized = filePath.replace(/\\/g, '/').replace(/^\.\//, '');
    for (const pattern of DEFAULT_BLOCKED_PATHS) {
      const cleanPattern = pattern.replace(/\\/g, '/').replace(/^\.\//, '');
      const escaped = cleanPattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*\*/g, '§DOUBLE_STAR§')
        .replace(/\*/g, '[^/]*')
        .replace(/§DOUBLE_STAR§/g, '.*');
      const regex = new RegExp(`^${escaped}$`, 'i');
      if (regex.test(normalized) || normalized.includes('.env')) {
        return true;
      }
    }
    return false;
  }
}
