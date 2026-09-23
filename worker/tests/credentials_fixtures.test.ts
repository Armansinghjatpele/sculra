// ==============================================================================
// Prompt 39: 26 Deterministic Credential Vault Fixtures (A through Z)
// (worker/tests/credentials_fixtures.test.ts)
// ==============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  VaultService,
  CredentialResolver,
  SecretEncryptor,
  KeyManager,
  CredentialRedactor,
  CredentialEventEmitter,
} from '../src/credentials';
import { PolicyManager, hasPermission, PERMISSIONS } from '../src/authz';
import { GitHubPRCreator } from '../src/fix-agent/pr';
import crypto from 'crypto';

describe('Prompt 39: 26 Deterministic Security Fixtures (A through Z)', () => {
  beforeEach(() => {
    VaultService.resetVault();
    KeyManager.resetRegisteredKeys();
  });

  // Fixture A: encrypted credential cannot be read as plaintext
  it('Fixture A: encrypted credential cannot be read as plaintext', async () => {
    const rawSecret = 'ghp_UltraSecretProductionToken1234567890';
    const metadata = await VaultService.createCredential({
      provider: 'GITHUB',
      credentialType: 'GITHUB_TOKEN',
      displayName: 'Prod Token',
      secret: rawSecret,
    });

    const envelope = await VaultService.getSecretEnvelope(metadata.id);
    expect(envelope).toBeDefined();
    expect(envelope!.encryptedData).not.toContain(rawSecret);
    expect(envelope!.encryptedData).not.toContain('UltraSecret');
    expect(envelope!.algorithm).toBe('AES-256-GCM');
    expect(envelope!.authTag).toBeDefined();
    expect(envelope!.iv).toBeDefined();
  });

  // Fixture B: wrong encryption key fails
  it('Fixture B: wrong encryption key fails', async () => {
    const rawSecret = 'sk-proj-SuperSecretOpenAIKey1234567890';
    const metadata = await VaultService.createCredential({
      provider: 'OPENAI',
      credentialType: 'OPENAI_API_KEY',
      displayName: 'AI Key',
      secret: rawSecret,
      keyVersion: 'v1',
    });

    const envelope = await VaultService.getSecretEnvelope(metadata.id);
    expect(envelope).toBeDefined();

    // Corrupt key for v1 in KeyManager
    const wrongKey = crypto.randomBytes(32);
    KeyManager.registerKey('v1', wrongKey);

    expect(() => SecretEncryptor.decrypt(envelope!)).toThrowError(
      /Decryption failed/i
    );
  });

  // Fixture C: wrong key version fails
  it('Fixture C: wrong key version fails', async () => {
    const rawSecret = 'whsec_SecretWebhookPayloadKey123456';
    const metadata = await VaultService.createCredential({
      provider: 'CI_WEBHOOK',
      credentialType: 'WEBHOOK_SECRET',
      displayName: 'Webhook Key',
      secret: rawSecret,
      keyVersion: 'v1',
    });

    const envelope = await VaultService.getSecretEnvelope(metadata.id);
    expect(envelope).toBeDefined();

    // Attempt decryption with non-existent version v99
    const corruptedEnvelope = { ...envelope!, keyVersion: 'v99' };
    expect(() => SecretEncryptor.decrypt(corruptedEnvelope)).toThrowError(
      /Encryption key version "v99" is not available/i
    );
  });

  // Fixture D: credential metadata contains no secret
  it('Fixture D: credential metadata contains no secret', async () => {
    const rawSecret = 'ghp_VerySensitivePlaintextTokenABCDEF123456';
    const metadata = await VaultService.createCredential({
      provider: 'GITHUB',
      credentialType: 'GITHUB_TOKEN',
      displayName: 'Repo Token',
      secret: rawSecret,
    });

    const json = JSON.stringify(metadata);
    expect(json).not.toContain(rawSecret);
    expect(json).not.toContain('VerySensitivePlaintextToken');
    expect(metadata.maskedPreview).toBe('gh_••••••56');
  });

  // Fixture E: GET API never returns secret
  it('Fixture E: GET API never returns secret', async () => {
    const rawSecret = 'sk-proj-SecretModelInferenceToken987654321';
    const created = await VaultService.createCredential({
      organizationId: 'org-test-1',
      provider: 'OPENAI',
      credentialType: 'OPENAI_API_KEY',
      displayName: 'OpenAI Secret',
      secret: rawSecret,
    });

    const fetched = await VaultService.getRecord(created.id, 'org-test-1');
    expect(fetched).toBeDefined();
    expect(fetched).not.toHaveProperty('secret');
    expect(fetched).not.toHaveProperty('ciphertext');
    expect(fetched).not.toHaveProperty('encryptedData');
    expect(JSON.stringify(fetched)).not.toContain(rawSecret);
  });

  // Fixture F: cross-organization access denied
  it('Fixture F: cross-organization access denied', async () => {
    const created = await VaultService.createCredential({
      organizationId: 'org-alpha',
      provider: 'GITHUB',
      credentialType: 'GITHUB_TOKEN',
      displayName: 'Alpha Repo',
      secret: 'ghp_AlphaTenantTokenSecret1234567890',
    });

    // 1. Service metadata access
    await expect(VaultService.getRecord(created.id, 'org-beta')).rejects.toThrowError(
      /Cross-organization credential access prohibited/i
    );

    // 2. Resolver execution context
    await expect(
      CredentialResolver.resolve(
        { credentialId: created.id, provider: 'GITHUB' },
        { organizationId: 'org-beta', actor: 'worker-node', actorType: 'WORKER', purpose: 'Testing' }
      )
    ).rejects.toThrowError(/Organization mismatch/i);
  });

  // Fixture G: cross-project access denied
  it('Fixture G: cross-project access denied', async () => {
    const created = await VaultService.createCredential({
      organizationId: 'org-1',
      projectId: 'proj-ecommerce',
      provider: 'GITHUB',
      credentialType: 'GITHUB_TOKEN',
      displayName: 'Ecommerce Repo Token',
      secret: 'ghp_EcommerceRepoToken1234567890',
    });

    await expect(
      CredentialResolver.resolve(
        { credentialId: created.id, provider: 'GITHUB' },
        {
          organizationId: 'org-1',
          projectId: 'proj-analytics', // Different project!
          actor: 'worker-node',
          actorType: 'WORKER',
          purpose: 'Testing',
        }
      )
    ).rejects.toThrowError(/Project mismatch/i);
  });

  // Fixture H: unauthorized role denied
  it('Fixture H: unauthorized role denied', () => {
    // VIEWER cannot use or mutate credentials
    expect(hasPermission('VIEWER', PERMISSIONS.CREDENTIALS_USE)).toBe(false);
    expect(hasPermission('VIEWER', PERMISSIONS.CREDENTIALS_CREATE)).toBe(false);
    expect(hasPermission('VIEWER', PERMISSIONS.CREDENTIALS_ROTATE)).toBe(false);

    // DEVELOPER cannot mutate credentials
    expect(hasPermission('DEVELOPER', PERMISSIONS.CREDENTIALS_CREATE)).toBe(false);
    expect(hasPermission('DEVELOPER', PERMISSIONS.CREDENTIALS_DELETE)).toBe(false);

    // PolicyManager denies VIEWER resolution
    expect(() =>
      PolicyManager.evaluateCredentialAccess({
        callerRole: 'VIEWER',
        credentialScope: 'READ_ONLY',
        requestedScope: 'READ_ONLY',
      })
    ).toThrowError(/Viewers are not permitted to resolve or use credentials/i);
  });

  // Fixture I: revoked credential cannot resolve
  it('Fixture I: revoked credential cannot resolve', async () => {
    const created = await VaultService.createCredential({
      provider: 'GITHUB',
      credentialType: 'GITHUB_TOKEN',
      displayName: 'Revocable Token',
      secret: 'ghp_RevocableTokenSecret1234567890',
    });

    // Revoke
    await VaultService.revokeCredential(created.id);

    await expect(
      CredentialResolver.resolve(
        { credentialId: created.id, provider: 'GITHUB' },
        { actor: 'tester', actorType: 'WORKER', purpose: 'Test' }
      )
    ).rejects.toThrowError(/has been revoked/i);
  });

  // Fixture J: expired credential cannot resolve
  it('Fixture J: expired credential cannot resolve', async () => {
    const pastDate = new Date(Date.now() - 3600 * 1000).toISOString();
    const created = await VaultService.createCredential({
      provider: 'GITHUB',
      credentialType: 'GITHUB_TOKEN',
      displayName: 'Expired Token',
      secret: 'ghp_ExpiredTokenSecret1234567890',
      expiresAt: pastDate,
    });

    await expect(
      CredentialResolver.resolve(
        { credentialId: created.id, provider: 'GITHUB' },
        { actor: 'tester', actorType: 'WORKER', purpose: 'Test' }
      )
    ).rejects.toThrowError(/has expired/i);
  });

  // Fixture K: successful authorized resolution
  it('Fixture K: successful authorized resolution', async () => {
    const rawSecret = 'ghp_ValidAuthorizedSecretToken123456';
    const created = await VaultService.createCredential({
      organizationId: 'org-test',
      projectId: 'proj-test',
      provider: 'GITHUB',
      credentialType: 'GITHUB_TOKEN',
      displayName: 'Valid Token',
      secret: rawSecret,
      scope: 'READ_ONLY',
    });

    const resolution = await CredentialResolver.resolve(
      { credentialId: created.id, provider: 'GITHUB', scope: 'READ_ONLY' },
      {
        organizationId: 'org-test',
        projectId: 'proj-test',
        actor: 'worker-1',
        actorType: 'WORKER',
        purpose: 'SourceSync',
      }
    );

    expect(resolution.secret).toBe(rawSecret);
    expect(resolution.provider).toBe('GITHUB');

    // Test dispose wipes secret
    resolution.dispose();
    expect(() => resolution.secret).toThrowError(/disposed/i);
  });

  // Fixture L: validation failure is safe
  it('Fixture L: validation failure is safe', async () => {
    const created = await VaultService.createCredential({
      provider: 'GITHUB',
      credentialType: 'GITHUB_TOKEN',
      displayName: 'Malformed Token',
      secret: 'invalid_short_token',
    });

    const result = await VaultService.validateCredential(created.id, { skipNetwork: true });
    expect(result.valid).toBe(false);
    expect(result.status).toBe('INVALID');
    expect(result.message).toContain('Invalid GitHub token format');

    // Check status was updated safely
    const record = await VaultService.getRecord(created.id);
    expect(record?.status).toBe('INVALID');
  });

  // Fixture M: GitHub read-only credential cannot perform writes
  it('Fixture M: GitHub read-only credential cannot perform writes', async () => {
    const created = await VaultService.createCredential({
      provider: 'GITHUB',
      credentialType: 'GITHUB_TOKEN',
      displayName: 'Read Only Token',
      secret: 'ghp_ReadOnlyTokenSecret1234567890',
      scope: 'READ_ONLY',
    });

    // Fix Agent PR creator requests READ_WRITE scope
    await expect(
      GitHubPRCreator.createPullRequest({
        repoOwner: 'owner',
        repoName: 'repo',
        sourceSha: 'abc',
        targetBranch: 'main',
        branchName: 'fix-1',
        issueId: 'iss-1',
        remediationId: 'rem-1',
        analysis: { diagnosis: { summary: 'test' } } as any,
        diffReview: {} as any,
        verification: {} as any,
        credentialId: created.id,
      })
    ).rejects.toThrowError(/exceeds allowed credential scope/i);
  });

  // Fixture N: webhook secret remains redacted
  it('Fixture N: webhook secret remains redacted', () => {
    const rawSecret = 'whsec_SuperSecretWebhookKey1234567890';
    const textWithSecret = `Webhook incoming event verified with key: ${rawSecret}`;
    const sanitized = CredentialRedactor.maskSecrets(textWithSecret);

    expect(sanitized).not.toContain(rawSecret);
    expect(sanitized).toContain('[REDACTED_WEBHOOK_SECRET]');
  });

  // Fixture O: OpenAI key remains redacted
  it('Fixture O: OpenAI key remains redacted', () => {
    const rawKey = 'sk-proj-UltraSensitiveOpenAIKey1234567890';
    const text = `Calling OpenAI endpoint with apiKey ${rawKey}`;
    const sanitized = CredentialRedactor.maskSecrets(text);

    expect(sanitized).not.toContain(rawKey);
    expect(sanitized).toContain('[REDACTED_OPENAI_KEY]');
  });

  // Fixture P: JWT remains redacted
  it('Fixture P: JWT remains redacted', () => {
    const rawJwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    const text = `Authorization: Bearer ${rawJwt}`;
    const sanitized = CredentialRedactor.maskSecrets(text);

    expect(sanitized).not.toContain(rawJwt);
    expect(sanitized).toContain('[REDACTED_JWT]');
  });

  // Fixture Q: secret never enters observability event
  it('Fixture Q: secret never enters observability event', async () => {
    let capturedEvent: any = null;
    CredentialEventEmitter.setEventSink((event) => {
      capturedEvent = event;
    });

    const rawSecret = 'ghp_DoNotLeakIntoObservability98765';
    const created = await VaultService.createCredential({
      provider: 'GITHUB',
      credentialType: 'GITHUB_TOKEN',
      displayName: 'Audit Token',
      secret: rawSecret,
    });

    expect(capturedEvent).toBeDefined();
    const eventJson = JSON.stringify(capturedEvent);
    expect(eventJson).not.toContain(rawSecret);
    expect(capturedEvent.metadata.credentialId).toBe(created.id);
  });

  // Fixture R: secret never enters Sentry payload
  it('Fixture R: secret never enters Sentry payload', () => {
    const rawSecret = 'sk-proj-SecretMustNotEnterSentryTrace123';
    const errorPayload = {
      message: `Failed connecting with key ${rawSecret}`,
      extra: { secret: rawSecret, header: `Bearer ${rawSecret}` },
    };

    const sanitized = CredentialRedactor.deepSanitize(errorPayload);
    const json = JSON.stringify(sanitized);

    expect(json).not.toContain(rawSecret);
    expect(sanitized.extra.secret).toBe('[REDACTED_CREDENTIAL]');
  });

  // Fixture S: secret never enters AI context
  it('Fixture S: secret never enters AI context', () => {
    const rawToken = 'ghp_TokenThatMustNeverEnterPromptContext123';
    const promptInput = {
      systemPrompt: 'Analyze this stack trace',
      userContext: `Error happened when using token ${rawToken} on repo github.com/owner/repo`,
    };

    const sanitized = CredentialRedactor.deepSanitize(promptInput);
    expect(sanitized.userContext).not.toContain(rawToken);
    expect(sanitized.userContext).toContain('[REDACTED_GITHUB_PAT]');
  });

  // Fixture T: concurrent rotation is rejected safely
  it('Fixture T: concurrent rotation is rejected safely', async () => {
    KeyManager.registerKey('v2', crypto.randomBytes(32));

    const created = await VaultService.createCredential({
      provider: 'GITHUB',
      credentialType: 'GITHUB_TOKEN',
      displayName: 'Rotating Token',
      secret: 'ghp_RotatingSecretToken1234567890',
      keyVersion: 'v1',
    });

    // Simulate 5 rotations to trigger rate limiting ceiling
    for (let i = 0; i < 5; i++) {
      await VaultService.rotateCredentialKey(created.id, 'v2', 'admin');
    }

    // 6th rotation within window must be rate limited
    await expect(
      VaultService.rotateCredentialKey(created.id, 'v2', 'admin')
    ).rejects.toThrowError(/exceeded rate limit ceiling/i);
  });

  // Fixture U: duplicate rotation is idempotent
  it('Fixture U: duplicate rotation is idempotent', async () => {
    KeyManager.registerKey('v2', crypto.randomBytes(32));

    const created = await VaultService.createCredential({
      provider: 'GITHUB',
      credentialType: 'GITHUB_TOKEN',
      displayName: 'Idempotent Token',
      secret: 'ghp_IdempotentSecretToken1234567890',
      keyVersion: 'v1',
    });

    const res1 = await VaultService.rotateCredentialKey(created.id, 'v2', 'admin');
    expect(res1.status).toBe('COMPLETED');
    expect(res1.newKeyVersion).toBe('v2');

    // Re-rotating to same version should be idempotent
    const res2 = await VaultService.rotateCredentialKey(created.id, 'v2', 'admin');
    expect(res2.status).toBe('COMPLETED');
    expect(res2.newKeyVersion).toBe('v2');
  });

  // Fixture V: production environment credential mutation respects Prompt 38 protections
  it('Fixture V: production environment credential mutation respects Prompt 38 protections', () => {
    // DEVELOPER cannot mutate production credentials
    expect(() =>
      PolicyManager.evaluateCredentialMutation({
        callerRole: 'DEVELOPER',
        action: 'CREATE',
        isProductionScope: true,
      })
    ).toThrowError(/Only organization Owners and Admins/i);

    // QA_LEAD cannot delete or rotate production credentials
    expect(() =>
      PolicyManager.evaluateCredentialMutation({
        callerRole: 'QA_LEAD',
        action: 'ROTATE',
        isProductionScope: true,
      })
    ).toThrowError(/Only organization Owners and Admins/i);

    // ADMIN and OWNER are allowed
    expect(() =>
      PolicyManager.evaluateCredentialMutation({
        callerRole: 'ADMIN',
        action: 'ROTATE',
        isProductionScope: true,
      })
    ).not.toThrow();

    expect(() =>
      PolicyManager.evaluateCredentialMutation({
        callerRole: 'OWNER',
        action: 'DELETE',
        isProductionScope: true,
      })
    ).not.toThrow();
  });

  // Fixture W: credential deletion prevents future resolution
  it('Fixture W: credential deletion prevents future resolution', async () => {
    const created = await VaultService.createCredential({
      provider: 'GITHUB',
      credentialType: 'GITHUB_TOKEN',
      displayName: 'Ephemeral Token',
      secret: 'ghp_EphemeralSecretToken1234567890',
    });

    await VaultService.deleteCredential(created.id);

    await expect(
      CredentialResolver.resolve(
        { credentialId: created.id, provider: 'GITHUB' },
        { actor: 'tester', actorType: 'WORKER', purpose: 'Test' }
      )
    ).rejects.toThrowError(/not found in vault/i);
  });

  // Fixture X: credential audit record contains metadata only
  it('Fixture X: credential audit record contains metadata only', async () => {
    const rawSecret = 'whsec_WebhookAuditVerificationKey999';
    const created = await VaultService.createCredential({
      provider: 'CI_WEBHOOK',
      credentialType: 'WEBHOOK_SECRET',
      displayName: 'Audit Webhook',
      secret: rawSecret,
    });

    const resolution = await CredentialResolver.resolve(
      { credentialId: created.id, provider: 'CI_WEBHOOK' },
      { actor: 'ci-runner', actorType: 'WORKER', purpose: 'WebhookValidation' }
    );
    resolution.dispose();

    const logs = await VaultService.getAccessLogs(created.id);
    expect(logs.length).toBeGreaterThanOrEqual(1);

    const logJson = JSON.stringify(logs);
    expect(logJson).not.toContain(rawSecret);
    expect(logs[0].result).toBe('SUCCESS');
    expect(logs[0].serviceIdentity).toBe('CredentialResolver');
  });

  // Fixture Y: project credential cannot be resolved by another project
  it('Fixture Y: project credential cannot be resolved by another project', async () => {
    const created = await VaultService.createCredential({
      projectId: 'proj-alpha',
      provider: 'GITHUB',
      credentialType: 'GITHUB_TOKEN',
      displayName: 'Alpha Token',
      secret: 'ghp_AlphaTokenSecret1234567890',
    });

    await expect(
      CredentialResolver.resolve(
        { credentialId: created.id, provider: 'GITHUB' },
        {
          projectId: 'proj-beta',
          actor: 'worker',
          actorType: 'WORKER',
          purpose: 'Testing',
        }
      )
    ).rejects.toThrowError(/Project mismatch/i);
  });

  // Fixture Z: credential resolution requires trusted execution context
  it('Fixture Z: credential resolution requires trusted execution context', async () => {
    const created = await VaultService.createCredential({
      organizationId: 'org-enterprise',
      provider: 'GITHUB',
      credentialType: 'GITHUB_TOKEN',
      displayName: 'Enterprise Token',
      secret: 'ghp_EnterpriseTokenSecret1234567890',
    });

    // Mismatched org context
    await expect(
      CredentialResolver.resolve(
        { credentialId: created.id, provider: 'GITHUB' },
        {
          organizationId: 'org-rogue',
          actor: 'unknown',
          actorType: 'WORKER',
          purpose: 'Probe',
        }
      )
    ).rejects.toThrowError(/Organization mismatch/i);
  });
});
