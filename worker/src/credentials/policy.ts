// ==============================================================================
// Sculra Credential Vault Policy & System Bounds (worker/src/credentials/policy.ts)
// ==============================================================================

import { CredentialProvider, CredentialType, CredentialScope } from './types';

export const CREDENTIAL_POLICY = {
  // Capacity Ceilings
  MAX_CREDENTIALS_PER_PROJECT: 50,
  MAX_CREDENTIALS_PER_ORG: 200,

  // Rate Limiting Bounds
  MAX_VALIDATION_ATTEMPTS_PER_HOUR: 5,
  MAX_ROTATIONS_PER_DAY: 5,
  MAX_RESOLUTION_FAILURES_PER_HOUR: 10,

  // Cryptography Standards
  DEFAULT_ALGORITHM: 'AES-256-GCM',
  DEFAULT_KEY_VERSION: 'v1',
  AUTH_TAG_LENGTH_BYTES: 16,
  IV_LENGTH_BYTES: 16,

  // Supported Enums
  SUPPORTED_PROVIDERS: [
    'GITHUB',
    'OPENAI',
    'GENERIC_HTTP',
    'CI_WEBHOOK',
    'PROJECT_SOURCE',
    'ENVIRONMENT_AUTH',
  ] as const satisfies readonly CredentialProvider[],

  SUPPORTED_TYPES: [
    'API_KEY',
    'BEARER_TOKEN',
    'BASIC_AUTH',
    'OAUTH_TOKEN',
    'GITHUB_TOKEN',
    'WEBHOOK_SECRET',
    'OPENAI_API_KEY',
    'CUSTOM_SECRET',
  ] as const satisfies readonly CredentialType[],

  SUPPORTED_SCOPES: [
    'READ_ONLY',
    'READ_WRITE',
    'ADMIN',
    'EXECUTION_ONLY',
    'WEBHOOK_VERIFY',
  ] as const satisfies readonly CredentialScope[],
} as const;
