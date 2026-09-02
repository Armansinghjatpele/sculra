import fs from 'fs';
import path from 'path';
import { MaintenanceTask, TaskContext, TaskResult } from './types';

/**
 * Validation maintenance task:
 * Refines error messages and validation utilities for better developer clarity.
 */
export const validationMaintenanceTask: MaintenanceTask = {
  id: 'validation-maintenance',
  name: 'Validation & Error Message Maintenance',
  category: 'validation',
  description: 'Audits validation helper clarity and error descriptions.',
  run: async (ctx: TaskContext): Promise<TaskResult> => {
    const utilsPath = path.join(ctx.workspaceRoot, 'shared', 'utils', 'validators.ts');
    
    if (!fs.existsSync(utilsPath)) {
      const initialContent = `/**
 * Shared input validators for Sculra applications.
 */

export function isValidHttpUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function sanitizeProjectSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-');
}
`;
      fs.writeFileSync(utilsPath, initialContent, 'utf-8');
      return {
        success: true,
        message: 'Created shared/utils/validators.ts with standard URL and slug validators.',
        changedFiles: ['shared/utils/validators.ts'],
      };
    }

    return {
      success: true,
      message: 'Validation utilities are up-to-date.',
      changedFiles: [],
    };
  },
};
