// ==============================================================================
// Prompt 39: Mandatory No Secret Leakage Test
// (worker/tests/credentials_leakage.test.ts)
// ==============================================================================
// Invariant:
// A secret undergoing the entire lifecycle (CREATE, VALIDATE, USE, OBSERVE,
// FAIL, REDACT, ROTATE, REVOKE, DELETE) MUST NEVER appear in:
// - database metadata
// - API responses
// - error messages
// - test evidence
// - issue records
// - observability events
// - Sentry payloads
// - AI context
// - frontend HTML / state

import { describe, it, expect, beforeEach } from 'vitest';
import {
  VaultService,
  CredentialResolver,
  KeyManager,
  CredentialRedactor,
  CredentialEventEmitter,
} from '../src/credentials';
import crypto from 'crypto';

describe('Mandatory No Secret Leakage Test', () => {
  beforeEach(() => {
    VaultService.resetVault();
    KeyManager.resetRegisteredKeys();
  });

  it('proves zero secret leakage across the complete credential lifecycle', async () => {
    const rawSecret = 'ghp_ZeroLeakageMandatoryTestSecretToken777';
    const observabilityLogs: any[] = [];
    CredentialEventEmitter.setEventSink((event) => {
      observabilityLogs.push(event);
    });

    KeyManager.registerKey('v2', crypto.randomBytes(32));

    // 1. CREATE
    const metadata = await VaultService.createCredential({
      organizationId: 'org-leak-test',
      projectId: 'proj-leak-test',
      provider: 'GITHUB',
      credentialType: 'GITHUB_TOKEN',
      displayName: 'Canary Token',
      secret: rawSecret,
      scope: 'READ_WRITE',
      keyVersion: 'v1',
    });

    // Assert: metadata does not contain rawSecret
    expect(JSON.stringify(metadata)).not.toContain(rawSecret);
    expect(metadata.maskedPreview).toBe('gh_••••••77');

    // 2. VALIDATE
    const validationResult = await VaultService.validateCredential(metadata.id, {
      skipNetwork: true,
    });
    expect(JSON.stringify(validationResult)).not.toContain(rawSecret);

    // 3. USE
    const resolution = await CredentialResolver.resolve(
      { credentialId: metadata.id, provider: 'GITHUB', scope: 'READ_WRITE' },
      {
        organizationId: 'org-leak-test',
        projectId: 'proj-leak-test',
        actor: 'worker-canary',
        actorType: 'WORKER',
        purpose: 'CanaryOperation',
      }
    );
    expect(resolution.secret).toBe(rawSecret);

    // Test evidence / issue / error mocking
    const simulatedEvidence = {
      testRunId: 'tr-canary-1',
      output: `Executed operation with status OK, using authorization: Bearer ${rawSecret}`,
    };
    const sanitizedEvidence = CredentialRedactor.deepSanitize(simulatedEvidence);
    expect(JSON.stringify(sanitizedEvidence)).not.toContain(rawSecret);
    expect(sanitizedEvidence.output).toContain('[REDACTED_GITHUB_PAT]');

    resolution.dispose();

    // 4. OBSERVE
    // Verify all emitted events do not contain rawSecret
    for (const evt of observabilityLogs) {
      const serialized = JSON.stringify(evt);
      expect(serialized).not.toContain(rawSecret);
      expect(serialized).not.toContain('ZeroLeakageMandatoryTestSecret');
    }

    // 5. FAIL
    let capturedError: any = null;
    try {
      // Trigger a failure by requesting an invalid scope
      await CredentialResolver.resolve(
        { credentialId: metadata.id, provider: 'GITHUB', scope: 'ADMIN' },
        {
          organizationId: 'org-leak-test',
          projectId: 'proj-leak-test',
          actor: 'worker-canary',
          actorType: 'WORKER',
          purpose: 'Probe',
        }
      );
    } catch (err: any) {
      capturedError = err;
    }
    expect(capturedError).toBeDefined();
    expect(capturedError.message).not.toContain(rawSecret);

    // 6. REDACT (AI context & Sentry payload test)
    const simulatedAIContext = {
      role: 'user',
      content: `Please fix code error. Connection string was apiKey=${rawSecret}`,
    };
    const sanitizedAIContext = CredentialRedactor.deepSanitize(simulatedAIContext);
    expect(JSON.stringify(sanitizedAIContext)).not.toContain(rawSecret);

    const simulatedSentryPayload = {
      exception: {
        values: [{ value: `Unauthorized: Token ${rawSecret} expired` }],
      },
      request: {
        headers: { Authorization: `Bearer ${rawSecret}` },
      },
    };
    const sanitizedSentry = CredentialRedactor.deepSanitize(simulatedSentryPayload);
    expect(JSON.stringify(sanitizedSentry)).not.toContain(rawSecret);

    // 7. ROTATE
    const rotationResult = await VaultService.rotateCredentialKey(
      metadata.id,
      'v2',
      'security-lead'
    );
    expect(rotationResult.status).toBe('COMPLETED');
    expect(JSON.stringify(rotationResult)).not.toContain(rawSecret);

    // 8. REVOKE
    const revoked = await VaultService.revokeCredential(metadata.id);
    expect(revoked.status).toBe('REVOKED');
    expect(JSON.stringify(revoked)).not.toContain(rawSecret);

    // 9. DELETE
    await VaultService.deleteCredential(metadata.id);
    const postDelete = await VaultService.getRecord(metadata.id);
    expect(postDelete).toBeNull();

    // Verify access logs and rotations are completely secret-free
    const logs = await VaultService.getAccessLogs(metadata.id);
    expect(JSON.stringify(logs)).not.toContain(rawSecret);

    const rotations = await VaultService.getRotations(metadata.id);
    expect(JSON.stringify(rotations)).not.toContain(rawSecret);
  });
});
