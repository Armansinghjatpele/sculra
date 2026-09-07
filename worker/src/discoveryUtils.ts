// ==============================================================================
// Sculra Application Discovery URL & Crawling Utilities (worker/src/discoveryUtils.ts)
// ==============================================================================

const IGNORED_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.bmp', '.tiff',
  '.pdf', '.zip', '.tar', '.gz', '.rar', '.7z', '.exe', '.dmg', '.pkg', '.apk',
  '.mp4', '.mov', '.avi', '.wmv', '.mp3', '.wav', '.ogg',
  '.css', '.js', '.map', '.woff', '.woff2', '.ttf', '.eot'
]);

const TRACKING_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'msclkid', 'mc_cid', 'mc_eid', '_hsenc', '_hsmi'
]);

export function isLikelyLogoutUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);
    const path = parsed.pathname.toLowerCase();
    return (
      path.includes('logout') ||
      path.includes('signout') ||
      path.includes('sign-out') ||
      path.includes('log-out') ||
      path.includes('deauth')
    );
  } catch {
    return false;
  }
}

export function isSameOrigin(urlA: string, urlB: string): boolean {
  try {
    const parsedA = new URL(urlA);
    const parsedB = new URL(urlB);
    return parsedA.origin === parsedB.origin;
  } catch {
    return false;
  }
}

export function normalizeUrl(rawUrl: string, baseOriginUrl: string): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;

  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed === '#' || trimmed.startsWith('#')) return null;

  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('mailto:') ||
    lower.startsWith('tel:') ||
    lower.startsWith('data:') ||
    lower.startsWith('blob:') ||
    lower.startsWith('about:') ||
    lower.startsWith('ftp:')
  ) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed, baseOriginUrl);
  } catch {
    return null;
  }

  // Only http and https
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return null;
  }

  // Strip hash fragment
  parsed.hash = '';

  // Strip tracking parameters
  for (const param of Array.from(parsed.searchParams.keys())) {
    if (TRACKING_PARAMS.has(param.toLowerCase())) {
      parsed.searchParams.delete(param);
    }
  }

  // Check file extension
  const pathname = parsed.pathname;
  const lastDotIndex = pathname.lastIndexOf('.');
  if (lastDotIndex !== -1) {
    const ext = pathname.substring(lastDotIndex).toLowerCase();
    if (IGNORED_EXTENSIONS.has(ext)) {
      return null;
    }
  }

  // Normalize trailing slash (keep root '/' intact, strip trailing slash for other paths)
  if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
    parsed.pathname = parsed.pathname.slice(0, -1);
  }

  // Same origin verification
  let baseOrigin: string;
  try {
    baseOrigin = new URL(baseOriginUrl).origin;
  } catch {
    return null;
  }

  if (parsed.origin !== baseOrigin) {
    return null;
  }

  // Avoid logout triggers
  if (isLikelyLogoutUrl(parsed.toString())) {
    return null;
  }

  return parsed.toString();
}
