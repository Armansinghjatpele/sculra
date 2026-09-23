// ==============================================================================
// Sculra GitHub Credential Validator (worker/src/credentials/providers/validators/github-validator.ts)
// ==============================================================================
// Invariants:
// - Strictly read-only validation. Never pushes, creates PRs, or modifies repos.
// - Reusable in offline test environments.

import { IProviderValidator, CredentialType, CredentialValidationResult } from '../../types';
import { BoundedHttpClient } from '../../../sources/source-limits';

export class GitHubValidator implements IProviderValidator {
  public async validate(
    secret: string,
    type: CredentialType,
    options?: { targetUrl?: string; timeoutMs?: number; skipNetwork?: boolean }
  ): Promise<CredentialValidationResult> {
    const checkedAt = new Date().toISOString();

    if (!secret || typeof secret !== 'string') {
      return {
        valid: false,
        status: 'INVALID',
        checkedAt,
        message: 'GitHub secret material is missing or empty.',
      };
    }

    const trimmed = secret.trim();

    // Structural syntax validation for GitHub token formats
    const isClassicPat = trimmed.startsWith('ghp_') && trimmed.length >= 36;
    const isOAuthToken = trimmed.startsWith('gho_') && trimmed.length >= 36;
    const isFineGrained = trimmed.startsWith('github_pat_') && trimmed.length >= 80;
    const isGenericToken = trimmed.length >= 20;

    if (!isClassicPat && !isOAuthToken && !isFineGrained && !isGenericToken) {
      return {
        valid: false,
        status: 'INVALID',
        checkedAt,
        message: 'Invalid GitHub token format. Expected ghp_*, gho_*, or github_pat_* token.',
      };
    }

    if (options?.skipNetwork) {
      return {
        valid: true,
        status: 'ACTIVE',
        checkedAt,
        message: 'GitHub token format verified (offline validation).',
        details: { tokenType: isFineGrained ? 'fine-grained' : isClassicPat ? 'classic' : 'token' },
      };
    }

    // Bounded read-only validation against GitHub user API
    try {
      const response = await BoundedHttpClient.safeFetch('https://api.github.com/user', {
        timeoutMs: options?.timeoutMs || 5000,
        headers: {
          Authorization: `Bearer ${trimmed}`,
          'User-Agent': 'Sculra-Credential-Vault/1.0',
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (response.status === 200) {
        return {
          valid: true,
          status: 'ACTIVE',
          checkedAt,
          message: 'GitHub token authenticated successfully (read-only verification).',
        };
      }

      if (response.status === 401 || response.status === 403) {
        return {
          valid: false,
          status: 'INVALID',
          checkedAt,
          message: `GitHub authentication rejected with status ${response.status}.`,
        };
      }

      return {
        valid: false,
        status: 'VALIDATION_FAILED',
        checkedAt,
        message: `GitHub returned unexpected status ${response.status}.`,
      };
    } catch (err: any) {
      return {
        valid: false,
        status: 'VALIDATION_FAILED',
        checkedAt,
        message: `GitHub validation network error: ${err.message}`,
      };
    }
  }
}
