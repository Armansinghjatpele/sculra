// ==============================================================================
// Sculra Symbol & Import Mapper (worker/src/remediation/symbol-mapper.ts)
// ==============================================================================

import { RelevantSymbol } from './types';
import { REMEDIATION_POLICY } from './policy';

export class SymbolMapper {
  /**
   * Extracts declared symbols (functions, route handlers, components, classes) from source text.
   */
  static extractSymbols(filePath: string, content: string): RelevantSymbol[] {
    if (!content) return [];
    const symbols: RelevantSymbol[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      if (symbols.length >= REMEDIATION_POLICY.MAX_SYMBOLS) break;

      const line = lines[i];
      const trimmed = line.trim();

      // 1. Next.js route handlers: export async function GET / POST / etc.
      const routeMatch = trimmed.match(/^export\s+(?:async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\b/);
      if (routeMatch) {
        symbols.push({
          name: routeMatch[1],
          kind: 'route_handler',
          filePath,
          line: i + 1,
          exported: true,
        });
        continue;
      }

      // 2. Exported functions
      const expFnMatch = trimmed.match(/^export\s+(?:async\s+)?function\s+([a-zA-Z0-9_$]+)\b/);
      if (expFnMatch) {
        const name = expFnMatch[1];
        const isComponent = /^[A-Z]/.test(name);
        symbols.push({
          name,
          kind: isComponent ? 'component' : 'function',
          filePath,
          line: i + 1,
          exported: true,
        });
        continue;
      }

      // 3. Exported const / let arrow functions or components
      const expConstMatch = trimmed.match(/^export\s+const\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[a-zA-Z0-9_$]+)\s*=>/);
      if (expConstMatch) {
        const name = expConstMatch[1];
        const isComponent = /^[A-Z]/.test(name);
        symbols.push({
          name,
          kind: isComponent ? 'component' : 'function',
          filePath,
          line: i + 1,
          exported: true,
        });
        continue;
      }

      // 4. Default export functions
      const defFnMatch = trimmed.match(/^export\s+default\s+(?:async\s+)?function\s+([a-zA-Z0-9_$]+)?\b/);
      if (defFnMatch) {
        const name = defFnMatch[1] || 'default';
        const isComponent = /^[A-Z]/.test(name) || name === 'default';
        symbols.push({
          name,
          kind: isComponent ? 'component' : 'function',
          filePath,
          line: i + 1,
          exported: true,
        });
        continue;
      }

      // 5. Classes
      const classMatch = trimmed.match(/^(?:export\s+)?class\s+([a-zA-Z0-9_$]+)\b/);
      if (classMatch) {
        symbols.push({
          name: classMatch[1],
          kind: 'class',
          filePath,
          line: i + 1,
          exported: trimmed.startsWith('export'),
        });
        continue;
      }
    }

    return symbols;
  }

  /**
   * Extracts imported relative modules from a source file.
   */
  static extractImports(filePath: string, content: string): string[] {
    if (!content) return [];
    const imports: string[] = [];
    const importRegex = /(?:import\s+(?:[\w\s{},*]+)\s+from\s+['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\))/g;

    let match: RegExpExecArray | null;
    while ((match = importRegex.exec(content)) !== null) {
      const target = match[1] || match[2];
      if (target && (target.startsWith('.') || target.startsWith('@/'))) {
        imports.push(target);
      }
    }

    return Array.from(new Set(imports));
  }
}
