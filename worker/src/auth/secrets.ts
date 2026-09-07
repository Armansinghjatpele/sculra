// ==============================================================================
// Sculra Secret Provider Interface & Environment Implementation (worker/src/auth/secrets.ts)
// ==============================================================================
// MVP / Local Secret Retrieval Mechanism.
//
// IMPORTANT ARCHITECTURAL DISCLAIMER:
// EnvironmentSecretProvider is an MVP / local configuration mechanism, NOT a production secret vault.
// Future milestones can provide integration with AWS Secrets Manager, HashiCorp Vault, Supabase Vault, etc.
//
// CRITICAL SECURITY GUARANTEE:
// Secrets retrieved from SecretProvider must ONLY be used in-memory by FormLoginEngine to fill browser fields.
// Secrets must NEVER enter:
// - AIQAContext / AIQAPlan / AIQAResult
// - ProductModel / ProductFeature / ProductWorkflow
// - public.test_evidence / public.issues
// - Structured logs, console output, Sentry events, or screenshots.

export interface SecretProvider {
  /**
   * Retrieves a secret string by reference key.
   * Returns undefined if the secret is missing or empty.
   */
  getSecret(keyRef: string): Promise<string | undefined>;

  /**
   * Resolves a secret reference string ('env:VAR_NAME', 'raw:VALUE', or plain string).
   * Throws if an env: reference cannot be found.
   */
  resolveSecret(keyRef: string): Promise<string>;

  /**
   * Checks whether a secret is defined for the given key reference without revealing its value.
   */
  hasSecret(keyRef: string): Promise<boolean>;
}

export class EnvironmentSecretProvider implements SecretProvider {
  private envMap: Map<string, string>;

  constructor(customEnv?: Record<string, string>) {
    this.envMap = new Map();
    if (customEnv) {
      for (const [k, v] of Object.entries(customEnv)) {
        if (v) this.envMap.set(k, v);
      }
    }
  }

  public async resolveSecret(keyRef: string): Promise<string> {
    if (!keyRef || typeof keyRef !== 'string') {
      throw new Error('Invalid secret reference provided');
    }

    const trimmed = keyRef.trim();

    // 1. Raw value prefix: 'raw:superpassword'
    if (trimmed.startsWith('raw:')) {
      return trimmed.slice(4);
    }

    // 2. Explicit env prefix: 'env:MY_VAR'
    if (trimmed.startsWith('env:')) {
      const varName = trimmed.slice(4);
      const val = this.envMap.get(varName) || process.env[varName];
      if (!val) {
        throw new Error(`Environment secret ${varName} is not set in process environment`);
      }
      return val;
    }

    // 3. Fallback: try looking up in env map / process.env
    const resolved = await this.getSecret(trimmed);
    if (resolved) {
      return resolved;
    }

    // 4. If not found in env and has no prefix, treat as raw literal string
    return trimmed;
  }

  public async getSecret(keyRef: string): Promise<string | undefined> {
    if (!keyRef || typeof keyRef !== 'string') {
      return undefined;
    }

    const trimmedKey = keyRef.trim();

    if (trimmedKey.startsWith('raw:')) {
      return trimmedKey.slice(4);
    }

    if (trimmedKey.startsWith('env:')) {
      const varName = trimmedKey.slice(4);
      return this.envMap.get(varName) || process.env[varName];
    }

    // 1. Direct match in custom env map
    if (this.envMap.has(trimmedKey)) {
      return this.envMap.get(trimmedKey);
    }

    // 2. Direct match in process.env
    if (process.env[trimmedKey]) {
      return process.env[trimmedKey];
    }

    // 3. Fallback resolution for standard role patterns:
    // e.g. "admin_password" -> SCULRA_TEST_ADMIN_PASSWORD -> SCULRA_TEST_PASSWORD
    const upperKey = trimmedKey.toUpperCase().replace(/[-\s]/g, '_');
    const prefixedKey = upperKey.startsWith('SCULRA_') ? upperKey : `SCULRA_TEST_${upperKey}`;

    if (this.envMap.has(prefixedKey)) {
      return this.envMap.get(prefixedKey);
    }
    if (process.env[prefixedKey]) {
      return process.env[prefixedKey];
    }

    return undefined;
  }

  public async hasSecret(keyRef: string): Promise<boolean> {
    const value = await this.getSecret(keyRef);
    return typeof value === 'string' && value.length > 0;
  }
}

export function createSecretProvider(customEnv?: Record<string, string>): SecretProvider {
  return new EnvironmentSecretProvider(customEnv);
}

