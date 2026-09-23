// ==============================================================================
// Sculra Secure Integration & Credential Vault Types (worker/src/credentials/types.ts)
// ==============================================================================

export type CredentialProvider =
  | 'GITHUB'
  | 'OPENAI'
  | 'GENERIC_HTTP'
  | 'CI_WEBHOOK'
  | 'PROJECT_SOURCE'
  | 'ENVIRONMENT_AUTH';

export type CredentialType =
  | 'API_KEY'
  | 'BEARER_TOKEN'
  | 'BASIC_AUTH'
  | 'OAUTH_TOKEN'
  | 'GITHUB_TOKEN'
  | 'WEBHOOK_SECRET'
  | 'OPENAI_API_KEY'
  | 'CUSTOM_SECRET';

export type CredentialScope =
  | 'READ_ONLY'
  | 'READ_WRITE'
  | 'ADMIN'
  | 'EXECUTION_ONLY'
  | 'WEBHOOK_VERIFY';

export type CredentialStatus =
  | 'ACTIVE'
  | 'INVALID'
  | 'EXPIRED'
  | 'REVOKED'
  | 'PENDING_VALIDATION'
  | 'VALIDATION_FAILED';

/**
 * Safe, non-sensitive credential metadata returned to clients and queries.
 * Plaintext secrets are NEVER present in this type.
 */
export interface CredentialMetadata {
  id: string;
  organizationId?: string | null;
  projectId?: string | null;
  provider: CredentialProvider;
  credentialType: CredentialType;
  displayName: string;
  status: CredentialStatus;
  scope: CredentialScope;
  maskedPreview: string; // e.g. "gh_••••••91"
  expiresAt?: string | null;
  lastValidatedAt?: string | null;
  lastUsedAt?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
  keyVersion: string;
  metadata?: Record<string, any>;
}

/**
 * Encrypted envelope stored in credential_secrets table.
 */
export interface EncryptedSecretEnvelope {
  id?: string;
  credentialId: string;
  encryptedData: string; // Base64 or hex ciphertext
  iv: string; // Base64 or hex IV
  authTag: string; // Base64 or hex auth tag
  keyVersion: string;
  algorithm: string; // 'AES-256-GCM'
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Short-lived in-memory decrypted secret object with dispose semantics.
 */
export interface CredentialResolution {
  readonly credentialId: string;
  readonly provider: CredentialProvider;
  readonly scope: CredentialScope;
  readonly secret: string;
  readonly keyVersion: string;
  dispose(): void;
}

/**
 * Reference passed by downstream consumers to locate credentials in vault.
 */
export interface CredentialReference {
  credentialId: string;
  provider: CredentialProvider;
  scope?: CredentialScope;
}

/**
 * Trusted execution context for credential usage and resolution.
 */
export interface CredentialExecutionContext {
  organizationId?: string | null;
  projectId?: string | null;
  actor: string;
  actorType: 'WORKER' | 'SYSTEM' | 'AI' | 'HUMAN';
  purpose: string;
  executionJobId?: string | null;
  isProduction?: boolean;
}

export interface CredentialAccessRequest {
  reference: CredentialReference;
  context: CredentialExecutionContext;
}

export interface CredentialValidationResult {
  valid: boolean;
  status: CredentialStatus;
  checkedAt: string;
  message?: string;
  details?: Record<string, any>;
}

export interface CredentialRotationRequest {
  credentialId: string;
  targetKeyVersion: string;
  initiatedBy: string;
}

export interface CredentialRotationResult {
  credentialId: string;
  oldKeyVersion: string;
  newKeyVersion: string;
  status: 'COMPLETED' | 'FAILED';
  completedAt: string;
  failureCode?: string;
}

export interface ProviderDescriptor {
  provider: CredentialProvider;
  displayName: string;
  supportedTypes: readonly CredentialType[];
  requiredFields: readonly string[];
  supportedScopes: readonly CredentialScope[];
  supportsRotation: boolean;
  supportsExpiration: boolean;
  workerOnlyAccess: boolean;
}

export interface IProviderValidator {
  validate(
    secret: string,
    type: CredentialType,
    options?: { targetUrl?: string; timeoutMs?: number; skipNetwork?: boolean }
  ): Promise<CredentialValidationResult>;
}
