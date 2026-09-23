// ==============================================================================
// Sculra Credential Resolver (worker/src/credentials/resolver.ts)
// ==============================================================================
// Invariants:
// - Trusted worker/server context only.
// - Plaintext secret is short-lived in-memory, NEVER persisted, NEVER passed to AI, NEVER logged.
// - Returns CredentialResolution with explicit dispose() semantics.

import {
  CredentialReference,
  CredentialExecutionContext,
  CredentialResolution,
} from './types';
import {
  CredentialNotFoundError,
  CredentialRevokedError,
  CredentialExpiredError,
  CredentialInvalidError,
  CredentialScopeDeniedError,
  CredentialContextMismatchError,
} from './errors';
import { SecretEncryptor } from './crypto/secret-encryptor';
import { CredentialEventEmitter } from './events';
import { VaultService } from './vault-service';

export class CredentialResolver {
  /**
   * Resolves a credential reference in a trusted execution context.
   * Decrypts the secret in-memory only and returns a short-lived disposable resolution.
   */
  public static async resolve(
    reference: CredentialReference,
    context: CredentialExecutionContext
  ): Promise<CredentialResolution> {
    const startTime = Date.now();

    // 1. Fetch metadata
    const record = await VaultService.getRecord(reference.credentialId);
    if (!record) {
      CredentialEventEmitter.emit({
        eventType: 'CREDENTIAL_ACCESS_DENIED',
        credentialId: reference.credentialId,
        provider: reference.provider,
        actor: context.actor,
        purpose: context.purpose,
        result: 'DENIED',
        errorCode: 'CREDENTIAL_NOT_FOUND',
      });
      throw new CredentialNotFoundError(reference.credentialId);
    }

    // 2. Validate tenant execution context isolation
    if (record.organizationId && context.organizationId && record.organizationId !== context.organizationId) {
      CredentialEventEmitter.emit({
        eventType: 'CREDENTIAL_ACCESS_DENIED',
        credentialId: record.id,
        organizationId: context.organizationId,
        projectId: context.projectId,
        provider: record.provider,
        actor: context.actor,
        purpose: context.purpose,
        result: 'DENIED',
        errorCode: 'TENANT_MISMATCH',
      });
      throw new CredentialContextMismatchError('Organization mismatch: cross-tenant access prohibited.');
    }

    if (record.projectId && context.projectId && record.projectId !== context.projectId) {
      CredentialEventEmitter.emit({
        eventType: 'CREDENTIAL_ACCESS_DENIED',
        credentialId: record.id,
        organizationId: context.organizationId,
        projectId: context.projectId,
        provider: record.provider,
        actor: context.actor,
        purpose: context.purpose,
        result: 'DENIED',
        errorCode: 'PROJECT_MISMATCH',
      });
      throw new CredentialContextMismatchError('Project mismatch: credential is bound to a different project.');
    }

    // 3. Provider match
    if (record.provider !== reference.provider) {
      throw new CredentialContextMismatchError(
        `Requested provider "${reference.provider}" does not match credential provider "${record.provider}".`
      );
    }

    // 4. Validate status & expiration
    if (record.status === 'REVOKED') {
      throw new CredentialRevokedError(record.id);
    }

    if (record.status === 'INVALID' || record.status === 'VALIDATION_FAILED') {
      throw new CredentialInvalidError(`Credential ${record.id} is in status ${record.status}.`);
    }

    if (record.expiresAt && new Date(record.expiresAt).getTime() <= Date.now()) {
      throw new CredentialExpiredError(record.id);
    }

    // 5. Validate requested scope
    if (reference.scope) {
      if (reference.scope === 'ADMIN' && record.scope !== 'ADMIN') {
        throw new CredentialScopeDeniedError(reference.scope, record.scope);
      }
      if (reference.scope === 'READ_WRITE' && (record.scope === 'READ_ONLY' || record.scope === 'EXECUTION_ONLY' || record.scope === 'WEBHOOK_VERIFY')) {
        throw new CredentialScopeDeniedError(reference.scope, record.scope);
      }
      if (reference.scope === 'WEBHOOK_VERIFY' && record.scope !== 'WEBHOOK_VERIFY' && record.scope !== 'ADMIN') {
        throw new CredentialScopeDeniedError(reference.scope, record.scope);
      }
    }

    // 6. Decrypt secret envelope
    const envelope = await VaultService.getSecretEnvelope(record.id);
    if (!envelope) {
      throw new CredentialNotFoundError(record.id);
    }

    let rawSecret = SecretEncryptor.decrypt(envelope);
    let isDisposed = false;

    // 7. Record usage & audit log
    await VaultService.recordAccessLog({
      credentialId: record.id,
      actorType: context.actorType,
      actorId: context.actor,
      serviceIdentity: 'CredentialResolver',
      purpose: context.purpose,
      provider: record.provider,
      result: 'SUCCESS',
      correlationId: context.executionJobId || undefined,
      metadata: {
        scope: record.scope,
        requestedScope: reference.scope,
      },
    });

    await VaultService.touchLastUsed(record.id);

    CredentialEventEmitter.emit({
      eventType: 'CREDENTIAL_USED',
      credentialId: record.id,
      organizationId: record.organizationId,
      projectId: record.projectId,
      provider: record.provider,
      scope: record.scope,
      actor: context.actor,
      purpose: context.purpose,
      result: 'SUCCESS',
      durationMs: Date.now() - startTime,
    });

    return {
      credentialId: record.id,
      provider: record.provider,
      scope: record.scope,
      keyVersion: envelope.keyVersion,
      get secret() {
        if (isDisposed) {
          throw new Error('Credential resolution has already been disposed.');
        }
        return rawSecret;
      },
      dispose() {
        rawSecret = '';
        isDisposed = true;
      },
    };
  }
}
