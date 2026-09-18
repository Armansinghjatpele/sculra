// ==============================================================================
// Sculra Deterministic Patch Applier (worker/src/fix-agent/patch-applier.ts)
// ==============================================================================

import { StructuredPatch, PatchEdit } from './types';
import { IsolatedWorkspaceManager } from './workspace';
import { PatchApplicationError } from './errors';

export interface PatchApplyResult {
  success: boolean;
  appliedEdits: number;
  modifiedFiles: string[];
}

export class PatchApplier {
  /**
   * Applies a structured patch deterministically to the isolated workspace.
   * Atomically verifies all anchors before modifying files.
   */
  static async applyPatch(
    patch: StructuredPatch,
    workspace: IsolatedWorkspaceManager
  ): Promise<PatchApplyResult> {
    const pendingUpdates: Array<{
      targetFile: string;
      newContent: string;
    }> = [];

    // Phase 1: Pre-validation & anchor matching
    for (const edit of patch.edits) {
      if (edit.action === 'CREATE') {
        const existing = await workspace.readFile(edit.targetFile);
        if (existing !== null) {
          throw new PatchApplicationError(
            `Cannot CREATE file "${edit.targetFile}": File already exists in workspace`,
            workspace.remediationId
          );
        }
        pendingUpdates.push({
          targetFile: edit.targetFile,
          newContent: edit.replacementContentSnippet,
        });
      } else if (edit.action === 'DELETE') {
        const existing = await workspace.readFile(edit.targetFile);
        if (existing === null) {
          throw new PatchApplicationError(
            `Cannot DELETE file "${edit.targetFile}": File does not exist in workspace`,
            workspace.remediationId
          );
        }
        pendingUpdates.push({
          targetFile: edit.targetFile,
          newContent: '', // Marked for deletion
        });
      } else if (edit.action === 'UPDATE') {
        const existing = await workspace.readFile(edit.targetFile);
        if (existing === null) {
          throw new PatchApplicationError(
            `Cannot UPDATE file "${edit.targetFile}": File does not exist in workspace`,
            workspace.remediationId
          );
        }

        const anchor = edit.originalContentSnippet;
        if (!anchor) {
          throw new PatchApplicationError(
            `Cannot UPDATE file "${edit.targetFile}": Missing original anchor snippet`,
            workspace.remediationId
          );
        }

        // Count occurrences of anchor
        const occurrences = existing.split(anchor).length - 1;
        if (occurrences === 0) {
          throw new PatchApplicationError(
            `Anchor snippet not found in target file "${edit.targetFile}"`,
            workspace.remediationId
          );
        }

        if (occurrences > 1) {
          throw new PatchApplicationError(
            `Ambiguous anchor: Found ${occurrences} matches for snippet in "${edit.targetFile}". Exact context required.`,
            workspace.remediationId
          );
        }

        // Exact single replacement
        const updated = existing.replace(anchor, edit.replacementContentSnippet);
        pendingUpdates.push({
          targetFile: edit.targetFile,
          newContent: updated,
        });
      }
    }

    // Phase 2: Atomic commit to workspace
    const modifiedFiles: string[] = [];
    for (const update of pendingUpdates) {
      await workspace.writeFile(update.targetFile, update.newContent);
      modifiedFiles.push(update.targetFile);
    }

    return {
      success: true,
      appliedEdits: pendingUpdates.length,
      modifiedFiles: Array.from(new Set(modifiedFiles)),
    };
  }
}
