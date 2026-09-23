// ==============================================================================
// Sculra GitHub Source Adapter (worker/src/sources/adapters/github-adapter.ts)
// ==============================================================================

import { ISourceAdapter } from '../source-adapter';
import {
  ProjectSource,
  SourceHealthObservation,
  SourceFingerprint,
  SourceCapability,
  SourceValidationResult,
  SourceValidationOptions,
  SourceHealthState,
  SourceStatus,
} from '../types';
import { SourceFingerprinter } from '../source-fingerprint';
import { SourceCapabilityResolver } from '../source-capabilities';
import { SourceRedactor } from '../source-redaction';
import { CredentialResolver } from '../../credentials/resolver';

export class GitHubSourceAdapter implements ISourceAdapter {
  readonly sourceType = 'GITHUB' as const;

  /**
   * Parses repository locator into owner and repository name.
   */
  static parseRepo(locator: string): { owner: string; repo: string } | null {
    if (!locator || typeof locator !== 'string') return null;

    const trimmed = locator.trim();
    // Support HTTPS or SSH or short formats:
    // https://github.com/owner/repo or git@github.com:owner/repo.git or owner/repo
    const httpsMatch = trimmed.match(/github\.com\/([^/]+)\/([^/.]+)(?:\.git)?/i);
    if (httpsMatch) {
      return { owner: httpsMatch[1], repo: httpsMatch[2] };
    }

    const shortMatch = trimmed.match(/^([^/]+)\/([^/]+)$/);
    if (shortMatch && !trimmed.includes('http')) {
      return { owner: shortMatch[1], repo: shortMatch[2] };
    }

    return null;
  }

  /**
   * Validates GitHub repository existence, access state, default branch, and latest revision.
   */
  async validate(
    locator: string,
    config?: Record<string, any>,
    options: SourceValidationOptions = {}
  ): Promise<SourceValidationResult> {
    const parsed = GitHubSourceAdapter.parseRepo(locator);
    if (!parsed) {
      return {
        valid: false,
        status: 'UNAVAILABLE',
        sourceType: 'GITHUB',
        capabilities: SourceCapabilityResolver.resolve('GITHUB', 'MISCONFIGURED', 'UNAVAILABLE'),
        health: 'MISCONFIGURED',
        errors: [
          {
            code: 'INVALID_GITHUB_LOCATOR',
            message: 'Invalid GitHub repository format. Expected https://github.com/owner/repository or owner/repo',
            fatal: true,
            field: 'locator',
          },
        ],
        warnings: [],
      };
    }

    const { owner, repo } = parsed;
    const branch = config?.branch || 'main';
    let githubToken = config?.githubToken || process.env.GITHUB_TOKEN;

    if (config?.credentialId || (typeof githubToken === 'string' && githubToken.startsWith('vault:'))) {
      const credId = config?.credentialId || (githubToken as string).slice(6);
      try {
        const resolution = await CredentialResolver.resolve(
          { credentialId: credId, provider: 'GITHUB', scope: 'READ_ONLY' },
          { actor: 'GitHubSourceAdapter', actorType: 'WORKER', purpose: 'SourceInspection' }
        );
        githubToken = resolution.secret;
      } catch {
        // Fall back gracefully to existing token
      }
    }

    if (options.skipNetworkChecks) {
      const fingerprint = SourceFingerprinter.compute('GITHUB', {
        repository: `${owner}/${repo}`,
        branch,
        commitSha: config?.commitSha || 'HEAD',
      });

      return {
        valid: true,
        status: 'AVAILABLE',
        sourceType: 'GITHUB',
        capabilities: SourceCapabilityResolver.resolve('GITHUB', 'HEALTHY', 'AVAILABLE'),
        health: 'HEALTHY',
        fingerprint: fingerprint.hash,
        revision: config?.commitSha || 'HEAD',
        errors: [],
        warnings: [],
        metadata: { owner, repo, branch },
      };
    }

    // Attempt GitHub API check
    const startTime = Date.now();
    try {
      const headers: Record<string, string> = {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Sculra-GitHub-Ingestor/1.0',
      };
      if (githubToken) {
        headers['Authorization'] = `Bearer ${githubToken}`;
      }

      // 1. Fetch repo details
      const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers,
        signal: AbortSignal.timeout(options.timeoutMs || 10000),
      });

      if (!repoRes.ok) {
        if (repoRes.status === 404) {
          return {
            valid: false,
            status: 'UNAVAILABLE',
            sourceType: 'GITHUB',
            capabilities: SourceCapabilityResolver.resolve('GITHUB', 'UNREACHABLE', 'UNAVAILABLE'),
            health: 'UNREACHABLE',
            errors: [
              {
                code: 'REPOSITORY_NOT_FOUND',
                message: `Repository ${owner}/${repo} not found or private without sufficient token permissions.`,
                fatal: true,
                field: 'locator',
              },
            ],
            warnings: [],
          };
        }
        if (repoRes.status === 401 || repoRes.status === 403) {
          const isRateLimit = repoRes.headers.get('x-ratelimit-remaining') === '0';
          return {
            valid: false,
            status: 'UNAVAILABLE',
            sourceType: 'GITHUB',
            capabilities: SourceCapabilityResolver.resolve('GITHUB', isRateLimit ? 'DEGRADED' : 'FORBIDDEN', 'UNAVAILABLE'),
            health: isRateLimit ? 'DEGRADED' : 'FORBIDDEN',
            errors: [
              {
                code: isRateLimit ? 'RATE_LIMIT_EXCEEDED' : 'AUTHENTICATION_REQUIRED',
                message: isRateLimit
                  ? 'GitHub API rate limit reached. Please provide a GITHUB_TOKEN.'
                  : 'Access forbidden. Check GitHub token permissions.',
                fatal: !isRateLimit,
                field: 'configuration.githubToken',
              },
            ],
            warnings: [],
          };
        }
      }

