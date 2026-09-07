// ==============================================================================
// Sculra Test Worker Entry Point (worker/src/index.ts)
// ==============================================================================

import 'dotenv/config';
import { BrowserRunner } from './runner';
import { JobExecutor } from './executor';
import { validateTargetUrl } from './security';
import { WorkerLogger } from './logger';
import { SupabaseEvidenceStorage, LocalEvidenceStorage } from './storage';

export * from './types';
export * from './runner';
export * from './executor';
export * from './security';
export * from './logger';
export * from './storage';

// CLI Support: If executed directly with testRunId argument: `pnpm start <testRunId>`
if (require.main === module) {
  const testRunId = process.argv[2];
  if (!testRunId) {
    console.log('Sculra Test Worker CLI');
    console.log('Usage: tsx src/index.ts <testRunId>');
    process.exit(0);
  }

  const executor = new JobExecutor();
  console.log(`[Worker CLI]: Executing test run ${testRunId}...`);

  executor
    .executeTestRun(testRunId)
    .then((res) => {
      console.log(`[Worker CLI]: Execution finished with status "${res.status}". Result:`, res);
      process.exit(res.success ? 0 : 1);
    })
    .catch((err) => {
      console.error('[Worker CLI]: Fatal error during execution:', err);
      process.exit(1);
    });
}
