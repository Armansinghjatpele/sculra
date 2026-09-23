import { describe, it, expect, vi, beforeAll } from 'vitest';

vi.stubEnv('NODE_ENV', 'development');

beforeAll(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://sculra-test.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'dev-anon-key');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-123');
});

vi.mock('@supabase/supabase-js', () => {
  return {
    createClient: vi.fn(() => {
      const builder: any = {
        select: vi.fn().mockImplementation(() => builder),
        insert: vi.fn().mockImplementation(() => builder),
        update: vi.fn().mockImplementation(() => builder),
        delete: vi.fn().mockImplementation(() => builder),
        eq: vi.fn().mockImplementation(() => builder),
        order: vi.fn().mockImplementation(() => builder),
        single: vi.fn().mockImplementation(async () => ({
          data: null,
          error: { message: 'Test fallback' },
        })),
        then: vi.fn().mockImplementation((resolve) =>
          resolve({
            data: null,
            error: { message: 'Test fallback' },
          })
        ),
      };
      return {
        from: vi.fn().mockImplementation(() => builder),
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user' } }, error: null }),
        },
      };
    }),
  };
});

import {
  getCredentialRecords,
  createCredentialRecord,
  rotateCredentialRecordKey,
  validateCredentialRecord,
} from '../services/db';
import { PolicyManager } from '../lib/authz/policy';
import { RoleNotAllowedError } from '../lib/authz/authorization-errors';

describe('Prompt 39: Frontend Credential Vault UI & Services', () => {
  it('retrieves safe credential metadata without exposing plaintext secrets', async () => {
    const creds = await getCredentialRecords('mock-token');
    expect(creds.length).toBeGreaterThan(0);

    for (const cred of creds) {
      expect(cred).toHaveProperty('id');
      expect(cred).toHaveProperty('provider');
      expect(cred).toHaveProperty('displayName');
      expect(cred).toHaveProperty('maskedPreview');
      expect(cred).not.toHaveProperty('secret');
      expect(cred).not.toHaveProperty('encryptedData');
      expect(cred.maskedPreview).toMatch(/(gh_|sk-|wh_|sec_)••••••/);
    }
  });

  it('stores write-only credentials and produces safe metadata with masked preview', async () => {
    const rawSecret = 'ghp_BrandNewTestTokenToEncrypt999';
    const created = await createCredentialRecord('mock-token', {
      provider: 'GITHUB',
      credentialType: 'GITHUB_TOKEN',
      displayName: 'Staging VCS Key',
      secret: rawSecret,
      scope: 'READ_ONLY',
    });

    expect(created.id).toBeDefined();
    expect(created.displayName).toBe('Staging VCS Key');
    expect(created.maskedPreview).toBe('gh_••••••99');
    expect(created).not.toHaveProperty('secret');
    expect(JSON.stringify(created)).not.toContain(rawSecret);
  });

  it('enforces enterprise mutation policy (DEVELOPER denied create, ADMIN allowed)', () => {
    // DEVELOPER cannot create credentials
    expect(() =>
      PolicyManager.evaluateCredentialMutation({
        callerRole: 'DEVELOPER',
        action: 'CREATE',
      })
    ).toThrowError(RoleNotAllowedError);

    // VIEWER cannot create or rotate
    expect(() =>
      PolicyManager.evaluateCredentialMutation({
        callerRole: 'VIEWER',
        action: 'ROTATE',
      })
    ).toThrowError(RoleNotAllowedError);

    // ADMIN is allowed
    expect(() =>
      PolicyManager.evaluateCredentialMutation({
        callerRole: 'ADMIN',
        action: 'CREATE',
      })
    ).not.toThrow();

    // OWNER is allowed
    expect(() =>
      PolicyManager.evaluateCredentialMutation({
        callerRole: 'OWNER',
        action: 'DELETE',
      })
    ).not.toThrow();
  });

  it('rotates encryption key version safely without leaking plaintext', async () => {
    const rotation = await rotateCredentialRecordKey(
      'mock-token',
      'cred-gh-101',
      'v2',
      'ADMIN'
    );

    expect(rotation.status).toBe('COMPLETED');
    expect(rotation.newKeyVersion).toBe('v2');
    expect(rotation).not.toHaveProperty('secret');
  });

  it('validates credentials boundedly and returns honest result', async () => {
    const result = await validateCredentialRecord('mock-token', 'cred-gh-101');
    expect(result.valid).toBe(true);
    expect(result.status).toBe('ACTIVE');
    expect(result).not.toHaveProperty('secret');
  });
});
