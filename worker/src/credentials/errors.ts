// ==============================================================================
// Sculra Credential Vault Errors (worker/src/credentials/errors.ts)
// ==============================================================================
// Invariant: Never include plaintext secret material or decryption keys in errors.

export abstract class CredentialError extends Error {
  public abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class CredentialNotFoundError extends CredentialError {
  public readonly code = 'CREDENTIAL_NOT_FOUND';
  constructor(credentialId: string) {
    super(`Credential ${credentialId} not found in vault.`);
  }
}

export class CredentialAccessDeniedError extends CredentialError {
  public readonly code = 'CREDENTIAL_ACCESS_DENIED';
  constructor(message = 'Access to credential denied by policy.') {
    super(message);
  }
}

export class CredentialRevokedError extends CredentialError {
  public readonly code = 'CREDENTIAL_REVOKED';
  constructor(credentialId: string) {
    super(`Credential ${credentialId} has been revoked and cannot be resolved.`);
  }
}

export class CredentialExpiredError extends CredentialError {
  public readonly code = 'CREDENTIAL_EXPIRED';
  constructor(credentialId: string) {
    super(`Credential ${credentialId} has expired and cannot be resolved.`);
  }
}

export class CredentialInvalidError extends CredentialError {
  public readonly code = 'CREDENTIAL_INVALID';
  constructor(message = 'Credential format or configuration is invalid.') {
    super(message);
  }
}

export class CredentialDecryptionFailedError extends CredentialError {
  public readonly code = 'CREDENTIAL_DECRYPTION_FAILED';
  constructor(message = 'Failed to decrypt credential envelope with provided key version.') {
    super(message);
  }
}

export class CredentialKeyVersionUnavailableError extends CredentialError {
  public readonly code = 'CREDENTIAL_KEY_VERSION_UNAVAILABLE';
  constructor(keyVersion: string) {
    super(`Encryption key version "${keyVersion}" is not available in server environment.`);
  }
}

export class CredentialValidationFailedError extends CredentialError {
  public readonly code = 'CREDENTIAL_VALIDATION_FAILED';
  constructor(message: string) {
    super(message);
  }
}

export class CredentialProviderUnsupportedError extends CredentialError {
  public readonly code = 'CREDENTIAL_PROVIDER_UNSUPPORTED';
  constructor(provider: string) {
    super(`Provider "${provider}" is not supported by the credential vault.`);
  }
}

export class CredentialScopeDeniedError extends CredentialError {
  public readonly code = 'CREDENTIAL_SCOPE_DENIED';
  constructor(requested: string, allowed: string) {
    super(`Requested scope "${requested}" exceeds allowed credential scope "${allowed}".`);
  }
}

export class CredentialContextMismatchError extends CredentialError {
  public readonly code = 'CREDENTIAL_CONTEXT_MISMATCH';
  constructor(reason: string) {
    super(`Credential execution context mismatch: ${reason}`);
  }
}

export class CredentialRotationConflictError extends CredentialError {
  public readonly code = 'CREDENTIAL_ROTATION_CONFLICT';
  constructor(message = 'Concurrent rotation or conflicting operation in progress.') {
    super(message);
  }
}

export class CredentialRateLimitedError extends CredentialError {
  public readonly code = 'CREDENTIAL_RATE_LIMITED';
  constructor(operation: string, limit: number) {
    super(`Credential operation "${operation}" exceeded rate limit ceiling (${limit}).`);
  }
}
