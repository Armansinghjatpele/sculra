export interface TaskContext {
  workspaceRoot: string;
  isDryRun: boolean;
  todayUtc: string;
}

export interface TaskResult {
  success: boolean;
  message: string;
  changedFiles: string[];
}

export interface MaintenanceTask {
  id: string;
  name: string;
  category: 'docs' | 'types' | 'tests' | 'lint' | 'validation' | 'tooling';
  description: string;
  run: (ctx: TaskContext) => Promise<TaskResult>;
}
