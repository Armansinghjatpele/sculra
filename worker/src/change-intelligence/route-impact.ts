// ==============================================================================
// Sculra Route Impact Analyzer (worker/src/change-intelligence/route-impact.ts)
// ==============================================================================

import { AffectedRoute, ImpactConfidence } from './types';

/**
 * Derives potential application routes from Next.js and standard SPA file paths.
 */
export function extractRouteFromFilePath(filePath: string): string | null {
  const normalized = filePath.replace(/\\/g, '/');

  // Next.js App Router (app/...)
  if (normalized.includes('app/')) {
    let routePart = normalized.split('app/')[1];
    // Remove (routeGroup) folders e.g. (authenticated)/
    routePart = routePart.replace(/\([^)]+\)\//g, '');

    // Check if it's a page or route handler
    if (routePart.endsWith('/page.tsx') || routePart.endsWith('/page.jsx') || routePart.endsWith('/page.js')) {
      const clean = routePart.replace(/\/page\.[a-z]+$/, '');
      return clean === '' ? '/' : `/${clean}`;
    }
    if (routePart === 'page.tsx' || routePart === 'page.jsx' || routePart === 'page.js') {
      return '/';
    }
    if (routePart.endsWith('/route.ts') || routePart.endsWith('/route.js')) {
      const clean = routePart.replace(/\/route\.[a-z]+$/, '');
      return `/${clean}`;
    }
  }

  // Next.js Pages Router (pages/...)
  if (normalized.includes('pages/')) {
    let routePart = normalized.split('pages/')[1];
    routePart = routePart.replace(/\.[a-z]+$/, '');
    if (routePart === 'index') return '/';
    if (routePart.endsWith('/index')) return `/${routePart.replace(/\/index$/, '')}`;
    return `/${routePart}`;
  }

  return null;
}

/**
 * Maps a list of changed file paths to known application routes.
 */
export function identifyAffectedRoutes(
  filePaths: string[],
  knownRoutes: string[] = []
): AffectedRoute[] {
  const affected: AffectedRoute[] = [];
  const seenRoutes = new Set<string>();

  for (const fp of filePaths) {
    const derived = extractRouteFromFilePath(fp);
    if (!derived) continue;

    if (!seenRoutes.has(derived)) {
      seenRoutes.add(derived);

      // Check if this route matches known application discovery / product routes
      let confidence: ImpactConfidence = 'LOW';
      if (knownRoutes.length > 0) {
        const isKnown = knownRoutes.some(
          (kr) => kr === derived || derived.startsWith(kr) || kr.startsWith(derived)
        );
        confidence = isKnown ? 'HIGH' : 'MEDIUM';
      } else {
        confidence = 'MEDIUM';
      }

      affected.push({
        route: derived,
        confidence,
        reason: `Direct route file change: ${fp}`,
      });
    }
  }

  return affected;
}
