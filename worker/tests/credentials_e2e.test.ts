// ==============================================================================
// Prompt 39: Credential Vault Integrations E2E Test
// (worker/tests/credentials_e2e.test.ts)
// ==============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  VaultService,
  CredentialResolver,
  KeyManager,
} from '../src/credentials';
import { verifyGitHubSignatureWithVault } from '../src/cicd/webhooks';
import { GitHubSourceAdapter } from '../src/sources/adapters/github-adapter';
import { createSecretProvider } from '../src/auth/secrets';
import { createAIQAProviderWithVault } from '../src/ai-qa/factory';
import { GitHubPRCreator } from '../src/fix-agent/pr';
import crypto from 'crypto';

describe('Prompt 39: Integrations E2E with Credential Vault', () => {
  beforeEach(() => {
    VaultService.resetVault();
    KeyManager.resetRegisteredKeys();
  });

  // 1. GitHub source -> credential reference -> authorized worker resolution
  it('integrates GitHub source adapter with vault credential reference', async () => {
    const cred = await VaultService.createCredential({
      provider: 'GITHUB',
      credentialType: 'GITHUB_TOKEN',
      displayName: 'GitHub Source Token',
      secret: 'ghp_SourceTokenSecret1234567890123456',
      scope: 'READ_ONLY',
    });

    const adapter = new GitHubSourceAdapter();
    const result = await adapter.validate(
      'https://github.com/Armansinghjatpele/sculra',
      {
        credentialId: cred.id,
      },
      { skipNetworkChecks: true }
    );

    expect(result.valid).toBe(true);
    expect(result.status).toBe('AVAILABLE');
  });

  // 2. CI/CD webhook -> credential resolution -> HMAC validation
  it('integrates CI/CD webhook signature verification with vault credential', async () => {
    const webhookSecret = 'whsec_SuperSecureWebhookSigningKey123456';
    const cred = await VaultService.createCredential({
      provider: 'CI_WEBHOOK',
      credentialType: 'WEBHOOK_SECRET',
      displayName: 'CI Webhook Key',
      secret: webhookSecret,
      scope: 'WEBHOOK_VERIFY',
    });

    const payload = JSON.stringify({ action: 'push', ref: 'refs/heads/main' });
    const hmac = crypto.createHmac('sha256', webhookSecret).update(payload).digest('hex');
    const signatureHeader = `sha256=${hmac}`;

    // Verify through vault reference
    const verified = await verifyGitHubSignatureWithVault(
      payload,
      signatureHeader,
      `vault:${cred.id}`
    );
    expect(verified).toBe(true);

    // Verify wrong signature is rejected
    const badSignature = `sha256=0000000000000000000000000000000000000000000000000000000000000000`;
    const rejected = await verifyGitHubSignatureWithVault(
      payload,
      badSignature,
      `vault:${cred.id}`
    );
    expect(rejected).toBe(false);
  });

  // 3. Authenticated QA -> credential reference -> protected test execution
  it('integrates Authenticated QA form login with vault credential reference', async () => {
    const cred = await VaultService.createCredential({
      provider: 'ENVIRONMENT_AUTH',
      credentialType: 'CUSTOM_SECRET',
      displayName: 'Form Login Password',
      secret: 'SuperSecretFormLoginPassword123!',
      scope: 'EXECUTION_ONLY',
    });

    const secretProvider = createSecretProvider();
    const resolvedPassword = await secretProvider.resolveSecret(`vault:${cred.id}`);
    expect(resolvedPassword).toBe('SuperSecretFormLoginPassword123!');
  });

  // 4. OpenAI provider -> credential resolution -> AI request
  it('integrates OpenAI provider factory with vault credential resolution', async () => {
    const cred = await VaultService.createCredential({
      provider: 'OPENAI',
      credentialType: 'OPENAI_API_KEY',
      displayName: 'OpenAI Test Key',
      secret: 'sk-proj-TestingOpenAIProviderKey1234567890',
      scope: 'EXECUTION_ONLY',
    });

    const provider = await createAIQAProviderWithVault({
      provider: 'openai',
      credentialId: cred.id,
    });

    expect(provider).toBeDefined();
    expect(provider.metadata.name).toBe('openai');
  });

  // 5. Fix Agent -> GitHub credential -> authorization -> PR path
  it('integrates Fix Agent PR creation with authorized READ_WRITE vault credential', async () => {
    const cred = await VaultService.createCredential({
      provider: 'GITHUB',
      credentialType: 'GITHUB_TOKEN',
      displayName: 'Fix Agent PR Creator Token',
      secret: 'ghp_FixAgentPRTokenSecret1234567890',
      scope: 'READ_WRITE',
    });

    // Uses customPRHandler in offline test mode to verify token is resolved with READ_WRITE scope
    const result = await GitHubPRCreator.createPullRequest({
      repoOwner: 'Armansinghjatpele',
      repoName: 'sculra',
      sourceSha: 'commit1234567890',
      targetBranch: 'main',
      branchName: 'sculra/fix/test-1',
      issueId: 'iss-1',
      remediationId: 'rem-1',
      analysis: {
        diagnosis: {
          summary: 'Null check fix',
          category: 'NULL_POINTER',
          explanation: 'Handled undefined value in input parser',
        },
        confidence: 0.95,
      } as any,
      diffReview: {
        filesChanged: ['src/test.ts'],
        additions: 1,
        deletions: 0,
      } as any,
      verification: {
        status: 'VERIFIED_FIXED',
        baselineStatus: 'CONFIRMED_FAILED',
        summary: 'Targeted tests verified',
        targetedCommandResults: [],
      } as any,
      credentialId: cred.id,
      customPRHandler: async (opts, title, body) => {
        return {
          prNumber: 42,
          prUrl: 'https://github.com/Armansinghjatpele/sculra/pull/42',
          branchName: opts.branchName,
          headSha: opts.sourceSha,
          title,
          body,
          createdAt: new Date().toISOString(),
        };
      },
    });

    expect(result.prNumber).toBe(42);
    expect(result.prUrl).toContain('/pull/42');
  });
});
