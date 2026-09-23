// ==============================================================================
// Sculra Credential Vault Service (worker/src/credentials/vault-service.ts)
// ==============================================================================
// Canonical boundary for credential lifecycle, storage, rotation, and audit logs.
// Plaintext secrets are strictly write-only during creation/validation.

import crypto from 'crypto';
import {
  CredentialProvider,
  CredentialType,
  CredentialScope,
  CredentialStatus,
  CredentialMetadata,
  EncryptedSecretEnvelope,
  CredentialValidationResult,
  CredentialRotationResult,
} from './types';
import {
  CredentialNotFoundError,
  CredentialAccessDeniedError,
  CredentialRateLimitedError,
  CredentialRotationConflictError,
  CredentialProviderUnsupportedError,
  CredentialInvalidError,
} from './errors';
import { CREDENTIAL_POLICY } from './policy';
import { SecretEncryptor } from './crypto/secret-encryptor';
import { KeyManager } from './crypto/key-manager';
import { ProviderRegistry } from './providers/registry';
import { CredentialRedactor } from './redactor';
import { CredentialEventEmitter } from './events';

export class VaultService {
  // In-memory repositories supporting offline tests and runtime caching
  private static records: Map<string, CredentialMetadata> = new Map();
  private static secretEnvelopes: Map<string, EncryptedSecretEnvelope> = new Map();
  private static accessLogs: Array<any> = [];
  private static rotations: Array<any> = [];

  // Rate limiting tracker
  private static validationAttempts: Map<string, number[]> = new Map();
  private static rotationAttempts: Map<string, number[]> = new Map();

  /**
   * Resets all in-memory vault state (used between test suites).
   */
  public static resetVault(): void {
    this.records.clear();
    this.secretEnvelopes.clear();
    this.accessLogs = [];
    this.rotations = [];
    this.validationAttempts.clear();
    this.rotationAttempts.clear();
  }

  /**
   * Creates and securely encrypts a new credential record and envelope.
   * Write-only: Plaintext secret is encrypted immediately and NEVER returned.
   */
  public static async createCredential(params: {
    organizationId?: string | null;
    projectId?: string | null;
    provider: CredentialProvider;
    credentialType: CredentialType;
    displayName: string;
    secret: string;
    scope?: CredentialScope;
    expiresAt?: string | null;
    createdBy?: string | null;
    metadata?: Record<string, any>;
    keyVersion?: string;
  }): Promise<CredentialMetadata> {
    // 1. Validate provider & type support
    if (!ProviderRegistry.isSupported(params.provider)) {
      throw new CredentialProviderUnsupportedError(params.provider);
    }
    if (!ProviderRegistry.isTypeSupported(params.provider, params.credentialType)) {
      throw new CredentialInvalidError(
        `Type "${params.credentialType}" is not supported for provider "${params.provider}".`
      );
    }

    if (!params.secret || typeof params.secret !== 'string' || params.secret.trim().length === 0) {
      throw new CredentialInvalidError('Secret material cannot be empty.');
    }

    // 2. Capacity bounds
    if (params.projectId) {
      const projectCreds = Array.from(this.records.values()).filter(
        (r) => r.projectId === params.projectId
      );
      if (projectCreds.length >= CREDENTIAL_POLICY.MAX_CREDENTIALS_PER_PROJECT) {
        throw new CredentialRateLimitedError(
          'create_credential_project',
          CREDENTIAL_POLICY.MAX_CREDENTIALS_PER_PROJECT
        );
      }
    }
    if (params.organizationId) {
      const orgCreds = Array.from(this.records.values()).filter(
        (r) => r.organizationId === params.organizationId
      );
      if (orgCreds.length >= CREDENTIAL_POLICY.MAX_CREDENTIALS_PER_ORG) {
        throw new CredentialRateLimitedError(
          'create_credential_org',
          CREDENTIAL_POLICY.MAX_CREDENTIALS_PER_ORG
        );
      }
    }

    const credentialId = `cred-${crypto.randomUUID()}`;
    const keyVersion = params.keyVersion || KeyManager.getActiveKeyVersion();
    const maskedPreview = CredentialRedactor.maskPreview(params.secret, params.credentialType);

    // 3. Encrypt secret envelope immediately
    const envelope = SecretEncryptor.encrypt(params.secret, credentialId, keyVersion);

    const now = new Date().toISOString();
    const metadata: CredentialMetadata = {
      id: credentialId,
      organizationId: params.organizationId || null,
      projectId: params.projectId || null,
      provider: params.provider,
      credentialType: params.credentialType,
      displayName: params.displayName.trim(),
      status: 'ACTIVE',
      scope: params.scope || 'READ_ONLY',
      maskedPreview,
      expiresAt: params.expiresAt || null,
      lastValidatedAt: null,
      lastUsedAt: null,
      createdBy: params.createdBy || null,
      createdAt: now,
      updatedAt: now,
      version: 1,
      keyVersion,
      metadata: CredentialRedactor.deepSanitize(params.metadata || {}),
    };

    // 4. Store in repositories
    this.records.set(credentialId, metadata);
    this.secretEnvelopes.set(credentialId, envelope);

    // 5. Emit audit event
    CredentialEventEmitter.emit({
      eventType: 'CREDENTIAL_CREATED',
      credentialId,
      organizationId: metadata.organizationId,
      projectId: metadata.projectId,
      provider: metadata.provider,
      scope: metadata.scope,
      actor: params.createdBy || 'SYSTEM',
      result: 'SUCCESS',
    });

    return metadata;
  }

