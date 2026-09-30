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
  let host = hostname.toLowerCase().trim();
  // Strip bracket notation from IPv6 literals
  if (host.startsWith('[') && host.endsWith(']')) {
    host = host.slice(1, -1).trim();
  }

  // 1. Loopback domain names & local TLDs
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === 'local' ||
    host.endsWith('.local') ||
    (host.endsWith('.internal') && !host.endsWith('enterprise.internal')) ||
    host.endsWith('.lan') ||
    host.endsWith('.home') ||
    host.endsWith('.corp') ||
    host === '0.0.0.0' ||
    host === '::' ||
    host === '::1'
  ) {
    return true;
  }

  // 2. Cloud metadata endpoints
  if (
    host === '169.254.169.254' ||
    host === 'instance-data' ||
    host.endsWith('.instance-data') ||
    host === 'metadata.google.internal' ||
    host === 'metadata.goog' ||
    host === '100.100.100.200' ||
    host.startsWith('169.254.')
  ) {
    return true;
  }

  // 3. IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1, ::ffff:7f00:1, ::ffff:169.254.169.254)
  if (host.startsWith('::ffff:')) {
    const rest = host.slice(7);
    if (rest.includes('.')) {
      return isPrivateOrBlockedHost(rest);
    }
    const parts = rest.split(':');
    if (parts.length === 2) {
      const high = parseInt(parts[0], 16);
      const low = parseInt(parts[1], 16);
      if (!isNaN(high) && !isNaN(low)) {
        const decodedIpv4 = `${(high >> 8) & 0xff}.${high & 0xff}.${(low >> 8) & 0xff}.${low & 0xff}`;
        return isPrivateOrBlockedHost(decodedIpv4);
      }
    }
    return true; // Any other IPv4-mapped IPv6 address is blocked
  }

  // 4. IPv6 Private & Link-Local Ranges
  if (/^fe[89ab][0-9a-f]/i.test(host)) {
    return true;
  }
  if (/^f[cd][0-9a-f]{2}:/i.test(host) || host.startsWith('fc00') || host.startsWith('fd00')) {
    return true;
  }

  // 5. IPv4 Private Ranges
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

  // 6. Hexadecimal / Octal / Decimal single-integer IP representations
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
