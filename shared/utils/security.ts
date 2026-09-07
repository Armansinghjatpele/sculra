// ==============================================================================
// Sculra Security & SSRF Protection Utilities (shared/utils/security.ts)
// ==============================================================================
// Validates target URLs before browser navigation to eliminate SSRF vectors.
// Restricts protocols, detects loopback/private IP ranges, and blocks AWS/cloud metadata.

export interface UrlValidationResult {
  valid: boolean;
  sanitizedUrl?: string;
  error?: string;
}

export interface SecurityOptions {
  allowLocalhost?: boolean;
}

/**
 * Checks if a hostname or IPv4/IPv6 address falls into a private, loopback, or cloud-metadata network.
 */
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

  // 2. Cloud metadata endpoints (AWS, GCP, Azure, DigitalOcean, etc.)
  if (
    host === '169.254.169.254' ||
    host === 'metadata.google.internal' ||
    host === 'metadata.goog' ||
    host === '100.100.100.200' ||
    host.startsWith('169.254.')
  ) {
    return true;
  }

  // 3. IPv4 Private Ranges (RFC 1918 & Loopback RFC 1122 & Link-Local)
  // - 127.0.0.0/8 (Loopback)
  // - 10.0.0.0/8 (Private)
  // - 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
  // - 192.168.0.0/16 (Private)
  // - 0.0.0.0/8
  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const octet1 = parseInt(ipv4Match[1], 10);
    const octet2 = parseInt(ipv4Match[2], 10);
    const octet3 = parseInt(ipv4Match[3], 10);
    const octet4 = parseInt(ipv4Match[4], 10);

    if (octet1 > 255 || octet2 > 255 || octet3 > 255 || octet4 > 255) {
      return true; // Malformed IP
    }

    // 0.x.x.x
    if (octet1 === 0) return true;
    // 127.x.x.x (Loopback)
    if (octet1 === 127) return true;
    // 10.x.x.x (Private)
    if (octet1 === 10) return true;
    // 172.16.0.0 - 172.31.255.255 (Private)
    if (octet1 === 172 && octet2 >= 16 && octet2 <= 31) return true;
    // 192.168.x.x (Private)
    if (octet1 === 192 && octet2 === 168) return true;
    // 169.254.x.x (Link-Local & Cloud Metadata)
    if (octet1 === 169 && octet2 === 254) return true;
  }

  // 4. Hexadecimal / Octal / Decimal single-integer IP representations
  if (/^0x[0-9a-f]+$/i.test(host) || /^\d+$/.test(host)) {
    return true; // Potential obfuscated IP
  }

  return false;
}

/**
 * Validates a target URL against SSRF and protocol policies.
 */
export function validateTestUrl(
  urlInput: string,
  options: SecurityOptions = {}
): UrlValidationResult {
  if (!urlInput || typeof urlInput !== 'string') {
    return { valid: false, error: 'Target URL is required.' };
  }

  const trimmed = urlInput.trim();

  // Check for forbidden scheme prefixes before parsing
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

  // Enforce http/https protocols
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      valid: false,
      error: `Invalid protocol: ${parsed.protocol} is not supported. Use http:// or https://.`,
    };
  }

  // Enforce absence of embedded credentials (userinfo)
  if (parsed.username || parsed.password) {
    return {
      valid: false,
      error: 'URLs containing embedded basic authentication credentials are not permitted.',
    };
  }

  // SSRF Host Check
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

/**
 * Sanitizes headers, error messages, and payload logs to prevent secret / credential leaks.
 */
export function sanitizeLogData(data: Record<string, any>): Record<string, any> {
  const SENSITIVE_KEYS = new Set([
    'authorization',
    'cookie',
    'set-cookie',
    'password',
    'secret',
    'token',
    'api_key',
    'apikey',
    'access_token',
    'refresh_token',
    'clerk_secret_key',
    'supabase_service_role_key',
  ]);

  const sanitized: Record<string, any> = {};

  for (const [key, val] of Object.entries(data)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
      sanitized[key] = sanitizeLogData(val);
    } else {
      sanitized[key] = val;
    }
  }

  return sanitized;
}
