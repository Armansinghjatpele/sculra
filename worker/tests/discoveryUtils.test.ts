import { describe, it, expect } from 'vitest';
import { normalizeUrl, isSameOrigin, isLikelyLogoutUrl } from '../src/discoveryUtils';

describe('Discovery URL & Crawling Utilities', () => {
  const baseOrigin = 'https://example.com';

  it('should normalize standard paths and strip hash fragments', () => {
    expect(normalizeUrl('https://example.com/dashboard#section', baseOrigin)).toBe('https://example.com/dashboard');
    expect(normalizeUrl('/pricing#faqs', baseOrigin)).toBe('https://example.com/pricing');
  });

  it('should normalize trailing slashes consistently', () => {
    expect(normalizeUrl('https://example.com/about/', baseOrigin)).toBe('https://example.com/about');
    expect(normalizeUrl('https://example.com/', baseOrigin)).toBe('https://example.com/');
  });

  it('should strip common tracking query parameters', () => {
    const url = 'https://example.com/blog?utm_source=twitter&utm_medium=social&category=qa';
    expect(normalizeUrl(url, baseOrigin)).toBe('https://example.com/blog?category=qa');
  });

  it('should reject non-HTTP/HTTPS schemes', () => {
    expect(normalizeUrl('javascript:alert(1)', baseOrigin)).toBeNull();
    expect(normalizeUrl('mailto:user@example.com', baseOrigin)).toBeNull();
    expect(normalizeUrl('tel:+1234567890', baseOrigin)).toBeNull();
    expect(normalizeUrl('data:text/html,hello', baseOrigin)).toBeNull();
  });

  it('should reject static media and binary assets', () => {
    expect(normalizeUrl('/logo.png', baseOrigin)).toBeNull();
    expect(normalizeUrl('/document.pdf', baseOrigin)).toBeNull();
    expect(normalizeUrl('/archive.zip', baseOrigin)).toBeNull();
    expect(normalizeUrl('/styles.css', baseOrigin)).toBeNull();
  });

  it('should reject external domain targets (same-origin enforcement)', () => {
    expect(normalizeUrl('https://evil.com/phish', baseOrigin)).toBeNull();
    expect(normalizeUrl('https://subdomain.other.org/app', baseOrigin)).toBeNull();
  });

  it('should identify and filter logout URLs', () => {
    expect(isLikelyLogoutUrl('https://example.com/auth/logout')).toBe(true);
    expect(isLikelyLogoutUrl('https://example.com/api/sign-out')).toBe(true);
    expect(normalizeUrl('https://example.com/signout', baseOrigin)).toBeNull();
  });

  it('should verify same-origin relations correctly', () => {
    expect(isSameOrigin('https://sculra.com/dashboard', 'https://sculra.com')).toBe(true);
    expect(isSameOrigin('https://sculra.com', 'https://api.sculra.com')).toBe(false);
    expect(isSameOrigin('http://localhost:3000', 'http://localhost:3000/test')).toBe(true);
    expect(isSameOrigin('http://localhost:3000', 'http://localhost:4000')).toBe(false);
  });
});
