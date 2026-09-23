// ==============================================================================
// Sculra Generic HTTP Credential Validator (worker/src/credentials/providers/validators/generic-http-validator.ts)
// ==============================================================================
// Invariants:
// - Reuses BoundedHttpClient and EnvironmentValidator for strict SSRF defense.
// - Never allows user-supplied validation URLs to bypass SSRF policy.

import { IProviderValidator, CredentialType, CredentialValidationResult } from '../../types';
import { BoundedHttpClient } from '../../../sources/source-limits';
import { validateTargetUrl } from '../../../security/ssrf';

export class GenericHttpValidator implements IProviderValidator {
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
        message: 'Credential material is missing or empty.',
      };
    }

    if (secret.trim().length === 0) {
      return {
        valid: false,
        status: 'INVALID',
        checkedAt,
        message: 'Credential secret cannot be empty whitespace.',
      };
    }

    // If no targetUrl is provided, we can only validate format/entropy
    if (!options?.targetUrl) {
      return {
        valid: true,
        status: 'ACTIVE',
        checkedAt,
        message: 'HTTP credential format accepted.',
      };
    }

    // SSRF Check on targetUrl
    const ssrfCheck = validateTargetUrl(options.targetUrl);
    if (!ssrfCheck.valid) {
      return {
        valid: false,
        status: 'INVALID',
        checkedAt,
        message: `Validation endpoint failed SSRF inspection: ${ssrfCheck.error || 'Blocked host'}`,
      };
    }

    if (options.skipNetwork) {
      return {
        valid: true,
        status: 'ACTIVE',
        checkedAt,
        message: 'Validation endpoint SSRF verified (offline).',
      };
    }

    // Build authorization header based on type
    const headers: Record<string, string> = {
      'User-Agent': 'Sculra-Credential-Vault/1.0',
    };

    if (type === 'BEARER_TOKEN') {
      headers['Authorization'] = `Bearer ${secret.trim()}`;
    } else if (type === 'BASIC_AUTH') {
      const encoded = Buffer.from(secret.trim()).toString('base64');
      headers['Authorization'] = `Basic ${encoded}`;
    } else if (type === 'API_KEY') {
      headers['X-API-Key'] = secret.trim();
    }

    try {
      const response = await BoundedHttpClient.safeFetch(options.targetUrl, {
        timeoutMs: options.timeoutMs || 5000,
        headers,
      });

      if (response.status >= 200 && response.status < 400) {
        return {
          valid: true,
          status: 'ACTIVE',
          checkedAt,
          message: `Endpoint authenticated successfully with status ${response.status}.`,
        };
      }

      if (response.status === 401 || response.status === 403) {
        return {
          valid: false,
          status: 'INVALID',
          checkedAt,
          message: `Endpoint authentication failed with status ${response.status}.`,
        };
      }

      return {
        valid: false,
        status: 'VALIDATION_FAILED',
        checkedAt,
        message: `Endpoint returned unexpected status ${response.status}.`,
      };
    } catch (err: any) {
      return {
        valid: false,
        status: 'VALIDATION_FAILED',
        checkedAt,
        message: `HTTP probe error: ${err.message}`,
      };
    }
  }
}