  /**
   * Retrieves safe metadata by ID. Never returns the secret!
   */
  public static async getRecord(
    credentialId: string,
    callerOrgId?: string | null
  ): Promise<CredentialMetadata | null> {
    const record = this.records.get(credentialId);
    if (!record) return null;

    if (callerOrgId && record.organizationId && record.organizationId !== callerOrgId) {
      throw new CredentialAccessDeniedError('Cross-organization credential access prohibited.');
    }

    return { ...record };
  }

  /**
   * Internal getter for encrypted secret envelope.
   */
  public static async getSecretEnvelope(
    credentialId: string
  ): Promise<EncryptedSecretEnvelope | null> {
    const envelope = this.secretEnvelopes.get(credentialId);
    return envelope ? { ...envelope } : null;
  }

  /**
   * Lists safe metadata for organization or project.
   */
  public static async listMetadata(params: {
    organizationId?: string | null;
    projectId?: string | null;
  }): Promise<CredentialMetadata[]> {
    let results = Array.from(this.records.values());

    if (params.organizationId) {
      results = results.filter((r) => r.organizationId === params.organizationId);
    }
    if (params.projectId) {
      results = results.filter((r) => r.projectId === params.projectId);
    }

    return results.map((r) => ({ ...r }));
  }

  /**
   * Updates non-sensitive metadata (display name, scope, etc.).
   */
  public static async updateMetadata(
    credentialId: string,
    updates: {
      displayName?: string;
      scope?: CredentialScope;
      status?: CredentialStatus;
      expiresAt?: string | null;
      metadata?: Record<string, any>;
    },
    callerOrgId?: string | null
  ): Promise<CredentialMetadata> {
    const record = await this.getRecord(credentialId, callerOrgId);
    if (!record) {
      throw new CredentialNotFoundError(credentialId);
    }

    if (updates.displayName) record.displayName = updates.displayName.trim();
    if (updates.scope) record.scope = updates.scope;
    if (updates.status) record.status = updates.status;
    if (updates.expiresAt !== undefined) record.expiresAt = updates.expiresAt;
    if (updates.metadata) {
      record.metadata = {
        ...record.metadata,
        ...CredentialRedactor.deepSanitize(updates.metadata),
      };
    }

    record.version += 1;
    record.updatedAt = new Date().toISOString();
    this.records.set(credentialId, record);

    return { ...record };
  }

