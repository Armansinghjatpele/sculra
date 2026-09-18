// ==============================================================================
// Sculra Fix Agent Authorization & Policy Verification (worker/src/fix-agent/authorization.ts)
// ==============================================================================

import { FixRequest, ProjectFixPolicy, FixAgentMode } from './types';
import { FixAuthorizationError, PolicyBlockedError } from './errors';

export class FixAuthorizationManager {
  /**
   * Evaluates if a FixRequest is authorized by user permissions and project remediation policy.
   */
  static authorizeRequest(
    request: FixRequest,
    policy: ProjectFixPolicy
  ): { authorized: boolean; effectiveMode: FixAgentMode } {
    if (!request.requesterUserId) {
      throw new FixAuthorizationError('Unauthenticated request: Requester user ID is missing');
    }

    if (!request.projectId) {
      throw new FixAuthorizationError('Project ID is required');
    }

    const requestedMode = request.requestedMode || 'PLAN_ONLY';

    // 1. PLAN_ONLY is safe and allowed for standard project members
    if (requestedMode === 'PLAN_ONLY') {
      return { authorized: true, effectiveMode: 'PLAN_ONLY' };
    }

    // 2. Active modification modes (DRY_RUN, APPLY_AND_VERIFY, CREATE_PR) require project enablement
    if (!policy.fix_agent_enabled) {
      throw new PolicyBlockedError(
        'Remediation is disabled for this project. Enable fix_agent_enabled in project settings to proceed.',
        'FIX_AGENT_DISABLED',
        request.id
      );
    }

    // 3. Check allowed target branches
    const allowedBranches = policy.fix_agent_allowed_branches || ['main', 'master', 'develop'];
    const targetBranch = request.targetBranch || 'main';
    if (!allowedBranches.includes(targetBranch)) {
      throw new PolicyBlockedError(
        `Target branch "${targetBranch}" is not in the allowed branches list: [${allowedBranches.join(', ')}]`,
        'BRANCH_NOT_ALLOWED',
        request.id
      );
    }

    // 4. Check policy mode ceiling
    // Mode hierarchy: PLAN_ONLY < DRY_RUN < APPLY_AND_VERIFY < CREATE_PR
    const modeRanks: Record<FixAgentMode, number> = {
      PLAN_ONLY: 1,
      DRY_RUN: 2,
      APPLY_AND_VERIFY: 3,
      CREATE_PR: 4,
    };

    const projectMaxRank = modeRanks[policy.fix_agent_mode] || 1;
    const requestedRank = modeRanks[requestedMode] || 1;

    if (requestedRank > projectMaxRank) {
      throw new PolicyBlockedError(
        `Requested mode "${requestedMode}" exceeds maximum permitted project mode "${policy.fix_agent_mode}"`,
        'MODE_EXCEEDS_POLICY',
        request.id
      );
    }

    return { authorized: true, effectiveMode: requestedMode };
  }
}
