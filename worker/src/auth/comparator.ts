// ==============================================================================
// Sculra Deterministic Role Surface Comparator (worker/src/auth/comparator.ts)
// ==============================================================================
// Compares discovered application surfaces between roles to identify role-exclusive pages.

import { RoleComparisonResult } from './types';
import { ApplicationMap } from '../types';

export class RoleComparator {
  /**
   * Compares two ApplicationMaps discovered under different roles.
   */
  public static compareRoleSurfaces(
    roleAName: string,
    mapA: ApplicationMap | string[],
    roleBName: string,
    mapB: ApplicationMap | string[]
  ): RoleComparisonResult {
    const urlsA = this.extractNormalizedUrls(mapA);
    const urlsB = this.extractNormalizedUrls(mapB);

    const setA = new Set(urlsA);
    const setB = new Set(urlsB);

    const roleAOnlyPages = urlsA.filter((u) => !setB.has(u));
    const roleBOnlyPages = urlsB.filter((u) => !setA.has(u));
    const commonPages = urlsA.filter((u) => setB.has(u));

    const totalUniquePages = new Set([...urlsA, ...urlsB]).size;

    const summaryParts: string[] = [
      `Compared ${roleAName} (${urlsA.length} pages) vs ${roleBName} (${urlsB.length} pages).`,
    ];

    if (roleAOnlyPages.length > 0) {
      summaryParts.push(`${roleAName} exclusive pages (${roleAOnlyPages.length}): ${roleAOnlyPages.join(', ')}.`);
    }
    if (roleBOnlyPages.length > 0) {
      summaryParts.push(`${roleBName} exclusive pages (${roleBOnlyPages.length}): ${roleBOnlyPages.join(', ')}.`);
    }
    summaryParts.push(`Common shared pages (${commonPages.length}): ${commonPages.join(', ')}.`);

    return {
      roleA: roleAName,
      roleB: roleBName,
      roleAOnlyPages,
      roleBOnlyPages,
      commonPages,
      comparisonSummary: summaryParts.join(' '),
      totalUniquePages,
    };
  }

  private static extractNormalizedUrls(input: ApplicationMap | string[]): string[] {
    const rawUrls = Array.isArray(input) ? input : (input.pages || []).map((p) => p.url);
    const unique = new Set<string>();

    for (const urlStr of rawUrls) {
      try {
        const parsed = new URL(urlStr);
        // Normalize by removing trailing slash and hashes
        const normalized = `${parsed.origin}${parsed.pathname.replace(/\/$/, '') || '/'}`;
        unique.add(normalized);
      } catch {
        unique.add(urlStr.replace(/\/$/, ''));
      }
    }

    return Array.from(unique).sort();
  }
}
