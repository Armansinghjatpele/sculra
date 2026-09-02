import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

/**
 * Strict list of forbidden path patterns.
 * The daily maintenance system will NEVER modify or touch these paths.
 */
export const FORBIDDEN_PATTERNS: RegExp[] = [
  /middleware\.ts$/i,
  /(^|\/)auth(\/|$|\.)/i,
  /(^|\/)clerk(\/|$|\.)/i,
  /lib\/auth\.ts$/i,
  /supabase\/migrations\//i,
  /(^|\/)database(\/|$|\.)/i,
  /(^|\/)billing(\/|$|\.)/i,
  /(^|\/)stripe(\/|$|\.)/i,
  /(^|\/)payments(\/|$|\.)/i,
  /\.env(\..+)?$/i,
  /SECURITY\.md$/i,
  /docker-compose/i,
  /\.github\/workflows\/ci\.yml$/i,
];

/**
 * Maximum safe line diff limit for an autonomous maintenance run.
 * Prevents massive unintended changes or runaway modifications.
 */
export const MAX_DIFF_LINES = 80;

/**
 * Check if a relative file path is safe to modify.
 */
export function isPathAllowed(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, '/');
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(normalized)) {
      return false;
    }
  }
  return true;
}

/**
 * Get current UTC date formatted as YYYY-MM-DD.
 */
export function getTodayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Format expected commit message for a given UTC date.
 */
export function getCommitMessage(dateStr?: string): string {
  const date = dateStr || getTodayUtc();
  return `chore(auto): daily Sculra maintenance ${date}`;
}

/**
 * Check if an automated maintenance commit has already been made today (UTC).
 */
export function hasMaintenanceRunToday(cwd: string = process.cwd()): boolean {
  try {
    const today = getTodayUtc();
    const expectedPrefix = `chore(auto): daily Sculra maintenance ${today}`;
    
    // Check commits in the last 48 hours for today's UTC tag
    const logOutput = execSync('git log -n 20 --pretty=format:"%s"', {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });

    const lines = logOutput.split('\n').map((l) => l.trim());
    return lines.some((line) => line.startsWith(expectedPrefix));
  } catch {
    return false;
  }
}

/**
 * Inspect the current git working tree diff.
 * Verifies that:
 * 1. At least one file was changed.
 * 2. Every changed file passes the safety path check.
 * 3. Total added + deleted lines do not exceed MAX_DIFF_LINES.
 */
export function inspectGitDiff(
  cwd: string = process.cwd(),
  maxLines: number = MAX_DIFF_LINES
): {
  safe: boolean;
  reason?: string;
  filesChanged: string[];
  totalLinesChanged: number;
  diffSummary: string;
} {
  try {
    const statusOutput = execSync('git status --porcelain', {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    if (!statusOutput) {
      return {
        safe: false,
        reason: 'Working directory has no modifications.',
        filesChanged: [],
        totalLinesChanged: 0,
        diffSummary: '',
      };
    }

    const filesChanged = statusOutput
      .split('\n')
      .map((line) => line.substring(3).trim())
      .filter(Boolean);

    // Verify all changed files are permitted
    for (const file of filesChanged) {
      if (!isPathAllowed(file)) {
        return {
          safe: false,
          reason: `Modified file violates safety boundaries: ${file}`,
          filesChanged,
          totalLinesChanged: 0,
          diffSummary: '',
        };
      }
    }

    // Inspect line count diff
    const diffStat = execSync('git diff --shortstat', {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    const insertionsMatch = diffStat.match(/(\d+) insertion/);
    const deletionsMatch = diffStat.match(/(\d+) deletion/);
    const insertions = insertionsMatch ? parseInt(insertionsMatch[1], 10) : 0;
    const deletions = deletionsMatch ? parseInt(deletionsMatch[1], 10) : 0;
    const totalLinesChanged = insertions + deletions;

    if (totalLinesChanged > maxLines) {
      return {
        safe: false,
        reason: `Change exceeds safe size limit (${totalLinesChanged} lines changed > ${maxLines} max allowed).`,
        filesChanged,
        totalLinesChanged,
        diffSummary: diffStat,
      };
    }

    return {
      safe: true,
      filesChanged,
      totalLinesChanged,
      diffSummary: diffStat || 'Files modified cleanly',
    };
  } catch (error: any) {
    return {
      safe: false,
      reason: `Failed to inspect git diff: ${error?.message || String(error)}`,
      filesChanged: [],
      totalLinesChanged: 0,
      diffSummary: '',
    };
  }
}

/**
 * Revert changes to specific modified files safely.
 */
export function revertFiles(files: string[], cwd: string = process.cwd()): void {
  if (!files || files.length === 0) return;
  for (const f of files) {
    try {
      const fullPath = path.resolve(cwd, f);
      const isTracked = execSync(`git ls-files "${f}"`, { cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
      if (isTracked) {
        execSync(`git checkout -- "${f}"`, { cwd, stdio: 'ignore' });
      } else if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    } catch {
      // Ignore individual file revert errors
    }
  }
}
