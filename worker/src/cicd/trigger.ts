// ==============================================================================
// Sculra CI/CD Autonomous Campaign Trigger & Queue Scheduler (worker/src/cicd/trigger.ts)
// ==============================================================================

import { SupabaseClient } from '@supabase/supabase-js';
import { NormalizedCIEvent, ProjectCIConfig } from './types';

/**
 * Automatically schedules an autonomous QA campaign into the distributed queue (qa_campaigns)
 * with status = 'QUEUED' so running Prompt 30 worker daemons pick it up immediately.
 */
export async function scheduleCICDCampaign(
  supabase: SupabaseClient,
  project: ProjectCIConfig,
  event: NormalizedCIEvent
): Promise<{ campaignId: string }> {
  const commitSha = event.commit?.sha || event.pullRequest?.headSha;
  const branch = event.commit?.branch || event.pullRequest?.headBranch || project.ciDefaultBranch;
  const prNumber = event.pullRequest?.number;
  const targetUrl = project.targetUrl || project.sourceUrl || project.repositoryUrl || 'https://example.com';

  const campaignConfig = {
    name: `${project.name || 'Project'} — CI Gate (${branch}${prNumber ? ` PR #${prNumber}` : ''})`,
    objective: 'release_readiness',
    trigger: 'github_webhook',
    provider: event.provider,
    deliveryId: event.deliveryId,
    eventType: event.eventType,
    commitSha,
    shortSha: commitSha ? commitSha.slice(0, 7) : undefined,
    branch,
    pullRequestNumber: prNumber,
    commitAuthor: event.commit?.authorName,
    commitMessage: event.commit?.message,
    gatePolicy: project.ciGatePolicy,
    targetUrl,
    enabledDomains: [
      'discovery',
      'product',
      'strategy',
      'journey',
      'visual',
      'auth',
      'api',
      'security',
      'performance',
      'accessibility',
      'historical',
      'release',
    ],
    budget: {
      maxDurationSeconds: 600,
      maxTasks: 30,
      maxParallelStages: 2,
      maxRetriesPerTask: 1,
    },
  };

  const { data, error } = await supabase
    .from('qa_campaigns')
    .insert({
      project_id: project.projectId,
      organization_id: project.organizationId || null,
      status: 'QUEUED',
      objective: 'release_readiness',
      configuration: campaignConfig,
      budget: campaignConfig.budget,
      state: {},
      summary: {},
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`Failed to enqueue autonomous QA campaign: ${error?.message || 'Database insertion error'}`);
  }

  return { campaignId: data.id };
}
