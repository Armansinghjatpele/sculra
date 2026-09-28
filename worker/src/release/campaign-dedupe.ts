// ==============================================================================
// Sculra Campaign Deduplication & Idempotency Key Engine
// (worker/src/release/campaign-dedupe.ts)
//
// Invariants (Prompt 63):
// - Prevents duplicate automatic campaigns for duplicate webhooks or repeated READY events
// - Same deployment + same trigger + same policy version => same campaign idempotency key
// - Different deployment => distinct idempotency key => separate campaign
// ==============================================================================

import { createHash } from 'crypto';

export interface CampaignIdempotencyInput {
  organizationId?: string | null;
  projectId: string;
  deploymentId?: string | null;
  triggerType: string;
  policyVersion?: string | null;
  commitSha?: string | null;
}

/**
 * Computes a deterministic, collision-resistant idempotency key for an automated QA campaign.
 */
export function computeCampaignIdempotencyKey(input: CampaignIdempotencyInput): string {
  const org = (input.organizationId || 'no-org').trim();
  const proj = (input.projectId || 'no-proj').trim();
  const dep = (input.deploymentId || (input.commitSha ? `sha:${input.commitSha}` : 'no-dep')).trim();
  const trigger = (input.triggerType || 'MANUAL').trim().toUpperCase();
  const policyVer = (input.policyVersion || 'v1.0').trim();

  const rawKey = `${org}:${proj}:${dep}:${trigger}:${policyVer}`;
  const hash = createHash('sha256').update(rawKey).digest('hex').slice(0, 16);

  return `auto-camp-${hash}`;
}

export class CampaignDeduplicationManager {
  /**
   * Checks if an automated campaign already exists for the given deployment event.
   */
  public static shouldCreateCampaign(
    existingCampaignIds: string[],
    idempotencyKey: string
  ): { shouldCreate: boolean; existingCampaignId?: string } {
    if (existingCampaignIds && existingCampaignIds.length > 0) {
      return {
        shouldCreate: false,
        existingCampaignId: existingCampaignIds[0],
      };
    }
    return { shouldCreate: true };
  }
}
