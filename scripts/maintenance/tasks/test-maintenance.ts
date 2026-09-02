import fs from 'fs';
import path from 'path';
import { MaintenanceTask, TaskContext, TaskResult } from './types';

/**
 * Test maintenance task:
 * Adds or updates boundary assertions for existing client validation suites.
 */
export const testMaintenanceTask: MaintenanceTask = {
  id: 'test-maintenance',
  name: 'Test Coverage Refinement',
  category: 'tests',
  description: 'Audits test suites and adds safe regression checks for validation edge cases.',
  run: async (ctx: TaskContext): Promise<TaskResult> => {
    const testFilePath = path.join(ctx.workspaceRoot, 'frontend', 'tests', 'onboarding.test.ts');
    if (!fs.existsSync(testFilePath)) {
      return { success: false, message: 'onboarding.test.ts not found', changedFiles: [] };
    }

    let content = fs.readFileSync(testFilePath, 'utf-8');

    const edgeCaseTest = `
  // Automated maintenance test assertion: URL edge cases
  it('should correctly handle URL validation for port numbers and trailing slashes', () => {
    expect(validateWebsiteUrl('http://localhost:3000/')).toBe('');
    expect(validateWebsiteUrl('https://app.sculra.com/dashboard/')).toBe('');
    expect(validateWebsiteUrl('invalid://url')).toBe('Website target URL must start with http:// or https://');
  });
`;

    if (!content.includes('should correctly handle URL validation for port numbers')) {
      const lastIndex = content.lastIndexOf('});');
      if (lastIndex !== -1) {
        content = content.slice(0, lastIndex) + edgeCaseTest + '\n' + content.slice(lastIndex);
        fs.writeFileSync(testFilePath, content, 'utf-8');
        return {
          success: true,
          message: 'Added edge-case test assertion for URL ports and trailing slashes.',
          changedFiles: ['frontend/tests/onboarding.test.ts'],
        };
      }
    }

    return {
      success: true,
      message: 'Test suites already include edge-case assertions.',
      changedFiles: [],
    };
  },
};
