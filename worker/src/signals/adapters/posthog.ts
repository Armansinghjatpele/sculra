// ==============================================================================
// Sculra PostHog Signal Provider Adapter (Placeholder / NOT_SUPPORTED)
// (worker/src/signals/adapters/posthog.ts)
//
// Invariants (Prompt 64):
// - Explicit NOT_SUPPORTED status
// - Never fabricates successful ingestion for unsupported providers
// ==============================================================================

import { SignalAdapterResult, SignalProviderAdapter } from './adapter';
import { ProductionSignalProvider } from '../types';

export class PostHogSignalAdapter implements SignalProviderAdapter {
  public readonly provider: ProductionSignalProvider = 'POSTHOG';

  public verifySignature(
    _rawBody: string,
    _headers: Record<string, string>,
    _secret?: string
  ): { valid: boolean; reason?: string } {
    return { valid: false, reason: 'PostHog webhook ingestion is currently NOT_SUPPORTED.' };
  }

  public parsePayload(
    _payload: any,
    _headers: Record<string, string>,
    _projectId: string,
    _organizationId?: string | null
  ): SignalAdapterResult {
    return {
      supported: false,
      error: 'PostHog signal ingestion is not configured or supported in this deployment. Provider status: NOT_SUPPORTED.',
      signals: [],
    };
  }
}
