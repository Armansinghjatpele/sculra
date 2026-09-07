// ==============================================================================
// Unit Test: Safe API Executor (worker/tests/api_executor.test.ts)
// ==============================================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ApiExecutor } from '../src/api-qa/executor';
import { createFixtureServer, FixtureServer } from './fixtures/app';

describe('ApiExecutor', () => {
  let fixture: FixtureServer;

  beforeAll(async () => {
    fixture = await createFixtureServer();
  });

  afterAll(async () => {
    await fixture.close();
  });

  it('executes safe GET requests successfully against fixture server', async () => {
    const executor = new ApiExecutor({ allowLocalhost: true });
    const observation = await executor.execute({
      endpointId: 'endpoint_get_api_health',
      method: 'GET',
      url: `${fixture.url}/api/health`,
    });

    expect(observation.status).toBe(200);
    expect(observation.durationMs).toBeGreaterThan(0);
    expect(observation.jsonParsed).toBe(true);
    expect(observation.bodyExcerpt).toContain('status');
    expect(observation.bodyExcerpt).toContain('ok');
  });

  it('blocks unsafe mutation methods (POST, DELETE) when not explicitly configured as safe', async () => {
    const executor = new ApiExecutor({ allowLocalhost: true });
    const observation = await executor.execute({
      endpointId: 'endpoint_post_api_feedback',
      method: 'POST',
      url: `${fixture.url}/api/feedback`,
    });

    expect(observation.status).toBe(0);
    expect(observation.statusText).toBe('SKIPPED_UNSAFE');
    expect(observation.bodyExcerpt).toContain('requires explicit safe test configuration');
  });

  it('executes mutation methods when explicitly marked safe', async () => {
    const executor = new ApiExecutor({ allowLocalhost: true });
    const observation = await executor.execute(
      {
        endpointId: 'endpoint_post_api_feedback',
        method: 'POST',
        url: `${fixture.url}/api/feedback`,
        body: { feedback: 'Great platform' },
      },
      { explicitlySafe: true }
    );

    expect(observation.status).toBe(200);
    expect(observation.bodyExcerpt).toContain('Fixture submission successful');
  });

  it('blocks destructive keyword actions even when method is GET unless explicitly permitted', async () => {
    const executor = new ApiExecutor({ allowLocalhost: true });
    const observation = await executor.execute({
      endpointId: 'endpoint_get_api_delete',
      method: 'GET',
      url: `${fixture.url}/api/delete-everything`,
    });

    expect(observation.status).toBe(0);
    expect(observation.statusText).toBe('SKIPPED_UNSAFE');
    expect(observation.bodyExcerpt).toContain('destructive keyword');
  });

  it('enforces SSRF protection against cloud metadata endpoints', async () => {
    const executor = new ApiExecutor({ allowLocalhost: false });
    const observation = await executor.execute({
      endpointId: 'endpoint_get_metadata',
      method: 'GET',
      url: 'http://169.254.169.254/latest/meta-data',
    });

    expect(observation.status).toBe(0);
    expect(observation.statusText).toBe('SSRF_BLOCKED');
    expect(observation.bodyExcerpt).toContain('SSRF Security Violation');
  });

  it('enforces bounded timeouts', async () => {
    const executor = new ApiExecutor({ allowLocalhost: true, limits: { requestTimeoutMs: 100 } });
    const observation = await executor.execute({
      endpointId: 'endpoint_get_slow',
      method: 'GET',
      url: `${fixture.url}/api/fixture/slow`, // Delays 500ms
      timeoutMs: 100,
    });

    expect(observation.status).toBe(0);
    expect(observation.errorClassification).toBe('TIMEOUT');
    expect(observation.bodyExcerpt).toContain('timed out');
  });

  it('injects in-memory credentials without persisting them in safeHeaders', async () => {
    const executor = new ApiExecutor({ allowLocalhost: true });
    const observation = await executor.execute({
      endpointId: 'endpoint_get_admin_users',
      method: 'GET',
      url: `${fixture.url}/api/admin/users`,
      headers: {
        Cookie: 'sculra_auth=admin-token',
        Authorization: 'Bearer secret-admin-key',
      },
      role: 'ADMIN',
    });

    expect(observation.status).toBe(200);
    expect(observation.role).toBe('ADMIN');
    expect(observation.authenticated).toBe(true);

    // Verify ZERO credential leakage in safeHeaders
    expect(observation.safeHeaders['Cookie']).toBeUndefined();
    expect(observation.safeHeaders['cookie']).toBeUndefined();
    expect(observation.safeHeaders['Authorization']).toBeUndefined();
    expect(observation.safeHeaders['authorization']).toBeUndefined();
    expect(observation.safeHeaders['Set-Cookie']).toBeUndefined();
    expect(observation.safeHeaders['set-cookie']).toBeUndefined();
  });
});
