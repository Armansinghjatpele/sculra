// ==============================================================================
// Sculra OpenAI Credential Validator (worker/src/credentials/providers/validators/openai-validator.ts)
// ==============================================================================
// Invariants:
// - Never makes expensive generation requests.
// - Reusable offline and in test environments.

import { IProviderValidator, CredentialType, CredentialValidationResult } from '../../types';
import { BoundedHttpClient } from '../../../sources/source-limits';

export class OpenAIValidator implements IProviderValidator {
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
        message: 'OpenAI API key is missing or empty.',
      };
    }

    const trimmed = secret.trim();

    // Standard format check
    const isStandardKey = trimmed.startsWith('sk-') && trimmed.length >= 20;

    if (!isStandardKey) {
      return {
        valid: false,
        status: 'INVALID',
        checkedAt,
        message: 'Invalid OpenAI API key format. Expected key starting with sk-...',
      };
    }

    if (options?.skipNetwork) {
      return {
        valid: true,
        status: 'ACTIVE',
        checkedAt,
        message: 'OpenAI API key format verified (offline validation).',
      };
    }

    // Bounded check against models endpoint (no text generation)
    try {
      const response = await BoundedHttpClient.safeFetch('https://api.openai.com/v1/models', {
        timeoutMs: options?.timeoutMs || 5000,
        headers: {
          Authorization: `Bearer ${trimmed}`,
          'User-Agent': 'Sculra-Credential-Vault/1.0',
        },
      });

      if (response.status === 200) {
        return {
          valid: true,
          status: 'ACTIVE',
          checkedAt,
          message: 'OpenAI API key validated successfully.',
        };
      }

      if (response.status === 401) {
        return {
          valid: false,
          status: 'INVALID',
          checkedAt,
          message: 'OpenAI API key is unauthorized or invalid.',
        };
      }

      return {
        valid: false,
        status: 'VALIDATION_FAILED',
        checkedAt,
        message: `OpenAI returned unexpected status ${response.status}.`,
      };
    } catch (err: any) {
      return {
        valid: false,
        status: 'VALIDATION_FAILED',
        checkedAt,
        message: `OpenAI validation network error: ${err.message}`,
      };
    }
  }
}
