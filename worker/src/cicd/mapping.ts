// ==============================================================================
// Sculra CI/CD Project Resolution & Mapping (worker/src/cicd/mapping.ts)
// ==============================================================================

import { SupabaseClient } from '@supabase/supabase-js';
import { ProjectCIConfig } from './types';

/**
 * Normalizes repository coordinates for deterministic matching.
 */
export function normalizeRepoCoordinates(owner: string, name: string): { owner: string; name: string; fullName: string } {
  const cleanOwner = (owner || '').trim().toLowerCase();
  const cleanName = (name || '').trim().toLowerCase().replace(/\.git$/, '');
  return {
    owner: cleanOwner,
    name: cleanName,
    fullName: `${cleanOwner}/${cleanName}`,
  };
}

/**
 * Resolves a ProjectCIConfig from Supabase given repository owner and name.
 */
export async function findProjectForRepository(
  supabase: SupabaseClient,
  repoOwner: string,
  repoName: string,
  cloneUrl?: string
): Promise<ProjectCIConfig | null> {
  const { owner, name } = normalizeRepoCoordinates(repoOwner, repoName);

  // 1. Direct match on github_repo_owner and github_repo_name
  const { data: directMatches, error: directError } = await supabase
    .from('projects')
    .select(`
      id,
      organization_id,
      name,
      ci_enabled,
      github_repo_owner,
      github_repo_name,
      ci_default_branch,
      ci_trigger_on_push,
      ci_trigger_on_pr,
      ci_gate_policy,
      ci_webhook_secret,
      source_url,
      repository_url
    `)
    .ilike('github_repo_owner', owner)
    .ilike('github_repo_name', name)
    .limit(1);

  if (!directError && directMatches && directMatches.length > 0) {
    const row = directMatches[0];
    return {
      projectId: row.id,
      organizationId: row.organization_id,
      name: row.name,
      ciEnabled: !!row.ci_enabled,
      githubRepoOwner: row.github_repo_owner,
      githubRepoName: row.github_repo_name,
      ciDefaultBranch: row.ci_default_branch || 'main',
      ciTriggerOnPush: row.ci_trigger_on_push !== false,
      ciTriggerOnPr: row.ci_trigger_on_pr !== false,
      ciGatePolicy: row.ci_gate_policy || 'BLOCK_ON_CRITICAL_ISSUE',
      ciWebhookSecret: row.ci_webhook_secret,
      targetUrl: row.source_url || row.repository_url,
      sourceUrl: row.source_url,
      repositoryUrl: row.repository_url,
    };
  }

  // 2. Fallback: Check repository_url contains owner/name
  const { data: urlMatches, error: urlError } = await supabase
    .from('projects')
    .select(`
      id,
      organization_id,
      name,
      ci_enabled,
      github_repo_owner,
      github_repo_name,
      ci_default_branch,
      ci_trigger_on_push,
      ci_trigger_on_pr,
      ci_gate_policy,
      ci_webhook_secret,
      source_url,
      repository_url
    `)
    .ilike('repository_url', `%${owner}/${name}%`)
    .limit(1);

  if (!urlError && urlMatches && urlMatches.length > 0) {
    const row = urlMatches[0];
    return {
      projectId: row.id,
      organizationId: row.organization_id,
      name: row.name,
      ciEnabled: !!row.ci_enabled,
      githubRepoOwner: row.github_repo_owner || owner,
      githubRepoName: row.github_repo_name || name,
      ciDefaultBranch: row.ci_default_branch || 'main',
      ciTriggerOnPush: row.ci_trigger_on_push !== false,
      ciTriggerOnPr: row.ci_trigger_on_pr !== false,
      ciGatePolicy: row.ci_gate_policy || 'BLOCK_ON_CRITICAL_ISSUE',
      ciWebhookSecret: row.ci_webhook_secret,
      targetUrl: row.source_url || row.repository_url,
      sourceUrl: row.source_url,
      repositoryUrl: row.repository_url,
    };
  }

  return null;
}
