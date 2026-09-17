// ==============================================================================
// Sculra Bounded Symbol & Import Impact Scanner
// (worker/src/change-intelligence/symbol-impact.ts)
// ==============================================================================

import { ChangeHunk } from './types';

export interface ExtractedSymbols {
  exports: string[];
  imports: string[];
  components: string[];
  routeHandlers: string[];
}

const IMPORT_REGEX = /import\s+.*?from\s+['"]([^'"]+)['"]/g;
const EXPORT_FN_REGEX = /export\s+(?:async\s+)?function\s+([a-zA-Z0-9_$]+)/g;
const EXPORT_CONST_REGEX = /export\s+const\s+([a-zA-Z0-9_$]+)/g;
const EXPORT_CLASS_REGEX = /export\s+class\s+([a-zA-Z0-9_$]+)/g;
const ROUTE_HANDLER_NAMES = new Set(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']);

/**
 * Safely extracts high-level symbols, exports, and imports from diff hunks using bounded regex.
 * Defends against catastrophic backtracking and never crashes on unexpected syntax.
 */
export function extractSymbolsFromHunks(hunks: ChangeHunk[]): ExtractedSymbols {
  const exportsSet = new Set<string>();
  const importsSet = new Set<string>();
  const componentsSet = new Set<string>();
  const handlersSet = new Set<string>();

  try {
    const lines = hunks.flatMap((h) => [...(h.header ? [h.header] : []), ...h.lines]);
    const content = lines.map((l) => l.replace(/^[+ -]/, '')).join('\n');

    // 1. Scan Imports
    let match: RegExpExecArray | null;
    while ((match = IMPORT_REGEX.exec(content)) !== null) {
      if (match[1]) {
        importsSet.add(match[1]);
      }
    }

    // 2. Scan Exported Functions
    while ((match = EXPORT_FN_REGEX.exec(content)) !== null) {
      const name = match[1];
      if (name) {
        exportsSet.add(name);
        if (ROUTE_HANDLER_NAMES.has(name)) {
          handlersSet.add(name);
        } else if (/^[A-Z]/.test(name)) {
          componentsSet.add(name);
        }
      }
    }

    // 3. Scan Exported Constants
    while ((match = EXPORT_CONST_REGEX.exec(content)) !== null) {
      const name = match[1];
      if (name) {
        exportsSet.add(name);
        if (ROUTE_HANDLER_NAMES.has(name)) {
          handlersSet.add(name);
        } else if (/^[A-Z]/.test(name)) {
          componentsSet.add(name);
        }
      }
    }

    // 4. Scan Exported Classes
    while ((match = EXPORT_CLASS_REGEX.exec(content)) !== null) {
      const name = match[1];
      if (name) {
        exportsSet.add(name);
        if (/^[A-Z]/.test(name)) {
          componentsSet.add(name);
        }
      }
    }
  } catch {
    // Non-fatal bounded fallback
  }

  return {
    exports: Array.from(exportsSet),
    imports: Array.from(importsSet),
    components: Array.from(componentsSet),
    routeHandlers: Array.from(handlersSet),
  };
}
