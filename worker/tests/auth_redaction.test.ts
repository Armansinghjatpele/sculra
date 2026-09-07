import { describe, it, expect } from 'vitest';
import { AuthRedaction } from '../src/auth/redaction';

describe('AuthRedaction', () => {
  it('redacts bearer tokens and passwords in text strings', () => {
    const text = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-ID and password=SuperSecretPassword123!';
    const redacted = AuthRedaction.redactString(text);

    expect(redacted).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-ID');
    expect(redacted).not.toContain('SuperSecretPassword123!');
    expect(redacted).toContain('[REDACTED]');
  });

  it('redacts deeply nested sensitive object properties', () => {
    const sensitiveObj = {
      user: {
        id: 'usr_123',
        username: 'admin@sculra.internal',
        password: 'my-plaintext-password',
        authConfig: {
          secret: 'shhh-secret',
          sessionToken: 'token_abc_999',
          nested: {
            apiKey: 'sk-live-12345678901234567890',
            safeField: 'visible_data',
          },
        },
      },
      headers: {
        'authorization': 'Bearer secret-jwt',
        'set-cookie': 'session=xyz; Secure; HttpOnly',
        'content-type': 'application/json',
      },
    };

    const sanitized = AuthRedaction.redactObject(sensitiveObj);

    expect(sanitized.user.password).toBe('[REDACTED]');
    expect(sanitized.user.authConfig.secret).toBe('[REDACTED]');
    expect(sanitized.user.authConfig.sessionToken).toBe('[REDACTED]');
    expect(sanitized.user.authConfig.nested.apiKey).toBe('[REDACTED]');
    expect(sanitized.user.authConfig.nested.safeField).toBe('visible_data');
    expect(sanitized.headers.authorization).toBe('[REDACTED]');
    expect(sanitized.headers['set-cookie']).toBe('[REDACTED]');
    expect(sanitized.headers['content-type']).toBe('application/json');
    expect(sanitized.user.username).toBe('admin@sculra.internal');
  });

  it('redacts sensitive headers', () => {
    const headers = {
      'Authorization': 'Bearer 12345',
      'Cookie': 'sessionId=abc123xyz',
      'X-Api-Key': 'key-secret-999',
      'Accept': 'text/html',
      'User-Agent': 'Sculra-Browser/1.0',
    };

    const redacted = AuthRedaction.redactHeaders(headers);

    expect(redacted['authorization']).toBe('[REDACTED]');
    expect(redacted['cookie']).toBe('[REDACTED]');
    expect(redacted['x-api-key']).toBe('[REDACTED]');
    expect(redacted['accept']).toBe('text/html');
    expect(redacted['user-agent']).toBe('Sculra-Browser/1.0');
  });

  it('redacts sensitive query parameters in URLs', () => {
    const rawUrl = 'https://app.example.com/callback?token=super_secret_token_123&code=auth_code_456&state=safe_state&apiKey=my_api_key';
    const redacted = AuthRedaction.redactUrl(rawUrl);

    expect(redacted).not.toContain('super_secret_token_123');
    expect(redacted).not.toContain('auth_code_456');
    expect(redacted).not.toContain('my_api_key');
    expect(redacted).toContain('token=%5BREDACTED%5D');
    expect(redacted).toContain('state=safe_state');
  });
});
