// ==============================================================================
// Sculra CI/CD Feedback Provider Adapter (worker/src/release/ci-feedback.ts)
// Exposes release gate status back to CI/CD providers (e.g. GitHub Commit Status / Check Runs)
//
// Invariants (Prompt 63):
// - Do NOT claim support unless actually implemented.
// - If provider integration is unavailable: store internal gate result only.
// - NEVER fake an external provider check.
// ==============================================================================

import { ReleaseGateDecision, ReleaseGateDecisionType } from './types';

export interface CIFeedbackOptions {
  provider: string; // 'GITHUB' | 'GENERIC' | 'INTERNAL'
  repoFullName?: string | null;
  commitSha?: string | null;
  githubToken?: string | null;
  targetUrl?: string | null;
  context?: string;
}

export interface CIFeedbackResult {
  reported: boolean;
  provider: string;
  externalStatus?: string;
  internalStatus: ReleaseGateDecisionType;
  reason?: string;
  error?: string;
}

export class CIFeedbackService {
  /**
   * Reports gate decision back to CI/CD provider if supported and credentials exist.
   * If credentials or provider integration is unavailable, truthfully records internal gate status only.
   */
  public static async reportGateDecision(
    decision: ReleaseGateDecision,
    options: CIFeedbackOptions
  ): Promise<CIFeedbackResult> {
    const { provider, repoFullName, commitSha, githubToken, targetUrl } = options;
    const context = options.context || 'sculra/release-gate';

    // Map release gate decision to CI status state
    // GitHub commit status states: 'pending', 'success', 'failure', 'error'
    let ghState: 'pending' | 'success' | 'failure' | 'error' = 'pending';
    let description = `Sculra Release Gate: ${decision.decision}`;

    if (decision.decision === 'PASS') {
      ghState = 'success';
      description = 'Sculra Release Gate passed. All critical regression & safety checks verified.';
    } else if (decision.decision === 'BLOCK') {
      ghState = 'failure';
      const blockerSummary = decision.blockers.map((b) => b.reason).join('; ');
      description = `Sculra Release Gate blocked: ${blockerSummary}`.slice(0, 140);
    } else if (decision.decision === 'REVIEW') {
      ghState = 'pending';
      description = 'Sculra Release Gate requires human approval before promotion.';
    } else if (decision.decision === 'INSUFFICIENT_EVIDENCE') {
      ghState = 'error';
      description = 'Sculra Release Gate inconclusive: insufficient evidence collected.';
    }

    // 1. If GitHub provider with repo, commitSha, and token
    if (
      provider.toUpperCase() === 'GITHUB' &&
      repoFullName &&
      commitSha &&
      githubToken
    ) {
      try {
        const url = `https://api.github.com/repos/${repoFullName}/statuses/${commitSha}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
            'User-Agent': 'Sculra-Autonomous-QA',
          },
          body: JSON.stringify({
            state: ghState,
            target_url: targetUrl || undefined,
            description,
            context,
          }),
        });

        if (response.ok) {
          return {
            reported: true,
            provider: 'GITHUB',
            externalStatus: ghState,
            internalStatus: decision.decision,
            reason: `GitHub commit status updated to '${ghState}'.`,
          };
        } else {
          const errText = await response.text();
          return {
            reported: false,
            provider: 'GITHUB',
            internalStatus: decision.decision,
            error: `GitHub API returned ${response.status}: ${errText}`,
          };
        }
      } catch (err: any) {
        return {
          reported: false,
          provider: 'GITHUB',
          internalStatus: decision.decision,
          error: `Failed updating GitHub commit status: ${err.message}`,
        };
      }
    }

    // 2. Provider integration not configured or credentials not provided:
    // Strictly store internal status only; never fake external checks.
    return {
      reported: false,
      provider: provider || 'INTERNAL',
      internalStatus: decision.decision,
      reason: 'No external CI provider credentials configured. Gate decision stored internally only.',
    };
  }
}
