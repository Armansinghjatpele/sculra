// ==============================================================================
// Sculra Release Observability Events (worker/src/release/release-events.ts)
// ==============================================================================

import { AutonomousEventBuilder } from '../observability/event-builder';
import { AutonomousEvent } from '../observability/types';

export class ReleaseEventFactory {
  public static environmentCreated(params: {
    projectId: string;
    organizationId?: string | null;
    environmentId: string;
    environmentName: string;
    type: string;
    baseUrl: string;
  }): AutonomousEvent {
    return AutonomousEventBuilder.create('ENVIRONMENT_CREATED')
      .setProject(params.projectId, params.organizationId)
      .setActor('SYSTEM', 'environment-manager')
      .setStageAndStatus('ENVIRONMENT', 'ACTIVE')
      .setCategoryAndSource('OBSERVED_FACT', 'DETERMINISTIC')
      .setConfidence('HIGH')
      .setSummary(`Environment "${params.environmentName}" (${params.type}) provisioned for ${params.baseUrl}`)
      .setMetadata({
        environmentId: params.environmentId,
        type: params.type,
        baseUrl: params.baseUrl,
      })
      .build();
  }

  public static environmentHealthChanged(params: {
    projectId: string;
    organizationId?: string | null;
    environmentId: string;
    healthStatus: string;
    latencyMs?: number;
    error?: string;
  }): AutonomousEvent {
    return AutonomousEventBuilder.create('ENVIRONMENT_HEALTH_CHANGED')
      .setProject(params.projectId, params.organizationId)
      .setActor('SYSTEM', 'environment-validator')
      .setStageAndStatus('ENVIRONMENT', params.healthStatus)
      .setCategoryAndSource('OBSERVED_FACT', 'DETERMINISTIC')
      .setConfidence('HIGH')
      .setSummary(`Environment health state updated to ${params.healthStatus}${params.latencyMs ? ` (${params.latencyMs}ms)` : ''}`)
      .setMetadata({
        environmentId: params.environmentId,
        healthStatus: params.healthStatus,
        latencyMs: params.latencyMs,
        error: params.error,
      })
      .build();
  }

  public static deploymentDetected(params: {
    projectId: string;
    organizationId?: string | null;
    commitSha: string;
    branch?: string;
    trigger: string;
  }): AutonomousEvent {
    return AutonomousEventBuilder.create('DEPLOYMENT_DETECTED')
      .setProject(params.projectId, params.organizationId)
      .setActor('CI', 'deployment-detector')
      .setStageAndStatus('DEPLOYMENT', 'PENDING')
      .setCategoryAndSource('OBSERVED_FACT', 'EXTERNAL')
      .setConfidence('HIGH')
      .setSummary(`Code change detected for commit ${params.commitSha.slice(0, 7)}. Awaiting confirmed deployment.`)
      .setMetadata({
        commitSha: params.commitSha,
        branch: params.branch,
        trigger: params.trigger,
      })
      .build();
  }

  public static deploymentConfirmed(params: {
    projectId: string;
    organizationId?: string | null;
    deploymentId: string;
    environmentId: string;
    commitSha: string;
    deploymentUrl?: string;
  }): AutonomousEvent {
    return AutonomousEventBuilder.create('DEPLOYMENT_CONFIRMED')
      .setProject(params.projectId, params.organizationId)
      .setActor('CI', 'deployment-detector')
      .setStageAndStatus('DEPLOYMENT', 'SUCCEEDED')
      .setCategoryAndSource('OBSERVED_FACT', 'EXTERNAL')
      .setConfidence('HIGH')
      .setSummary(`Deployment ${params.deploymentId} confirmed for commit ${params.commitSha.slice(0, 7)}.`)
      .setMetadata({
        deploymentId: params.deploymentId,
        environmentId: params.environmentId,
        commitSha: params.commitSha,
        deploymentUrl: params.deploymentUrl,
      })
      .build();
  }

  public static releaseCreated(params: {
    projectId: string;
    organizationId?: string | null;
    releaseId: string;
    version: string;
    commitSha: string;
    environmentId: string;
  }): AutonomousEvent {
    return AutonomousEventBuilder.create('RELEASE_CREATED')
      .setProject(params.projectId, params.organizationId)
      .setActor('SYSTEM', 'release-orchestrator')
      .setStageAndStatus('RELEASE', 'CANDIDATE')
      .setCategoryAndSource('ACTION', 'DETERMINISTIC')
      .setConfidence('HIGH')
      .setSummary(`Release candidate ${params.version} assembled against commit ${params.commitSha.slice(0, 7)}.`)
      .setMetadata({
        releaseId: params.releaseId,
        version: params.version,
        commitSha: params.commitSha,
        environmentId: params.environmentId,
      })
      .build();
  }

  public static releaseDecisionRecorded(params: {
    projectId: string;
    organizationId?: string | null;
    releaseId: string;
    decision: string;
    decidedBy: string;
    decidedByRole: string;
    notes?: string;
  }): AutonomousEvent {
    return AutonomousEventBuilder.create('RELEASE_DECISION_RECORDED')
      .setProject(params.projectId, params.organizationId)
      .setActor('HUMAN', params.decidedBy)
      .setStageAndStatus('RELEASE', params.decision)
      .setCategoryAndSource('HUMAN_DECISION', 'HUMAN')
      .setConfidence('HIGH')
      .setSummary(`Human release decision recorded: ${params.decision} by ${params.decidedByRole} (${params.decidedBy})`)
      .setMetadata({
        releaseId: params.releaseId,
        decision: params.decision,
        decidedByRole: params.decidedByRole,
        notes: params.notes,
      })
      .build();
  }
}