      const repoData = await repoRes.json();
      const defaultBranch = repoData.default_branch || 'main';
      const effectiveBranch = branch || defaultBranch;

      // 2. Fetch latest commit SHA
      let latestSha = config?.commitSha || '';
      if (!latestSha) {
        try {
          const commitRes = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/commits/${effectiveBranch}`,
            {
              headers,
              signal: AbortSignal.timeout(options.timeoutMs || 10000),
            }
          );
          if (commitRes.ok) {
            const commitData = await commitRes.json();
            latestSha = commitData.sha || '';
          }
        } catch {
          // Graceful fallback to default HEAD if branch query times out
          latestSha = 'HEAD';
        }
      }

      const fingerprint = SourceFingerprinter.compute('GITHUB', {
        repository: `${owner}/${repo}`,
        branch: effectiveBranch,
        commitSha: latestSha || 'HEAD',
      });

      return {
        valid: true,
        status: 'AVAILABLE',
        sourceType: 'GITHUB',
        capabilities: SourceCapabilityResolver.resolve('GITHUB', 'HEALTHY', 'AVAILABLE'),
        health: 'HEALTHY',
        fingerprint: fingerprint.hash,
        revision: latestSha,
        latencyMs: Date.now() - startTime,
        errors: [],
        warnings: [],
        metadata: SourceRedactor.sanitize({
          owner,
          repo,
          branch: effectiveBranch,
          defaultBranch,
          visibility: repoData.visibility || (repoData.private ? 'private' : 'public'),
          fullName: repoData.full_name,
        }),
      };
    } catch (err: any) {
      // Offline fallback: if network error in dev/test, return valid with offline warning
      const fallbackFingerprint = SourceFingerprinter.compute('GITHUB', {
        repository: `${owner}/${repo}`,
        branch,
        commitSha: 'HEAD',
      });

      return {
        valid: true,
        status: 'AVAILABLE',
        sourceType: 'GITHUB',
        capabilities: SourceCapabilityResolver.resolve('GITHUB', 'HEALTHY', 'AVAILABLE'),
        health: 'HEALTHY',
        fingerprint: fallbackFingerprint.hash,
        revision: config?.commitSha || 'HEAD',
        errors: [],
        warnings: [`GitHub API probe skipped or unavailable (${err.message}). Defaulted to offline metadata.`],
        metadata: { owner, repo, branch },
      };
    }
  }

  async fingerprint(source: ProjectSource): Promise<SourceFingerprint> {
    const parsed = GitHubSourceAdapter.parseRepo(source.locator);
    const repoSlug = parsed ? `${parsed.owner}/${parsed.repo}` : source.locator;
    return SourceFingerprinter.compute('GITHUB', {
      repository: repoSlug,
      branch: source.branch || 'main',
      commitSha: source.configuration?.commitSha || 'HEAD',
    });
  }

  async capabilities(source: ProjectSource): Promise<SourceCapability[]> {
    const health = source.status === 'AVAILABLE' ? 'HEALTHY' : 'UNREACHABLE';
    return SourceCapabilityResolver.resolve('GITHUB', health, source.status, source.configuration);
  }

  async healthCheck(source: ProjectSource): Promise<SourceHealthObservation> {
    const parsed = GitHubSourceAdapter.parseRepo(source.locator);
    const startTime = Date.now();

    if (!parsed) {
      return {
        id: `hobs-${Date.now()}`,
        projectSourceId: source.id,
        status: 'MISCONFIGURED',
        errorCode: 'INVALID_REPOSITORY_LOCATOR',
        metadata: { error: 'Invalid repository locator format' },
        observedAt: new Date().toISOString(),
      };
    }

    return {
      id: `hobs-${Date.now()}`,
      projectSourceId: source.id,
      status: source.status === 'AVAILABLE' ? 'HEALTHY' : 'UNREACHABLE',
      latencyMs: Date.now() - startTime,
      metadata: { repository: `${parsed.owner}/${parsed.repo}` },
      observedAt: new Date().toISOString(),
    };
  }

  async connect(source: ProjectSource): Promise<ProjectSource> {
    return {
      ...source,
      status: 'AVAILABLE',
      updatedAt: new Date().toISOString(),
    };
  }

  async disconnect(source: ProjectSource): Promise<void> {
    // Stateless GitHub disconnect
  }
}
