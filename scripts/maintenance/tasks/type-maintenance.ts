import fs from 'fs';
import path from 'path';
import { MaintenanceTask, TaskContext, TaskResult } from './types';

/**
 * Type maintenance task:
 * Adds TSDoc documentation or explicit type helpers to shared utility types.
 */
export const typeMaintenanceTask: MaintenanceTask = {
  id: 'type-maintenance',
  name: 'Type System Maintenance',
  category: 'types',
  description: 'Audits shared type definitions and ensures complete TSDoc annotations.',
  run: async (ctx: TaskContext): Promise<TaskResult> => {
    const typesFilePath = path.join(ctx.workspaceRoot, 'shared', 'types', 'index.ts');
    if (!fs.existsSync(typesFilePath)) {
      return { success: false, message: 'shared/types/index.ts not found', changedFiles: [] };
    }

    let content = fs.readFileSync(typesFilePath, 'utf-8');

    const helperType = `
/**
 * Generic API response envelope used across Sculra services.
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}
`;

    if (!content.includes('export interface ApiResponse<T = unknown>')) {
      content = content.trimEnd() + '\n' + helperType;
      fs.writeFileSync(typesFilePath, content, 'utf-8');
      return {
        success: true,
        message: 'Added ApiResponse generic interface to shared types.',
        changedFiles: ['shared/types/index.ts'],
      };
    }

    return {
      success: true,
      message: 'Shared types already include standard response envelopes.',
      changedFiles: [],
    };
  },
};
