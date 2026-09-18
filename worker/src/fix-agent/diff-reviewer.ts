// ==============================================================================
// Sculra Independent Deterministic Diff Reviewer (worker/src/fix-agent/diff-reviewer.ts)
// ==============================================================================

import { DiffReviewResult } from './types';
import { redactSecrets } from './redaction';
import { FixSecurityScanner } from './security';
import { DiffReviewError } from './errors';

const OBFUSCATION_PATTERNS: RegExp[] = [
  /\beval\s*\(/i,
  /\bnew\s+Function\s*\(/i,
  /\bBuffer\.from\([^,]+,\s*['"]base64['"]\)/i,
  /\batob\s*\(/i,
  /\\x[0-9a-fA-F]{2}/,
  /\\u00[0-9a-fA-F]{2}/,
];

const SHELL_EXEC_PATTERNS: RegExp[] = [
  /\bchild_process\b/i,
  /\bexecSync\s*\(/i,
  /\bspawnSync\s*\(/i,
];

export interface FileDiffData {
  filePath: string;
  originalContent: string;
  newContent: string;
}

export class DiffReviewer {
  /**
   * Independently reviews code diffs between original content and new content.
   */
  static reviewDiff(fileDiffs: FileDiffData[]): DiffReviewResult {
    const filesChanged: string[] = [];
    const violations: string[] = [];
    let additions = 0;
    let deletions = 0;
    let obfuscationDetected = false;
    let secretsDetected = false;
    const unauthorizedCommands: string[] = [];
    const diffSnippets: string[] = [];

    for (const { filePath, originalContent, newContent } of fileDiffs) {
      filesChanged.push(filePath);

      // Check for obfuscation in new content
      for (const pattern of OBFUSCATION_PATTERNS) {
        if (pattern.test(newContent)) {
          obfuscationDetected = true;
          violations.push(`Obfuscation detected in ${filePath}: Pattern ${pattern}`);
        }
      }

      // Check for shell execution calls
      for (const pattern of SHELL_EXEC_PATTERNS) {
        if (pattern.test(newContent) && !pattern.test(originalContent)) {
          unauthorizedCommands.push(`Shell execution call in ${filePath}`);
          violations.push(`Shell execution introduced in ${filePath}`);
        }
      }

      // Check if new content introduced raw secrets
      const redactedNew = redactSecrets(newContent);
      if (redactedNew !== newContent && redactSecrets(originalContent) === originalContent) {
        secretsDetected = true;
        violations.push(`Hardcoded secret detected in ${filePath}`);
      }

      // Calculate lines added and removed
      const origLines = originalContent
        ? originalContent.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n')
        : [];
      const newLines = newContent
        ? newContent.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n')
        : [];

      let fileAdds = 0;
      let fileDels = 0;
      const fileDiffLines: string[] = [`--- a/${filePath}`, `+++ b/${filePath}`];

      // Generate simple unified diff chunk
      for (let i = 0; i < Math.max(origLines.length, newLines.length); i++) {
        const oLine = origLines[i];
        const nLine = newLines[i];

        if (oLine !== undefined && nLine !== undefined) {
          if (oLine !== nLine) {
            fileDiffLines.push(`-${redactSecrets(oLine)}`);
            fileDiffLines.push(`+${redactSecrets(nLine)}`);
            fileDels++;
            fileAdds++;
          }
        } else if (oLine !== undefined) {
          fileDiffLines.push(`-${redactSecrets(oLine)}`);
          fileDels++;
        } else if (nLine !== undefined) {
          fileDiffLines.push(`+${redactSecrets(nLine)}`);
          fileAdds++;
        }
      }

      additions += fileAdds;
      deletions += fileDels;
      diffSnippets.push(fileDiffLines.join('\n'));
    }

    const passed = violations.length === 0;
    const rawDiff = diffSnippets.join('\n\n');

    const summary = passed
      ? `Diff review passed: ${filesChanged.length} file(s) changed (+${additions}, -${deletions})`
      : `Diff review failed: ${violations.join('; ')}`;

    if (!passed) {
      throw new DiffReviewError(summary, violations);
    }

    return {
      passed,
      filesChanged,
      additions,
      deletions,
      changedSymbols: [],
      securityViolations: violations,
      obfuscationDetected,
      secretsDetected,
      unauthorizedUrls: [],
      unauthorizedCommands,
      rawDiff,
      summary,
    };
  }
}
