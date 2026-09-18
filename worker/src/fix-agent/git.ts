// ==============================================================================
// Sculra Safe Git Operations & Branch Safety Rules (worker/src/fix-agent/git.ts)
// ==============================================================================

import { GitSafetyError } from './errors';

const FORBIDDEN_BRANCH_NAMES = new Set([
  'main',
  'master',
  'production',
  'release',
  'staging',
  'dev',
  'development',
  'head',
]);

export class SafeGitOperations {
  /**
   * Generates a sanitized, policy-compliant remediation branch name.
   * Format: sculra/fix/<issue-short-id>/<safe-slug>
   */
  static generateBranchName(issueId: string, summary: string): string {
    const shortId = issueId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 16) || 'issue';
    const safeSlug = summary
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32) || 'remediation';

    const branch = `sculra/fix/${shortId}/${safeSlug}`;
    this.validateBranchName(branch);
    return branch;
  }

  /**
   * Validates that a branch name adheres to strict naming and safety standards.
   */
  static validateBranchName(branchName: string): void {
    if (!branchName || typeof branchName !== 'string') {
      throw new GitSafetyError('Branch name must be a non-empty string');
    }

    const lower = branchName.toLowerCase().trim();

    // Check against forbidden default/production branches
    if (FORBIDDEN_BRANCH_NAMES.has(lower)) {
      throw new GitSafetyError(`Modifying protected branch "${branchName}" directly is strictly prohibited`);
    }

    // Must start with sculra/fix/
    if (!lower.startsWith('sculra/fix/')) {
      throw new GitSafetyError(
        `Remediation branch must start with "sculra/fix/". Got: "${branchName}"`
      );
    }

    // Disallow shell characters, control characters, quotes, and traversal
    if (/[^a-zA-Z0-9_/-]/.test(branchName) || branchName.includes('..')) {
      throw new GitSafetyError(`Branch name contains invalid or unsafe characters: "${branchName}"`);
    }
  }

  /**
   * Formats a structured remediation commit message.
   */
  static formatCommitMessage(issueSummary: string, issueId: string, remediationId: string): string {
    const cleanSummary = issueSummary
      .replace(/[\r\n]+/g, ' ')
      .replace(/[^\w\s.,?!-]/g, '')
      .trim()
      .slice(0, 80);

    return `fix: ${cleanSummary || 'resolve issue'}\n\nIssue: ${issueId}\nRemediation: ${remediationId}\nTriggered-By: Sculra Autonomous Safe Fix Agent`;
  }
}
