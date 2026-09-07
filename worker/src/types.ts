// ==============================================================================
// Sculra Test Worker Type Definitions (worker/src/types.ts)
// ==============================================================================

export type BrowserType = 'chromium' | 'firefox' | 'webkit';

export interface RunnerOptions {
  browserType?: BrowserType;
  headless?: boolean;
  navigationTimeoutMs?: number;
  runTimeoutMs?: number;
  allowLocalhost?: boolean;
  viewport?: {
    width: number;
    height: number;
  };
}

export interface CapturedConsoleError {
  message: string;
  url?: string;
  timestamp: string;
  location?: string;
}

export interface CapturedNetworkError {
  url: string;
  method: string;
  status?: number;
  resourceType?: string;
  errorText?: string;
  timestamp: string;
}

export interface CapturedScreenshot {
  title: string;
  buffer: Buffer;
  mimeType: string;
  storagePath?: string;
  timestamp: string;
}

export interface TestExecutionResult {
  status: 'passed' | 'failed' | 'cancelled';
  pageTitle?: string;
  finalUrl?: string;
  statusCode?: number;
  durationMs: number;
  consoleErrors: CapturedConsoleError[];
  networkErrors: CapturedNetworkError[];
  screenshots: CapturedScreenshot[];
  failureReason?: string;
}

export interface CancellationToken {
  isCancelled: boolean;
  onCancel?: () => void;
}
