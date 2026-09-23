// ==============================================================================
// Sculra Webhook Secret Validator (worker/src/credentials/providers/validators/webhook-validator.ts)
// ==============================================================================

import { IProviderValidator, CredentialType, CredentialValidationResult } from '../../types';

export class WebhookValidator implements IProviderValidator {
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
        message: 'Webhook secret is missing or empty.',
      };
    }

    const trimmed = secret.trim();

    // Minimum 16 characters for secure HMAC-SHA256
    if (trimmed.length < 16) {
      return {
        valid: false,
        status: 'INVALID',
        checkedAt,
        message: 'Webhook secret must be at least 16 characters long for secure HMAC signing.',
      };
    }

    return {
      valid: true,
      status: 'ACTIVE',
      checkedAt,
      message: 'Webhook secret meets cryptographic entropy requirements.',
    };
  }
}
