// ==============================================================================
// Sculra Safe Bounded Diff Parser (worker/src/change-intelligence/parser.ts)
// ==============================================================================

import { ChangeHunk } from './types';
import { MAX_HUNKS_PER_FILE, MAX_LINES_PER_HUNK, MAX_TOTAL_CHANGED_LINES } from './policy';

export interface DiffParseOptions {
  maxHunks?: number;
  maxLinesPerHunk?: number;
  maxTotalLines?: number;
}

export interface ParsedDiff {
  hunks: ChangeHunk[];
  additions: number;
  deletions: number;
  isTruncated: boolean;
  truncationReason?: string;
}

const HUNK_HEADER_REGEX = /^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/;

/**
 * Safely parses unified diff text into structured hunks within strict execution bounds.
 */
export function parseUnifiedDiff(
  rawPatch: string | undefined | null,
  options: DiffParseOptions = {}
): ParsedDiff {
  const maxHunks = options.maxHunks ?? MAX_HUNKS_PER_FILE;
  const maxLinesPerHunk = options.maxLinesPerHunk ?? MAX_LINES_PER_HUNK;
  const maxTotalLines = options.maxTotalLines ?? MAX_TOTAL_CHANGED_LINES;

  if (!rawPatch || typeof rawPatch !== 'string') {
    return { hunks: [], additions: 0, deletions: 0, isTruncated: false };
  }

  const hunks: ChangeHunk[] = [];
  let additions = 0;
  let deletions = 0;
  let isTruncated = false;
  let truncationReason: string | undefined;

  let currentHunk: ChangeHunk | null = null;
  let totalLinesParsed = 0;

  const rawLines = rawPatch.split('\n');

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];

    if (totalLinesParsed >= maxTotalLines) {
      isTruncated = true;
      truncationReason = `Total changed lines threshold (${maxTotalLines}) reached`;
      break;
    }

    // Check for new hunk header @@ -a,b +c,d @@
    const match = line.match(HUNK_HEADER_REGEX);
    if (match) {
      if (hunks.length >= maxHunks) {
        isTruncated = true;
        truncationReason = `Max hunks per file limit (${maxHunks}) reached`;
        break;
      }

      if (currentHunk) {
        hunks.push(currentHunk);
      }

      const oldStart = parseInt(match[1], 10) || 0;
      const oldLines = match[2] ? parseInt(match[2], 10) : 1;
      const newStart = parseInt(match[3], 10) || 0;
      const newLines = match[4] ? parseInt(match[4], 10) : 1;

      currentHunk = {
        oldStart,
        oldLines,
        newStart,
        newLines,
        lines: [],
        header: line,
      };
      continue;
    }

    if (currentHunk) {
      if (currentHunk.lines.length >= maxLinesPerHunk) {
        isTruncated = true;
        truncationReason = `Max lines per hunk (${maxLinesPerHunk}) reached`;
        continue;
      }

      if (line.startsWith('+') && !line.startsWith('+++')) {
        additions++;
        totalLinesParsed++;
        currentHunk.lines.push(line);
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        deletions++;
        totalLinesParsed++;
        currentHunk.lines.push(line);
      } else if (line.startsWith(' ') || line.startsWith('\\')) {
        currentHunk.lines.push(line);
      }
    }
  }

  if (currentHunk && hunks.length < maxHunks) {
    hunks.push(currentHunk);
  }

  return {
    hunks,
    additions,
    deletions,
    isTruncated,
    truncationReason,
  };
}
