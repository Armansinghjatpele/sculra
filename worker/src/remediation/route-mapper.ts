// ==============================================================================
// Sculra Route Mapper for Next.js App & Pages Router
// (worker/src/remediation/route-mapper.ts)
// ==============================================================================

export interface MappedRouteTarget {
  routePath: string;
  sourceFile: string;
  routerType: 'APP_ROUTER' | 'PAGES_ROUTER' | 'STATIC';
  isApi: boolean;
  httpMethods?: string[];
}

export class RouteMapper {
  /**
   * Derives URL route from source file path according to Next.js conventions.
   */
  static fileToRoute(filePath: string): MappedRouteTarget | null {
    if (!filePath) return null;
    const normalized = filePath.replace(/\\/g, '/').replace(/^\.?\//, '');

    // App Router: app/**/page.tsx -> /...
    if (/^app\/(.+)\/page\.(tsx|jsx|js|ts)$/.test(normalized)) {
      const match = normalized.match(/^app\/(.+)\/page\.(tsx|jsx|js|ts)$/);
      const subPath = match ? match[1] : '';
      const routePath = '/' + subPath.replace(/\(rsc\)|\([^)]+\)\/?/g, '').replace(/\/+/g, '/');
      return {
        routePath: routePath === '/.' ? '/' : routePath,
        sourceFile: normalized,
        routerType: 'APP_ROUTER',
        isApi: false,
      };
    }

    // App Router root: app/page.tsx -> /
    if (/^app\/page\.(tsx|jsx|js|ts)$/.test(normalized)) {
      return {
        routePath: '/',
        sourceFile: normalized,
        routerType: 'APP_ROUTER',
        isApi: false,
      };
    }

    // App Router API: app/**/route.ts -> /...
    if (/^app\/(.+)\/route\.(ts|js|mjs)$/.test(normalized)) {
      const match = normalized.match(/^app\/(.+)\/route\.(ts|js|mjs)$/);
      const subPath = match ? match[1] : '';
      const routePath = '/' + subPath.replace(/\(rsc\)|\([^)]+\)\/?/g, '').replace(/\/+/g, '/');
      return {
        routePath: routePath.startsWith('/') ? routePath : `/${routePath}`,
        sourceFile: normalized,
        routerType: 'APP_ROUTER',
        isApi: true,
      };
    }

    // Pages Router API: pages/api/**.ts -> /api/...
    if (/^pages\/api\/(.+)\.(ts|js|mjs)$/.test(normalized)) {
      const match = normalized.match(/^pages\/api\/(.+)\.(ts|js|mjs)$/);
      const subPath = match ? match[1] : '';
      return {
        routePath: `/api/${subPath.replace(/\/index$/, '')}`,
        sourceFile: normalized,
        routerType: 'PAGES_ROUTER',
        isApi: true,
      };
    }

    // Pages Router UI: pages/**.tsx -> /...
    if (/^pages\/(.+)\.(tsx|jsx|js|ts)$/.test(normalized)) {
      const match = normalized.match(/^pages\/(.+)\.(tsx|jsx|js|ts)$/);
      const subPath = match ? match[1] : '';
      const route = subPath === 'index' ? '/' : `/${subPath.replace(/\/index$/, '')}`;
      return {
        routePath: route,
        sourceFile: normalized,
        routerType: 'PAGES_ROUTER',
        isApi: false,
      };
    }

    return null;
  }

  /**
   * Matches an empirical URL or route string against candidate file routes.
   */
  static matchesRoute(targetUrlOrPath: string, routePath: string): boolean {
    if (!targetUrlOrPath || !routePath) return false;

    let path = targetUrlOrPath;
    try {
      if (path.startsWith('http://') || path.startsWith('https://')) {
        const parsed = new URL(path);
        path = parsed.pathname;
      }
    } catch {
      // Keep as path
    }

    const cleanTarget = path.replace(/\/$/, '').toLowerCase() || '/';
    const cleanRoute = routePath.replace(/\/$/, '').toLowerCase() || '/';

    if (cleanTarget === cleanRoute) return true;

    // Support Next.js dynamic routes: e.g. /users/[id] matches /users/123
    const regexPattern = cleanRoute
      .replace(/\[\.\.\.[^\]]+\]/g, '.*')
      .replace(/\[[^\]]+\]/g, '[^/]+');

    try {
      const regex = new RegExp(`^${regexPattern}$`);
      return regex.test(cleanTarget);
    } catch {
      return false;
    }
  }
}