  /**
   * Bounded validation against provider.
   */
  public static async validateCredential(
    credentialId: string,
    options?: { targetUrl?: string; timeoutMs?: number; skipNetwork?: boolean },
    callerOrgId?: string | null
  ): Promise<CredentialValidationResult> {
    const record = await this.getRecord(credentialId, callerOrgId);
    if (!record) {
      throw new CredentialNotFoundError(credentialId);
    }

    // Rate limiting check
    this.checkRateLimit(
      this.validationAttempts,
      credentialId,
      CREDENTIAL_POLICY.MAX_VALIDATION_ATTEMPTS_PER_HOUR,
      3600 * 1000,
      'validate_credential'
    );

    const envelope = await this.getSecretEnvelope(credentialId);
    if (!envelope) {
      throw new CredentialNotFoundError(credentialId);
    }

    const plaintext = SecretEncryptor.decrypt(envelope);
    const validator = ProviderRegistry.getValidator(record.provider);

    const result = await validator.validate(plaintext, record.credentialType, options);

    // Update status and timestamp
    record.lastValidatedAt = result.checkedAt;
    record.status = result.valid ? 'ACTIVE' : result.status;
    record.updatedAt = new Date().toISOString();
    this.records.set(credentialId, record);

    CredentialEventEmitter.emit({
      eventType: result.valid ? 'CREDENTIAL_VALIDATED' : 'CREDENTIAL_VALIDATION_FAILED',
      credentialId,
      organizationId: record.organizationId,
      projectId: record.projectId,
      provider: record.provider,
      scope: record.scope,
      actor: 'SYSTEM',
      result: result.valid ? 'SUCCESS' : 'FAILED',
      errorCode: result.valid ? undefined : result.status,
    });

    return result;
  }

  /**
   * Rotates encryption key version for a stored credential envelope.
   */
  public static async rotateCredentialKey(
    credentialId: string,
    targetKeyVersion: string,
    initiatedBy: string,
    callerOrgId?: string | null
  ): Promise<CredentialRotationResult> {
    const record = await this.getRecord(credentialId, callerOrgId);
    if (!record) {
      throw new CredentialNotFoundError(credentialId);
    }

    // Rate limiting check
    this.checkRateLimit(
      this.rotationAttempts,
      credentialId,
      CREDENTIAL_POLICY.MAX_ROTATIONS_PER_DAY,
      86400 * 1000,
      'rotate_key'
    );

    // Check target key exists
    if (!KeyManager.hasKey(targetKeyVersion)) {
      throw new CredentialInvalidError(`Target key version "${targetKeyVersion}" is not available.`);
    }

    // Idempotency: if already on target version, return completed
    if (record.keyVersion === targetKeyVersion) {
      return {
        credentialId,
        oldKeyVersion: record.keyVersion,
        newKeyVersion: targetKeyVersion,
        status: 'COMPLETED',
        completedAt: new Date().toISOString(),
      };
    }

    const envelope = await this.getSecretEnvelope(credentialId);
    if (!envelope) {
      throw new CredentialNotFoundError(credentialId);
    }

    const oldKeyVersion = envelope.keyVersion;

    CredentialEventEmitter.emit({
      eventType: 'CREDENTIAL_ROTATION_STARTED',
      credentialId,
      organizationId: record.organizationId,
      projectId: record.projectId,
      provider: record.provider,
      actor: initiatedBy,
      result: 'SUCCESS',
    });

    try {
      const newEnvelope = SecretEncryptor.rotate(envelope, targetKeyVersion);
      this.secretEnvelopes.set(credentialId, newEnvelope);

      record.keyVersion = targetKeyVersion;
      record.version += 1;
      record.updatedAt = new Date().toISOString();
      this.records.set(credentialId, record);

      const completedAt = new Date().toISOString();
      const rotationRecord = {
        credentialId,
        oldKeyVersion,
        newKeyVersion: targetKeyVersion,
        initiatedBy,
        status: 'COMPLETED',
        completedAt,
      };
      this.rotations.push(rotationRecord);

      CredentialEventEmitter.emit({
        eventType: 'CREDENTIAL_ROTATED',
        credentialId,
        organizationId: record.organizationId,
        projectId: record.projectId,
        provider: record.provider,
        actor: initiatedBy,
        result: 'SUCCESS',
      });

      return {
        credentialId,
        oldKeyVersion,
        newKeyVersion: targetKeyVersion,
        status: 'COMPLETED',
        completedAt,
      };
    } catch (err: any) {
      const completedAt = new Date().toISOString();
      this.rotations.push({
        credentialId,
        oldKeyVersion,
        newKeyVersion: targetKeyVersion,
        initiatedBy,
        status: 'FAILED',
        completedAt,
        failureCode: err.code || 'ROTATION_FAILED',
      });
      throw err;
    }
  }

