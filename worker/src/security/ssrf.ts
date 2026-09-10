// ==============================================================================
// Sculra Worker Security & SSRF Protection (worker/src/security/ssrf.ts)
// ==============================================================================
// Validates target URLs against private network address spaces, cloud metadata
// endpoints, loopback addresses, and prohibited protocol schemes.

export interface UrlValidationResult {
  valid: boolean;
  sanitizedUrl?: string;
  error?: string;
}

export interface SecurityOptions {
  allowLocalhost?: boolean;
}

export function isPrivateOrBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().trim();

  // 1. Loopback domain names
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === 'local' ||
    host.endsWith('.local') ||
    host === '0.0.0.0' ||
    host === '[::1]' ||
    host === '::1'
  ) {
    return true;
  }

  // 2. Cloud metadata endpoints
  if (
    host === '169.254.169.254' ||
    host === 'metadata.google.internal' ||
    host === 'metadata.goog' ||
    host === '100.100.100.200' ||
    host.startsWith('169.254.')
  ) {
    return true;
  }

  // 3. IPv4 Private Ranges
  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const octet1 = parseInt(ipv4Match[1], 10);
    const octet2 = parseInt(ipv4Match[2], 10);
    const octet3 = parseInt(ipv4Match[3], 10);
    const octet4 = parseInt(ipv4Match[4], 10);

    if (octet1 > 255 || octet2 > 255 || octet3 > 255 || octet4 > 255) {
      return true;
    }

    if (octet1 === 0) return true;
    if (octet1 === 127) return true;
    if (octet1 === 10) return true;
    if (octet1 === 172 && octet2 >= 16 && octet2 <= 31) return true;
    if (octet1 === 192 && octet2 === 168) return true;
    if (octet1 === 169 && octet2 === 254) return true;
  }

  if (/^0x[0-9a-f]+$/i.test(host) || /^\d+$/.test(host)) {
    return true;
  }

  return false;
}

export function validateTargetUrl(
  urlInput: string,
  options: SecurityOptions = {}
): UrlValidationResult {
  if (!urlInput || typeof urlInput !== 'string') {
    return { valid: false, error: 'Target URL is required.' };
  }

  const trimmed = urlInput.trim();
  const lower = trimmed.toLowerCase();

  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('file:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('about:') ||
    lower.startsWith('blob:') ||
    lower.startsWith('ftp:')
  ) {
    return {
      valid: false,
      error: 'Forbidden protocol scheme. Only HTTP and HTTPS URLs are permitted.',
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: 'Invalid URL format. Must be a valid absolute HTTP or HTTPS URL.' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      valid: false,
      error: `Invalid protocol: ${parsed.protocol} is not supported. Use http:// or https://.`,
    };
  }

  if (parsed.username || parsed.password) {
    return {
      valid: false,
      error: 'URLs containing embedded basic authentication credentials are not permitted.',
    };
  }

  const hostname = parsed.hostname;
  if (!hostname) {
    return { valid: false, error: 'Invalid host name in target URL.' };
  }

  const isBlocked = isPrivateOrBlockedHost(hostname);
  if (isBlocked && !options.allowLocalhost) {
    return {
      valid: false,
      error: `Access to private or internal target host "${hostname}" is restricted for security.`,
    };
  }

  return {
    valid: true,
    sanitizedUrl: parsed.toString(),
  };
}
