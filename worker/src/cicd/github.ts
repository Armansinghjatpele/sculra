// ==============================================================================
// Sculra GitHub Webhook Normalizer (worker/src/cicd/github.ts)
// ==============================================================================

import { NormalizedCIEvent, RepositoryIdentity, CommitIdentity, PullRequestIdentity } from './types';
import { sanitizeCIInput, sanitizeNormalizedEvent } from './redaction';

/**
 * Parses and normalizes incoming GitHub webhook payloads into strongly-typed NormalizedCIEvent.
 */
export function parseGitHubWebhook(
  deliveryId: string,
  eventType: string,
  payload: any
): NormalizedCIEvent {
  const repoRaw = payload.repository || {};
  const owner = typeof repoRaw.owner === 'object' ? (repoRaw.owner.login || repoRaw.owner.name || '') : (repoRaw.owner || '');
  const name = repoRaw.name || '';
  const fullName = repoRaw.full_name || (owner && name ? `${owner}/${name}` : '');

  const repository: RepositoryIdentity = {
    owner,
    name,
    fullName,
    cloneUrl: repoRaw.clone_url || repoRaw.git_url,
    htmlUrl: repoRaw.html_url,
    defaultBranch: repoRaw.default_branch || 'main',
  };

  const sender = payload.sender?.login || 'unknown';

  let event: NormalizedCIEvent = {
    deliveryId,
    provider: 'github',
    eventType: eventType as any,
    action: payload.action,
    repository,
    sender,
    receivedAt: new Date().toISOString(),
  };

  if (eventType === 'push') {
    const isDeleted = payload.deleted === true || payload.after === '0000000000000000000000000000000000000000';
    if (isDeleted) {
      event.action = 'branch_deleted';
    }

    const ref = payload.ref || '';
    const branch = ref.startsWith('refs/heads/') ? ref.replace('refs/heads/', '') : ref;
    const headCommit = payload.head_commit || (Array.isArray(payload.commits) && payload.commits.length > 0 ? payload.commits[payload.commits.length - 1] : null);
    const sha = headCommit?.id || payload.after || '';

    const commit: CommitIdentity = {
      sha,
      shortSha: sha.slice(0, 7),
      message: headCommit?.message || 'Push event trigger',
      authorName: headCommit?.author?.name || payload.pusher?.name || sender,
      authorEmail: headCommit?.author?.email || payload.pusher?.email,
      branch,
      url: headCommit?.url,
    };

    event.commit = commit;
  } else if (eventType === 'pull_request') {
    const prRaw = payload.pull_request || {};
    const prNumber = prRaw.number || payload.number || 0;
    const headSha = prRaw.head?.sha || '';

    const pullRequest: PullRequestIdentity = {
      number: prNumber,
      title: prRaw.title || 'Pull request trigger',
      headSha,
      headBranch: prRaw.head?.ref || '',
      baseBranch: prRaw.base?.ref || '',
      sender: prRaw.user?.login || sender,
      url: prRaw.html_url,
    };

    const commit: CommitIdentity = {
      sha: headSha,
      shortSha: headSha.slice(0, 7),
      message: prRaw.title || `PR #${prNumber}`,
      authorName: prRaw.user?.login || sender,
      branch: prRaw.head?.ref || '',
      url: prRaw.html_url,
    };

    event.pullRequest = pullRequest;
    event.commit = commit;
  }

  // Defend against prompt injection and mask credentials
  return sanitizeNormalizedEvent(event);
}
