// ==============================================================================
// Sculra Code Context Selector & Aggregator (worker/src/remediation/code-context.ts)
// ==============================================================================

import { CodeContext, RelevantFile, RelevantSymbol, StackTraceFrame } from './types';
import { REMEDIATION_POLICY } from './policy';
import { SymbolMapper } from './symbol-mapper';
import { RouteMapper } from './route-mapper';
import { GitHubContextRetriever } from './github-context';
import { redactSecrets } from './redaction';

export interface CodeContextSelectionOptions {
  stackFrames?: StackTraceFrame[];
  changedFiles?: string[];
  targetUrl?: string;
  apiEndpoint?: string;
  mentionedFiles?: string[];
  fileMap?: Map<string, string>; // In-memory or preloaded files (e.g. fixtures/worker cache)
  githubToken?: string;
  repoOwner?: string;
  repoName?: string;
  commitRef?: string;
  productModelFiles?: string[];
  historicalFiles?: string[];
}

export class CodeContextSelector {
  /**
   * Assembles a bounded, prioritized code context bundle from empirical evidence.
   */
  static async selectContext(options: CodeContextSelectionOptions): Promise<CodeContext> {
    const {
      stackFrames = [],
      changedFiles = [],
      targetUrl = '',
      apiEndpoint = '',
      mentionedFiles = [],
      fileMap = new Map<string, string>(),
      githubToken,
      repoOwner,
      repoName,
      commitRef,
      productModelFiles = [],
      historicalFiles = [],
    } = options;

    const prioritizedCandidates: Array<{
      path: string;
      source: RelevantFile['source'];
      confidence: number;
    }> = [];

    const seenPaths = new Set<string>();

    const addCandidate = (
      rawPath: string | undefined,
      source: RelevantFile['source'],
      confidence: number
    ) => {
      if (!rawPath) return;
      const cleanPath = rawPath.replace(/\\/g, '/').replace(/^\.?\//, '').trim();
      if (!cleanPath || seenPaths.has(cleanPath)) return;
      // Filter out node_modules, dist, builds, minified vendor files
      if (
        cleanPath.includes('node_modules/') ||
        cleanPath.startsWith('dist/') ||
        cleanPath.startsWith('.next/') ||
        cleanPath.endsWith('.min.js')
      ) {
        return;
      }
      seenPaths.add(cleanPath);
      prioritizedCandidates.push({ path: cleanPath, source, confidence });
    };

    // 1. Exact stack trace files (Priority 1)
    for (const frame of stackFrames) {
      addCandidate(frame.originalFilePath || frame.filePath, 'STACK_TRACE', 0.95);
    }

    // 2. Exact changed files (Priority 2)
    for (const cf of changedFiles) {
      addCandidate(cf, 'CHANGED_FILE', 0.9);
    }

    // 3. Exact route / API handlers matching targetUrl or apiEndpoint (Priority 3 & 4)
    if (targetUrl || apiEndpoint) {
      const urlToMatch = apiEndpoint || targetUrl;
      for (const [filePath] of fileMap.entries()) {
        const mapped = RouteMapper.fileToRoute(filePath);
        if (mapped && RouteMapper.matchesRoute(urlToMatch, mapped.routePath)) {
          addCandidate(filePath, mapped.isApi ? 'API_HANDLER' : 'ROUTE_HANDLER', 0.85);
        }
      }
    }

    // 4. Mentioned files in error messages
    for (const mf of mentionedFiles) {
      addCandidate(mf, 'STACK_TRACE', 0.8);
    }

    // 5. ProductModel-linked sources (Priority 7)
    for (const pmf of productModelFiles) {
      addCandidate(pmf, 'PRODUCT_MODEL', 0.7);
    }

    // 6. Historical failure locations (Priority 8)
    for (const hf of historicalFiles) {
      addCandidate(hf, 'HISTORICAL', 0.65);
    }

    let isPartial = false;
    let partialReason: string | undefined;

    const files: RelevantFile[] = [];
    const allSymbols: RelevantSymbol[] = [];
    const importGraph: Array<{ from: string; to: string }> = [];
    let totalBytes = 0;

    // Load file content up to limits
    for (const cand of prioritizedCandidates) {
      if (files.length >= REMEDIATION_POLICY.MAX_RELEVANT_FILES) {
        isPartial = true;
        partialReason = `Exceeded maximum file limit (${REMEDIATION_POLICY.MAX_RELEVANT_FILES})`;
        break;
      }

      let content: string | null = null;

      // Check in-memory / preloaded map
      if (fileMap.has(cand.path)) {
        content = fileMap.get(cand.path)!;
      } else if (fileMap.has('./' + cand.path)) {
        content = fileMap.get('./' + cand.path)!;
      } else if (repoOwner && repoName) {
        // Fetch via read-only GitHub API
        content = await GitHubContextRetriever.fetchFileContent({
          owner: repoOwner,
          repo: repoName,
          path: cand.path,
          ref: commitRef,
          token: githubToken,
        });
      }

      if (content) {
        let safeContent = redactSecrets(content);
        const originalBytes = Buffer.byteLength(safeContent, 'utf-8');

        // File size limit
        if (originalBytes > REMEDIATION_POLICY.MAX_BYTES_PER_FILE) {
          safeContent = safeContent.slice(0, REMEDIATION_POLICY.MAX_BYTES_PER_FILE);
          isPartial = true;
          partialReason = `File ${cand.path} exceeded ${REMEDIATION_POLICY.MAX_BYTES_PER_FILE / 1024}KB and was truncated`;
        }

        const sizeBytes = Buffer.byteLength(safeContent, 'utf-8');

        // Total context limit
        if (totalBytes + sizeBytes > REMEDIATION_POLICY.MAX_TOTAL_CODE_CONTEXT) {
          isPartial = true;
          partialReason = `Total code context exceeded limit (${REMEDIATION_POLICY.MAX_TOTAL_CODE_CONTEXT / 1024}KB)`;
          break;
        }

        totalBytes += sizeBytes;
        const lineCount = safeContent.split('\n').length;
        const language = cand.path.endsWith('.ts') || cand.path.endsWith('.tsx') ? 'typescript' : 'javascript';

        files.push({
          path: cand.path,
          content: safeContent,
          source: cand.source,
          confidence: cand.confidence,
          language,
          sizeBytes,
          lineCount,
        });

        // Extract symbols
        const symbols = SymbolMapper.extractSymbols(cand.path, safeContent);
        for (const s of symbols) {
          if (allSymbols.length < REMEDIATION_POLICY.MAX_SYMBOLS) {
            allSymbols.push(s);
          }
        }

        // Extract imports
        const imported = SymbolMapper.extractImports(cand.path, safeContent);
        for (const imp of imported) {
          importGraph.push({ from: cand.path, to: imp });
        }
      }
    }

    return {
      files,
      symbols: allSymbols,
      importGraph,
      isPartial,
      partialReason,
      totalBytes,
    };
  }
}
