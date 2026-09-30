// ==============================================================================
// Sculra Signal Provider Adapter Interface
// (worker/src/signals/adapters/adapter.ts)
// ==============================================================================

import { NormalizedSignalInput, ProductionSignalProvider } from '../types';

export interface SignalAdapterResult {
  supported: boolean;
  error?: string;
  signals: NormalizedSignalInput[];
}

export interface SignalProviderAdapter {
  readonly provider: ProductionSignalProvider;
  verifySignature(
    rawBody: string,
    headers: Record<string, string>,
    secret?: string
  ): { valid: boolean; reason?: string };

  parsePayload(
    payload: any,
    headers: Record<string, string>,
    projectId: string,
    organizationId?: string | null
  ): SignalAdapterResult;
}
