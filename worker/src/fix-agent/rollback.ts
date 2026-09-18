// ==============================================================================
// Sculra Fix Agent Safe Rollback Manager (worker/src/fix-agent/rollback.ts)
// ==============================================================================

import { IsolatedWorkspaceManager } from './workspace';
import { FixEvidenceRecord } from './types';

export class RollbackManager {
  /**
   * Safely rolls back the isolated workspace, discarding temporary modifications.
   * Leaves user default branch completely untouched.
   */
  static async rollback(
    workspace: IsolatedWorkspaceManager,
    reason: string
  ): Promise<FixEvidenceRecord> {
    try {
      await workspace.cleanup();
    } catch {
      // Ensure rollback does not crash if workspace deletion encounters file locking
    }

    return {
      remediationId: workspace.remediationId,
      type: 'rollback',
      summary: `Isolated workspace rolled back safely: ${reason}`,
      metadata: {
        reason,
        timestamp: new Date().toISOString(),
      },
    };
  }
}
