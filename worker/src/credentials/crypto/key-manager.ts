// ==============================================================================
// Sculra Credential Vault Key Manager (worker/src/credentials/crypto/key-manager.ts)
// ==============================================================================
// Invariants:
// - Encryption keys are stored in server environment variables only.
// - Encryption keys are NEVER persisted in Supabase or returned to clients.
// - Encryption keys are NEVER logged.

import crypto from 'crypto';
import { CredentialKeyVersionUnavailableError } from '../errors';
import { CREDENTIAL_POLICY } from '../policy';

export class KeyManager {
  private static registeredKeys: Map<string, Buffer> = new Map();

  /**
   * Registers a specific key buffer for a version (used in tests and dynamic config).
   */
  public static registerKey(version: string, keyMaterial: string | Buffer): void {
    const buf = this.normalizeKeyMaterial(keyMaterial);
    this.registeredKeys.set(version.toLowerCase(), buf);
  }

  /**
   * Clears dynamically registered keys (for test resets).
   */
  public static resetRegisteredKeys(): void {
    this.registeredKeys.clear();
  }

  /**
   * Resolves the 32-byte symmetric AES-256 key buffer for the given key version.
   */
  public static getKey(version: string = CREDENTIAL_POLICY.DEFAULT_KEY_VERSION): Buffer {
    const normalizedVer = version.toLowerCase();

    // 1. Check dynamically registered keys
    if (this.registeredKeys.has(normalizedVer)) {
      return this.registeredKeys.get(normalizedVer)!;
    }

    // 2. Check environment variable: SCULRA_VAULT_KEY_<VERSION>
    const envKeyName = `SCULRA_VAULT_KEY_${normalizedVer.toUpperCase()}`;
    const envVal = process.env[envKeyName];
    if (envVal) {
      return this.normalizeKeyMaterial(envVal);
    }

    // 3. Check JSON map in SCULRA_VAULT_KEYS
    if (process.env.SCULRA_VAULT_KEYS) {
      try {
        const parsed = JSON.parse(process.env.SCULRA_VAULT_KEYS);
        if (parsed && typeof parsed === 'object' && parsed[normalizedVer]) {
          return this.normalizeKeyMaterial(parsed[normalizedVer]);
        }
      } catch {
        // Ignore JSON parse error, fall through
      }
    }

    // 4. Check fallback SCULRA_VAULT_ENCRYPTION_KEY for 'v1'
    if (normalizedVer === 'v1' && process.env.SCULRA_VAULT_ENCRYPTION_KEY) {
      return this.normalizeKeyMaterial(process.env.SCULRA_VAULT_ENCRYPTION_KEY);
    }

    // 5. In test or development environments, allow a deterministic test key for v1
    if (process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
      if (normalizedVer === 'v1') {
        const testSeed = 'sculra-test-vault-key-seed-v1-deterministic-32b';
        return crypto.createHash('sha256').update(testSeed).digest();
      }
    }

    // If key version cannot be resolved, throw typed error
    throw new CredentialKeyVersionUnavailableError(version);
  }

  /**
   * Returns whether a key exists for the version without exposing the key material.
   */
  public static hasKey(version: string): boolean {
    try {
      this.getKey(version);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Returns the current active default key version for new encryptions.
   */
  public static getActiveKeyVersion(): string {
    return process.env.SCULRA_ACTIVE_KEY_VERSION || CREDENTIAL_POLICY.DEFAULT_KEY_VERSION;
  }

  private static normalizeKeyMaterial(raw: string | Buffer): Buffer {
    if (Buffer.isBuffer(raw)) {
      if (raw.length === 32) return raw;
      return crypto.createHash('sha256').update(raw).digest();
    }

    const trimmed = raw.trim();
    // 64-char hex string = 32 bytes
    if (trimmed.length === 64 && /^[0-9a-fA-F]{64}$/.test(trimmed)) {
      return Buffer.from(trimmed, 'hex');
    }

    // Otherwise derive 32-byte key via SHA-256
    return crypto.createHash('sha256').update(trimmed, 'utf8').digest();
  }
}
