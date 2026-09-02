import { execSync } from 'child_process';
import { MaintenanceTask, TaskContext, TaskResult } from './types';

/**
 * Lint & formatting maintenance task:
 * Runs formatting fixes across docs, markdown, and scripts.
 */
export const lintMaintenanceTask: MaintenanceTask = {
  id: 'lint-maintenance',
  name: 'Formatting & Code Hygiene',
  category: 'lint',
  description: 'Formats markdown documents and cleans up formatting inconsistencies.',
  run: async (ctx: TaskContext): Promise<TaskResult> => {
    try {
      execSync('npx prettier --write "docs/**/*.md" "README.md" "DEVELOPMENT.md"', {
        cwd: ctx.workspaceRoot,
        stdio: 'ignore',
      });

      return {
        success: true,
        message: 'Prettier formatting applied to documentation files.',
        changedFiles: [],
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Lint maintenance encountered an issue: ${err?.message || String(err)}`,
        changedFiles: [],
      };
    }
  },
};
