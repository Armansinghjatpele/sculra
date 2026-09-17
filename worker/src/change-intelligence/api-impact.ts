// ==============================================================================
// Sculra API Impact Analyzer (worker/src/change-intelligence/api-impact.ts)
// ==============================================================================

import { AffectedApi, ChangedFile, ImpactConfidence } from './types';
import { extractSymbolsFromHunks } from './symbol-impact';

export interface ApiImpactInput {
  changedFiles: ChangedFile[];
  knownApiPaths?: string[];
}

/**
 * Identifies API endpoints impacted by code changes based on route conventions,
 * handler exports, and known API discovery endpoints.
 */
export function identifyAffectedApis(input: ApiImpactInput): AffectedApi[] {
  const { changedFiles, knownApiPaths = [] } = input;
  const affected: AffectedApi[] = [];
  const seenKeys = new Set<string>();

  for (const file of changedFiles) {
    const normalized = file.path.replace(/\\/g, '/');

    // 1. Next.js App Router API (/app/api/.../route.ts)
    if (normalized.includes('app/api/') && normalized.endsWith('/route.ts')) {
      const apiPath = '/api/' + normalized.split('app/api/')[1].replace(/\/route\.[a-z]+$/, '');
      const symbols = extractSymbolsFromHunks(file.hunks);
      const methods = symbols.routeHandlers.length > 0 ? symbols.routeHandlers : ['ANY'];

      for (const method of methods) {
        const key = `${method}:${apiPath}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          const isKnown = knownApiPaths.some((kp) => kp.toLowerCase() === apiPath.toLowerCase());
          affected.push({
            path: apiPath,
            method: method !== 'ANY' ? method : undefined,
            confidence: isKnown ? 'HIGH' : 'MEDIUM',
            reason: `API route handler modified in ${file.path} (${method})`,
          });
        }
      }
    }

    // 2. Next.js Pages Router API (/pages/api/...)
    if (normalized.includes('pages/api/')) {
      const apiPath = '/api/' + normalized.split('pages/api/')[1].replace(/\.[a-z]+$/, '');
      const key = `ANY:${apiPath}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        const isKnown = knownApiPaths.some((kp) => kp.toLowerCase() === apiPath.toLowerCase());
        affected.push({
          path: apiPath,
          confidence: isKnown ? 'HIGH' : 'MEDIUM',
          reason: `Pages API file modified in ${file.path}`,
        });
      }
    }

    // 3. Controller / Route Match against Known APIs
    if (file.classifications.includes('API') && knownApiPaths.length > 0) {
      for (const knownPath of knownApiPaths) {
        const cleanPathPart = knownPath.replace(/^\/api\//, '').replace(/\//g, '');
        if (cleanPathPart.length > 3 && normalized.toLowerCase().includes(cleanPathPart.toLowerCase())) {
          const key = `KNOWN:${knownPath}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            affected.push({
              path: knownPath,
              confidence: 'MEDIUM',
              reason: `API target matched via controller file convention ${file.path}`,
            });
          }
        }
      }
    }
  }

  return affected;
}
