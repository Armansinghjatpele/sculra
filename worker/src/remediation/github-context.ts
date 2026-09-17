// ==============================================================================
// Sculra Read-Only GitHub Context Retriever (worker/src/remediation/github-context.ts)
// ==============================================================================

import { GitHubUnavailableError } from './errors';
import { redactSecrets } from './redaction';

export interface GitHubFileFetchOptions {
  owner: string;
  repo: string;
  path: string;
  ref?: string;
  token?: string;
}

export class GitHubContextRetriever {
  /**
   * Retrieves single file content strictly read-only via GitHub Contents API.
   * NEVER clones, NEVER executes shell commands.
   */
  static async fetchFileContent(options: GitHubFileFetchOptions): Promise<string | null> {
    const { owner, repo, path, ref, token } = options;
    if (!owner || !repo || !path) return null;

    const cleanPath = path.replace(/\\/g, '/').replace(/^\.?\//, '');
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${cleanPath}${ref ? `?ref=${ref}` : ''}`;

    try {
      const headers: Record<string, string> = {
        Accept: 'application/vnd.github.v3.raw',
        'User-Agent': 'Sculra-Remediation-Analyzer/1.0',
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const res = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(10000), // 10s timeout
      });

      if (res.status === 404) {
        return null;
      }

      if (res.status === 403 || res.status === 429) {
        throw new GitHubUnavailableError('GitHub API rate limit exceeded or forbidden');
      }

      if (!res.ok) {
        return null;
      }

      const text = await res.text();
      return redactSecrets(text);
    } catch (err: any) {
      if (err instanceof GitHubUnavailableError) throw err;
      return null;
    }
  }
}
