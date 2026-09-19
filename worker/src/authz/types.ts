// ==============================================================================
// Sculra Worker Authorization Domain Types (worker/src/authz/types.ts)
// ==============================================================================

export type SculraRole = 'OWNER' | 'ADMIN' | 'QA_LEAD' | 'DEVELOPER' | 'VIEWER';

export type MembershipStatus = 'ACTIVE' | 'INVITED' | 'SUSPENDED' | 'REMOVED';

export type ActorType = 'HUMAN_ACTOR' | 'WORKER_ACTOR' | 'GITHUB_ACTOR' | 'SYSTEM_ACTOR';

export interface WorkerServiceIdentity {
  actorType: 'WORKER_ACTOR';
  organizationId: string;
  projectId: string;
  campaignId?: string;
  jobId: string;
  tokenHash: string;
}

export interface WorkerAuthContext {
  actorType: ActorType;
  userId?: string;
  organizationId: string;
  projectId: string;
  role?: SculraRole;
  isServiceActor: boolean;
}
