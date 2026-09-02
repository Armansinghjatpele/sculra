#!/usr/bin/env node

import { execSync } from 'child_process';
import path from 'path';
import {
  getTodayUtc,
  getCommitMessage,
  hasMaintenanceRunToday,
  inspectGitDiff,
  revertFiles,
  MAX_DIFF_LINES,
} from './safety';
import { MaintenanceTask, TaskContext } from './tasks/types';
import { docMaintenanceTask } from './tasks/doc-maintenance';
import { testMaintenanceTask } from './tasks/test-maintenance';
import { typeMaintenanceTask } from './tasks/type-maintenance';
import { lintMaintenanceTask } from './tasks/lint-maintenance';
import { validationMaintenanceTask } from './tasks/validation-maintenance';

const TASKS: MaintenanceTask[] = [
  docMaintenanceTask,
  testMaintenanceTask,
  typeMaintenanceTask,
  validationMaintenanceTask,
  lintMaintenanceTask,
];

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const isForce = args.includes('--force');
  const categoryArg = args.find((a) => a.startsWith('--category='))?.split('=')[1] || 'auto';

  const workspaceRoot = path.resolve(__dirname, '..', '..');
  const todayUtc = getTodayUtc();

  console.log('====================================================');
  console.log('  SCULRA AUTONOMOUS DAILY MAINTENANCE');
  console.log('====================================================');
  console.log(`UTC Date:       ${todayUtc}`);
  console.log(`Mode:           ${isDryRun ? 'DRY-RUN (no commits/pushes)' : 'LIVE'}`);
  console.log(`Category:       ${categoryArg}`);
  console.log(`Max Diff Limit: ${MAX_DIFF_LINES} lines`);
  console.log('----------------------------------------------------');

  // 1. Enforce 1-commit-per-day limit
  if (!isForce && hasMaintenanceRunToday(workspaceRoot)) {
    console.log(`[DAILY LIMIT] Maintenance already executed for UTC date ${todayUtc}.`);
    console.log('Skipping to enforce the at-most-one-improvement-per-day rule.');
    process.exit(0);
  }

  // 2. Select matching candidate tasks
  let candidateTasks = TASKS;
  if (categoryArg !== 'auto') {
    candidateTasks = TASKS.filter((t) => t.category === categoryArg);
    if (candidateTasks.length === 0) {
      console.error(`[ERROR] No tasks found for category: "${categoryArg}"`);
      process.exit(1);
    }
  }

  const ctx: TaskContext = {
    workspaceRoot,
    isDryRun,
    todayUtc,
  };

  let executedTask: MaintenanceTask | null = null;
  let taskSuccessMessage = '';
  let modifiedFiles: string[] = [];

  // 3. Attempt tasks until one produces a legitimate change
  for (const task of candidateTasks) {
    console.log(`Evaluating task: [${task.category}] ${task.name}...`);
    try {
      const result = await task.run(ctx);
      const diffCheck = inspectGitDiff(workspaceRoot, MAX_DIFF_LINES);

      if (diffCheck.safe && diffCheck.filesChanged.length > 0) {
        executedTask = task;
        taskSuccessMessage = result.message;
        modifiedFiles = diffCheck.filesChanged;
        console.log(`✓ Applied improvement via [${task.name}]: ${result.message}`);
        break;
      } else {
        if (!diffCheck.safe && diffCheck.reason && !diffCheck.reason.includes('no modifications')) {
          console.warn(`[SAFETY] Task produced unsafe diff (${diffCheck.reason}). Reverting.`);
          revertFiles(diffCheck.filesChanged, workspaceRoot);
        }
      }
    } catch (err: any) {
      console.warn(`[WARN] Task ${task.name} threw an error: ${err?.message || err}`);
      revertFiles(modifiedFiles, workspaceRoot);
    }
  }

  // 4. Verify that we have a valid, safe diff
  const finalDiff = inspectGitDiff(workspaceRoot, MAX_DIFF_LINES);

  if (!finalDiff.safe || finalDiff.filesChanged.length === 0) {
    console.log('[NO-OP] No safe, legitimate improvements required today.');
    console.log('Maintaining pristine repository state. Exiting cleanly.');
    revertFiles(modifiedFiles, workspaceRoot);
    process.exit(0);
  }

  console.log('----------------------------------------------------');
  console.log(`Modified Files (${finalDiff.filesChanged.length}):`);
  finalDiff.filesChanged.forEach((f) => console.log(`  - ${f}`));
  console.log(`Diff Summary:   ${finalDiff.diffSummary}`);
  console.log('----------------------------------------------------');

  // 5. Verification Gate: run tests and linter
  console.log('[VERIFY] Running workspace test suite (vitest)...');
  try {
    execSync('pnpm test', { cwd: workspaceRoot, stdio: 'inherit' });
  } catch {
    console.error('[ERROR] Tests failed after maintenance change! Reverting task changes.');
    revertFiles(finalDiff.filesChanged, workspaceRoot);
    process.exit(1);
  }

  console.log('[VERIFY] Running workspace linter...');
  try {
    execSync('pnpm lint', { cwd: workspaceRoot, stdio: 'inherit' });
  } catch {
    console.error('[ERROR] Linter failed after maintenance change! Reverting task changes.');
    revertFiles(finalDiff.filesChanged, workspaceRoot);
    process.exit(1);
  }

  // 6. Final Commit & Push or Dry-Run exit
  const commitMessage = getCommitMessage(todayUtc);

  if (isDryRun) {
    console.log('----------------------------------------------------');
    console.log('[DRY-RUN SUCCESS] Verification passed cleanly!');
    console.log(`Would commit with message: "${commitMessage}"`);
    console.log(`Author attribution: sculra-bot <sculra-bot@users.noreply.github.com>`);
    revertFiles(finalDiff.filesChanged, workspaceRoot);
    console.log('[DRY-RUN] Working tree cleaned. No commits were made.');
    process.exit(0);
  }

  console.log(`[COMMIT] Staging files and creating commit: "${commitMessage}"...`);
  try {
    execSync('git add -A', { cwd: workspaceRoot, stdio: 'inherit' });
    execSync(
      `git -c user.name="sculra-bot" -c user.email="sculra-bot@users.noreply.github.com" commit -m "${commitMessage}"`,
      { cwd: workspaceRoot, stdio: 'inherit' }
    );
    console.log('[PUSH] Pushing commit to origin...');
    execSync('git push origin HEAD', { cwd: workspaceRoot, stdio: 'inherit' });
    console.log('====================================================');
    console.log('  MAINTENANCE COMPLETE & SYNCHRONIZED');
    console.log('====================================================');
    process.exit(0);
  } catch (err: any) {
    console.error(`[ERROR] Failed during commit/push: ${err?.message || err}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[FATAL ERROR]', err);
  process.exit(1);
});
