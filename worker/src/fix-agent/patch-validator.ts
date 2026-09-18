// ==============================================================================
// Sculra Fix Agent Deterministic Patch Safety Validator (worker/src/fix-agent/patch-validator.ts)
// ==============================================================================

import { StructuredPatch, ProjectFixPolicy, PatchValidationResult } from './types';
import { FixSecurityScanner } from './security';
import { PolicyBlockedError, PatchValidationError } from './errors';

export class FixPatchValidator {
  /**
   * Validates a proposed structured patch against project remediation policy and safety invariants.
   */
  static validate(patch: StructuredPatch, policy: ProjectFixPolicy): PatchValidationResult {
    const warnings: string[] = [];
    const securityFlags: string[] = [];
    let totalLines = 0;

    // 1. Check changed files count ceiling
    const filesCount = patch.affectedFiles.length;
    if (filesCount > policy.fix_agent_max_files) {
      throw new PolicyBlockedError(
        `Patch touches ${filesCount} files, exceeding project ceiling of ${policy.fix_agent_max_files}`,
        'MAX_FILES_EXCEEDED'
      );
    }

    if (filesCount === 0) {
      throw new PatchValidationError('Patch contains 0 file edits');
    }

    // 2. Validate individual edits
    for (const edit of patch.edits) {
      const filePath = edit.targetFile.replace(/\\/g, '/');

      // Check path traversal
      if (filePath.includes('..') || filePath.startsWith('/') || /^[a-zA-Z]:/.test(filePath)) {
        throw new PatchValidationError(`Unsafe file path detected: "${filePath}"`);
      }

      // Check blocked paths
      if (this.matchesGlobList(filePath, policy.fix_agent_blocked_paths)) {
        throw new PolicyBlockedError(
          `Target file "${filePath}" matches a protected blocked path`,
          'BLOCKED_PATH_VIOLATION'
        );
      }

      // Check dependency changes
      if (
        (filePath.endsWith('package.json') || filePath.endsWith('pnpm-workspace.yaml')) &&
        !policy.fix_agent_allow_dependency_changes
      ) {
        throw new PolicyBlockedError(
          'Dependency configuration changes are disabled by project policy',
          'DEPENDENCY_CHANGES_BLOCKED'
        );
      }

      // Check database migrations
      if (
        (filePath.includes('migration') || filePath.endsWith('.sql')) &&
        !policy.fix_agent_allow_database_changes
      ) {
        throw new PolicyBlockedError(
          'Database migration changes are disabled by project policy',
          'DATABASE_CHANGES_BLOCKED'
        );
      }

      // Check security sensitivity
      const flags = FixSecurityScanner.detectSecurityFlags(
        filePath,
        edit.replacementContentSnippet || ''
      );
      if (flags.length > 0) {
        securityFlags.push(...flags);
        if (!policy.fix_agent_allow_security_sensitive_changes) {
          throw new PolicyBlockedError(
            `Patch touches security-sensitive code (${flags.join(', ')}), which is disabled by project policy`,
            'SECURITY_SENSITIVE_CHANGE_BLOCKED'
          );
        }
      }

      // Check allowed paths
      if (
        policy.fix_agent_allowed_paths.length > 0 &&
        !this.matchesGlobList(filePath, policy.fix_agent_allowed_paths)
      ) {
        throw new PolicyBlockedError(
          `Target file "${filePath}" is not within allowed application paths`,
          'PATH_NOT_ALLOWED'
        );
      }

      // Count lines
      const addedLines = (edit.replacementContentSnippet || '').split('\n').length;
      const removedLines = (edit.originalContentSnippet || '').split('\n').length;
      totalLines += Math.max(addedLines, removedLines);
    }

    // 3. Check total diff lines ceiling
    if (totalLines > policy.fix_agent_max_diff_lines) {
      throw new PolicyBlockedError(
        `Patch diff contains ~${totalLines} lines, exceeding project ceiling of ${policy.fix_agent_max_diff_lines}`,
        'MAX_DIFF_LINES_EXCEEDED'
      );
    }

    const uniqueSecurityFlags = Array.from(new Set(securityFlags));

    return {
      valid: true,
      securitySensitive: uniqueSecurityFlags.length > 0,
      securityFlags: uniqueSecurityFlags,
      filesCount,
      linesCount: totalLines,
      warnings,
    };
  }

  private static matchesGlobList(filePath: string, patterns: string[]): boolean {
    const normalized = filePath.replace(/\\/g, '/').replace(/^\.\//, '');
    for (const pattern of patterns) {
      const cleanPattern = pattern.replace(/\\/g, '/').replace(/^\.\//, '');
      const escaped = cleanPattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*\*/g, '§DOUBLE_STAR§')
        .replace(/\*/g, '[^/]*')
        .replace(/§DOUBLE_STAR§/g, '.*');
      const regex = new RegExp(`^${escaped}$`, 'i');
      if (regex.test(normalized)) {
        return true;
      }
    }
    return false;
  }
}

