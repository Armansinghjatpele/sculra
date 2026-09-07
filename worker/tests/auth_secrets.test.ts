import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EnvironmentSecretProvider, createSecretProvider } from '../src/auth/secrets';

describe('SecretProvider & EnvironmentSecretProvider', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('resolves env:VAR_NAME secret reference from process.env', async () => {
    process.env.TEST_APP_PASSWORD = 'super-secret-password-123';
    const provider = new EnvironmentSecretProvider();

    const value = await provider.resolveSecret('env:TEST_APP_PASSWORD');
    expect(value).toBe('super-secret-password-123');
  });

  it('resolves raw:VALUE secret reference directly', async () => {
    const provider = new EnvironmentSecretProvider();

    const value = await provider.resolveSecret('raw:direct-secret-value');
    expect(value).toBe('direct-secret-value');
  });

  it('resolves plain string without prefix as raw value', async () => {
    const provider = new EnvironmentSecretProvider();

    const value = await provider.resolveSecret('plain-password');
    expect(value).toBe('plain-password');
  });

  it('throws descriptive error if environment variable is not defined', async () => {
    delete process.env.NON_EXISTENT_VAR;
    const provider = new EnvironmentSecretProvider();

    await expect(provider.resolveSecret('env:NON_EXISTENT_VAR')).rejects.toThrow(
      'Environment secret NON_EXISTENT_VAR is not set in process environment'
    );
  });

  it('createSecretProvider factory returns EnvironmentSecretProvider', () => {
    const provider = createSecretProvider();
    expect(provider).toBeInstanceOf(EnvironmentSecretProvider);
  });
});
