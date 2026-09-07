import { describe, it, expect } from 'vitest';
import { validateTargetUrl, isPrivateOrBlockedHost } from '../src/security';

describe('Worker SSRF & Security Validation', () => {
  describe('isPrivateOrBlockedHost', () => {
    it('should identify localhost and loopback domains', () => {
      expect(isPrivateOrBlockedHost('localhost')).toBe(true);
      expect(isPrivateOrBlockedHost('api.localhost')).toBe(true);
      expect(isPrivateOrBlockedHost('127.0.0.1')).toBe(true);
      expect(isPrivateOrBlockedHost('127.1.2.3')).toBe(true);
      expect(isPrivateOrBlockedHost('0.0.0.0')).toBe(true);
      expect(isPrivateOrBlockedHost('::1')).toBe(true);
    });

    it('should identify cloud metadata IP endpoints', () => {
      expect(isPrivateOrBlockedHost('169.254.169.254')).toBe(true);
      expect(isPrivateOrBlockedHost('metadata.google.internal')).toBe(true);
      expect(isPrivateOrBlockedHost('169.254.1.1')).toBe(true);
    });

    it('should identify RFC 1918 private IPv4 addresses', () => {
      expect(isPrivateOrBlockedHost('10.0.0.1')).toBe(true);
      expect(isPrivateOrBlockedHost('10.254.0.1')).toBe(true);
      expect(isPrivateOrBlockedHost('172.16.0.1')).toBe(true);
      expect(isPrivateOrBlockedHost('172.31.255.255')).toBe(true);
      expect(isPrivateOrBlockedHost('192.168.1.1')).toBe(true);
      expect(isPrivateOrBlockedHost('192.168.0.100')).toBe(true);
    });

    it('should allow legitimate public hostnames and IP addresses', () => {
      expect(isPrivateOrBlockedHost('sculra.com')).toBe(false);
      expect(isPrivateOrBlockedHost('github.com')).toBe(false);
      expect(isPrivateOrBlockedHost('8.8.8.8')).toBe(false);
      expect(isPrivateOrBlockedHost('1.1.1.1')).toBe(false);
      expect(isPrivateOrBlockedHost('172.32.0.1')).toBe(false);
    });
  });

  describe('validateTargetUrl', () => {
    it('should approve valid public HTTPS and HTTP URLs', () => {
      const res1 = validateTargetUrl('https://sculra.com/dashboard');
      expect(res1.valid).toBe(true);
      expect(res1.sanitizedUrl).toBe('https://sculra.com/dashboard');

      const res2 = validateTargetUrl('http://example.org/test');
      expect(res2.valid).toBe(true);
    });

    it('should reject non-HTTP schemes like file://, javascript:, data:', () => {
      expect(validateTargetUrl('file:///etc/passwd').valid).toBe(false);
      expect(validateTargetUrl('javascript:alert(1)').valid).toBe(false);
      expect(validateTargetUrl('data:text/html,<h1>test</h1>').valid).toBe(false);
      expect(validateTargetUrl('ftp://example.com').valid).toBe(false);
    });

    it('should reject URLs containing embedded basic auth userinfo', () => {
      const res = validateTargetUrl('https://admin:secret@sculra.com');
      expect(res.valid).toBe(false);
      expect(res.error).toContain('embedded basic authentication');
    });

    it('should reject loopback and private network targets when allowLocalhost is false', () => {
      expect(validateTargetUrl('http://127.0.0.1:3000').valid).toBe(false);
      expect(validateTargetUrl('http://localhost:8080').valid).toBe(false);
      expect(validateTargetUrl('http://192.168.1.50').valid).toBe(false);
      expect(validateTargetUrl('http://169.254.169.254/latest/meta-data').valid).toBe(false);
    });

    it('should allow localhost if explicitly enabled in test mode', () => {
      const res = validateTargetUrl('http://localhost:3000', { allowLocalhost: true });
      expect(res.valid).toBe(true);
    });
  });
});
