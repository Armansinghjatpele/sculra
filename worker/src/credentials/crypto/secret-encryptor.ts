// ==============================================================================
// Sculra Secret Encryptor (worker/src/credentials/crypto/secret-encryptor.ts)
// ==============================================================================
// Invariants:
// - Uses standard Node.js crypto primitives (AES-256-GCM). Zero homemade cryptography.
// - Plaintext is never logged or returned through unauthenticated channels.
// - Decryption errors throw typed CredentialDecryptionFailedError.

import crypto from 'crypto';
import { EncryptedSecretEnvelope } from '../types';
import { CredentialDecryptionFailedError } from '../errors';
import { CREDENTIAL_POLICY } from '../policy';
import { KeyManager } from './key-manager';

export class SecretEncryptor {
  /**
   * Encrypts a plaintext secret into an authenticated AES-256-GCM envelope.
   */
  public static encrypt(
    secret: string,
    credentialId: string,
    keyVersion = KeyManager.getActiveKeyVersion()
  ): EncryptedSecretEnvelope {
    if (!secret || typeof secret !== 'string') {
      throw new Error('Secret to encrypt must be a non-empty string.');
    }

    const key = KeyManager.getKey(keyVersion);
    const iv = crypto.randomBytes(CREDENTIAL_POLICY.IV_LENGTH_BYTES);

    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(secret, 'utf8'),
      cipher.final(),
    ]);

    const authTag = cipher.getAuthTag();

    return {
      credentialId,
      encryptedData: ciphertext.toString('hex'),
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      keyVersion,
      algorithm: CREDENTIAL_POLICY.DEFAULT_ALGORITHM,
    };
  }

  /**
   * Decrypts an authenticated AES-256-GCM envelope using the specified key version.
   */
  public static decrypt(envelope: EncryptedSecretEnvelope): string {
    if (!envelope || !envelope.encryptedData || !envelope.iv || !envelope.authTag) {
      throw new CredentialDecryptionFailedError('Corrupted or incomplete encrypted secret envelope.');
    }

    try {
      const key = KeyManager.getKey(envelope.keyVersion);
      const iv = Buffer.from(envelope.iv, 'hex');
      const authTag = Buffer.from(envelope.authTag, 'hex');
      const ciphertext = Buffer.from(envelope.encryptedData, 'hex');

      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);

      const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]);

      return decrypted.toString('utf8');
    } catch (err: any) {
      if (err.name === 'CredentialKeyVersionUnavailableError') {
        throw err;
      }
      throw new CredentialDecryptionFailedError(
        `Decryption failed for key version ${envelope.keyVersion}: Authentication tag verification failed.`
      );
    }
  }

  /**
   * Rotates a secret envelope to a new key version without persisting plaintext.
   */
  public static rotate(
    envelope: EncryptedSecretEnvelope,
    targetKeyVersion: string
  ): EncryptedSecretEnvelope {
    const plaintext = this.decrypt(envelope);
    try {
      return this.encrypt(plaintext, envelope.credentialId, targetKeyVersion);
    } finally {
      // Best-effort cleanup
    }
  }
}