  /**
   * Revokes a credential immediately.
   */
  public static async revokeCredential(
    credentialId: string,
    callerOrgId?: string | null
  ): Promise<CredentialMetadata> {
    const record = await this.getRecord(credentialId, callerOrgId);
    if (!record) {
      throw new CredentialNotFoundError(credentialId);
    }

    record.status = 'REVOKED';
    record.updatedAt = new Date().toISOString();
    record.version += 1;
    this.records.set(credentialId, record);

    CredentialEventEmitter.emit({
      eventType: 'CREDENTIAL_REVOKED',
      credentialId,
      organizationId: record.organizationId,
      projectId: record.projectId,
      provider: record.provider,
      actor: 'SYSTEM',
      result: 'SUCCESS',
    });

    return { ...record };
  }

  /**
   * Deletes a credential and wipes its encrypted envelope.
   */
  public static async deleteCredential(
    credentialId: string,
    callerOrgId?: string | null
  ): Promise<void> {
    const record = await this.getRecord(credentialId, callerOrgId);
    if (!record) {
      throw new CredentialNotFoundError(credentialId);
    }

    this.secretEnvelopes.delete(credentialId);
    this.records.delete(credentialId);

    CredentialEventEmitter.emit({
      eventType: 'CREDENTIAL_DELETED',
      credentialId,
      organizationId: record.organizationId,
      projectId: record.projectId,
      provider: record.provider,
      actor: 'SYSTEM',
      result: 'SUCCESS',
    });
  }

  public static async recordAccessLog(log: {
    credentialId: string;
    actorType: string;
    actorId: string;
    serviceIdentity: string;
    purpose: string;
    provider: string;
    result: 'SUCCESS' | 'DENIED' | 'FAILED';
    correlationId?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    this.accessLogs.push({
      id: `log-${crypto.randomUUID()}`,
      ...log,
      metadata: CredentialRedactor.deepSanitize(log.metadata || {}),
      accessedAt: new Date().toISOString(),
    });
  }

  public static async getAccessLogs(credentialId: string): Promise<any[]> {
    return this.accessLogs.filter((l) => l.credentialId === credentialId);
  }

  public static async getRotations(credentialId: string): Promise<any[]> {
    return this.rotations.filter((r) => r.credentialId === credentialId);
  }

  public static async touchLastUsed(credentialId: string): Promise<void> {
    const record = this.records.get(credentialId);
    if (record) {
      record.lastUsedAt = new Date().toISOString();
      this.records.set(credentialId, record);
    }
  }

  private static checkRateLimit(
    tracker: Map<string, number[]>,
    id: string,
    limit: number,
    windowMs: number,
    operation: string
  ): void {
    const now = Date.now();
    const timestamps = (tracker.get(id) || []).filter((t) => now - t < windowMs);
    if (timestamps.length >= limit) {
      throw new CredentialRateLimitedError(operation, limit);
    }
    timestamps.push(now);
    tracker.set(id, timestamps);
  }
}
