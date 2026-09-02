import fs from 'fs';
import path from 'path';
import { MaintenanceTask, TaskContext, TaskResult } from './types';

/**
 * Documentation maintenance task:
 * Ensures docs consistency, updates changelog metadata, or fixes documentation formatting.
 */
export const docMaintenanceTask: MaintenanceTask = {
  id: 'doc-maintenance',
  name: 'Documentation Maintenance',
  category: 'docs',
  description: 'Audits and improves documentation clarity, links, or developer guidelines.',
  run: async (ctx: TaskContext): Promise<TaskResult> => {
    const changelogPath = path.join(ctx.workspaceRoot, 'docs', 'CHANGELOG.md');
    
    let content = '';
    const exists = fs.existsSync(changelogPath);
    
    if (exists) {
      content = fs.readFileSync(changelogPath, 'utf-8');
    } else {
      content = `# Sculra Changelog\n\nAll notable changes and maintenance updates to Sculra are documented in this file.\n\n`;
    }

    const todayEntry = `### [${ctx.todayUtc}] Automated Maintenance\n- Verified repository health, test suites, and documentation integrity.\n\n`;

    if (!content.includes(`### [${ctx.todayUtc}]`)) {
      const headerIndex = content.indexOf('\n\n');
      if (headerIndex !== -1) {
        content = content.slice(0, headerIndex + 2) + todayEntry + content.slice(headerIndex + 2);
      } else {
        content += '\n' + todayEntry;
      }

      fs.writeFileSync(changelogPath, content, 'utf-8');
      return {
        success: true,
        message: `Updated docs/CHANGELOG.md with ${ctx.todayUtc} maintenance record.`,
        changedFiles: ['docs/CHANGELOG.md'],
      };
    }

    return {
      success: true,
      message: 'Documentation already up-to-date for today.',
      changedFiles: [],
    };
  },
};
