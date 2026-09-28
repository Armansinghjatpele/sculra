// ==============================================================================
// Sculra Canonical Environment Comparator (worker/src/change-intelligence/environment-comparator.ts)
// Compares real runtime observations across test environments (Staging vs Prod, etc.)
// Answers: "What behavior differs between environments?" & "Did a regression appear only in one environment?"
// ==============================================================================

import {
  EnvironmentSnapshot,
  TargetEnvironmentObservation,
  TargetEnvironmentComparison,
  EnvironmentComparisonResult,
  EnvironmentComparisonClassification,
} from './types';
import { redactSensitiveData } from './redaction';

export interface CompareEnvironmentsInput {
  baseEnvironment: EnvironmentSnapshot;
  targetEnvironment: EnvironmentSnapshot;
  baseObservations: TargetEnvironmentObservation[];
  targetObservations: TargetEnvironmentObservation[];
  customMetadataKeysToCompare?: string[];
}

export class EnvironmentComparator {
  /**
   * Compares actual observations between two environments deterministically.
   * Classifies observations into canonical classifications:
   * SAME_BEHAVIOR, ENVIRONMENT_SPECIFIC_FAILURE, ENVIRONMENT_SPECIFIC_RECOVERY,
   * CROSS_ENVIRONMENT_REGRESSION, CROSS_ENVIRONMENT_RECOVERY,
   * CONFIGURATION_DRIFT, DEPLOYMENT_DRIFT, VERSION_DRIFT, INCONCLUSIVE.
   *
   * Strict Guardrails:
   * - Never fabricates differences without evidence.
   * - Never exposes secrets, passwords, cookies, or authorization tokens.
   */
  static compare(input: CompareEnvironmentsInput): EnvironmentComparisonResult {
    const {
      baseEnvironment,
      targetEnvironment,
      baseObservations,
      targetObservations,
      customMetadataKeysToCompare,
    } = input;

    const driftTypes: Array<'CONFIGURATION_DRIFT' | 'DEPLOYMENT_DRIFT' | 'VERSION_DRIFT'> = [];
    const driftDetailsList: Array<{
      type: 'CONFIGURATION_DRIFT' | 'DEPLOYMENT_DRIFT' | 'VERSION_DRIFT';
      description: string;
      keysChanged?: string[];
    }> = [];

    // 1. Detect Version Drift (Commit SHA or Branch mismatch when evidence exists)
    const hasCommitEvidence = !!(baseEnvironment.commitSha && targetEnvironment.commitSha);
    const hasCommitDrift = hasCommitEvidence && baseEnvironment.commitSha !== targetEnvironment.commitSha;
    const hasBranchEvidence = !!(baseEnvironment.branch && targetEnvironment.branch);
    const hasBranchDrift = hasBranchEvidence && baseEnvironment.branch !== targetEnvironment.branch;

    if (hasCommitDrift || hasBranchDrift) {
      driftTypes.push('VERSION_DRIFT');
      driftDetailsList.push({
        type: 'VERSION_DRIFT',
        description: `Version mismatch: ${baseEnvironment.environmentName || 'unknown'} (${baseEnvironment.branch || 'unknown'}@${baseEnvironment.commitSha?.slice(0, 7) || 'unknown'}) vs ${targetEnvironment.environmentName || 'unknown'} (${targetEnvironment.branch || 'unknown'}@${targetEnvironment.commitSha?.slice(0, 7) || 'unknown'})`,
      });
    }

    // 2. Detect Deployment Drift (Deployment ID mismatch when evidence exists)
    const hasDeploymentEvidence = !!(baseEnvironment.deploymentId && targetEnvironment.deploymentId);
    const hasDeploymentDrift = hasDeploymentEvidence && baseEnvironment.deploymentId !== targetEnvironment.deploymentId;

    if (hasDeploymentDrift) {
      driftTypes.push('DEPLOYMENT_DRIFT');
      driftDetailsList.push({
        type: 'DEPLOYMENT_DRIFT',
        description: `Deployment mismatch: ${baseEnvironment.environmentName || 'unknown'} (${baseEnvironment.deploymentId}) vs ${targetEnvironment.environmentName || 'unknown'} (${targetEnvironment.deploymentId})`,
      });
    }

    // 3. Detect Configuration Drift (Safe metadata comparison with secrets redacted)
    const safeBaseMeta = (redactSensitiveData(baseEnvironment.metadata || {}) || {}) as Record<string, any>;
    const safeTargetMeta = (redactSensitiveData(targetEnvironment.metadata || {}) || {}) as Record<string, any>;

    const keysToCompare = customMetadataKeysToCompare || Array.from(new Set([...Object.keys(safeBaseMeta), ...Object.keys(safeTargetMeta)]));
    const configDriftKeys: string[] = [];

    // Keys that indicate sensitive or volatile info that should not trigger config drift
    const ignoredKeys = new Set(['capturedat', 'createdat', 'updatedat', 'timestamp', 'executionid', 'runid']);

    for (const key of keysToCompare) {
      if (ignoredKeys.has(key.toLowerCase())) continue;
      const baseVal = JSON.stringify(safeBaseMeta[key] ?? null);
      const targetVal = JSON.stringify(safeTargetMeta[key] ?? null);
      if (baseVal !== targetVal) {
        configDriftKeys.push(key);
      }
    }

    if (configDriftKeys.length > 0) {
      driftTypes.push('CONFIGURATION_DRIFT');
      driftDetailsList.push({
        type: 'CONFIGURATION_DRIFT',
        description: `Configuration metadata differs across environments for keys: ${configDriftKeys.join(', ')}`,
        keysChanged: configDriftKeys,
      });
    }

    // 4. Map and Compare Target Observations
    const baseObsMap = new Map<string, TargetEnvironmentObservation>();
    for (const obs of baseObservations) {
      baseObsMap.set(obs.targetIdentifier, obs);
    }

    const targetObsMap = new Map<string, TargetEnvironmentObservation>();
    for (const obs of targetObservations) {
      targetObsMap.set(obs.targetIdentifier, obs);
    }

    const allTargetIdentifiers = Array.from(
      new Set([...Array.from(baseObsMap.keys()), ...Array.from(targetObsMap.keys())])
    ).sort();

    // Check if environment identity is complete (Prompt 61A: NO EVIDENCE -> NO INFERENCE)
    const baseHasIdentity = !!(baseEnvironment.environmentId || baseEnvironment.environmentName);
    const targetHasIdentity = !!(targetEnvironment.environmentId || targetEnvironment.environmentName);
    const hasIncompleteEnvironmentIdentity = !baseHasIdentity || !targetHasIdentity;

    const targetComparisons: TargetEnvironmentComparison[] = [];
    let sameBehaviorCount = 0;
    let environmentSpecificFailuresCount = 0;
    let environmentSpecificRecoveriesCount = 0;
    let crossEnvironmentRegressionsCount = 0;
    let crossEnvironmentRecoveriesCount = 0;
    let configurationDriftCount = configDriftKeys.length;
    let deploymentDriftCount = hasDeploymentDrift ? 1 : 0;
    let versionDriftCount = (hasCommitDrift || hasBranchDrift) ? 1 : 0;
    let inconclusiveCount = 0;

    for (const targetId of allTargetIdentifiers) {
      const baseObs = baseObsMap.get(targetId);
      const targetObs = targetObsMap.get(targetId);

      const targetType = baseObs?.targetType || targetObs?.targetType || 'PAGE';
      const domain = baseObs?.domain || targetObs?.domain || 'FUNCTIONAL';

      let classification: EnvironmentComparisonClassification = 'SAME_BEHAVIOR';
      let reason = '';
      const evidenceRefs: string[] = [];

      if (baseObs) {
        evidenceRefs.push(`base_env:${baseEnvironment.environmentName || 'unavailable'}:${baseObs.status}`);
      }
      if (targetObs) {
        evidenceRefs.push(`target_env:${targetEnvironment.environmentName || 'unavailable'}:${targetObs.status}`);
      }

      // Check for Inconclusive / Missing evidence
      if (hasIncompleteEnvironmentIdentity) {
        classification = 'INCONCLUSIVE';
        inconclusiveCount++;
        reason = `Inconclusive comparison: environment identity is missing or unavailable (base: ${baseEnvironment.environmentName || 'unavailable'}, target: ${targetEnvironment.environmentName || 'unavailable'}).`;
      } else if (!baseObs || !targetObs || baseObs.status === 'ERROR' || targetObs.status === 'ERROR' || baseObs.status === 'UNTESTED' || targetObs.status === 'UNTESTED') {
        classification = 'INCONCLUSIVE';
        inconclusiveCount++;
        reason = !baseObs
          ? `Missing baseline observation in ${baseEnvironment.environmentName || 'base'} for target "${targetId}"`
          : !targetObs
          ? `Missing observation in ${targetEnvironment.environmentName || 'target'} for target "${targetId}"`
          : `Execution error or untested target observed (${baseObs.error || targetObs.error || 'untested'})`;
      } else if (baseObs.status === 'PASSED' && targetObs.status === 'FAILED') {
        // Staging Pass / Production Failure (or Base Pass / Target Fail)
        classification = 'ENVIRONMENT_SPECIFIC_FAILURE';
        environmentSpecificFailuresCount++;
        reason = `ENVIRONMENT_SPECIFIC_FAILURE: Passed in ${baseEnvironment.environmentName || 'base'} but failed in ${targetEnvironment.environmentName || 'target'}. Possible configuration, state, or environment boundary defect.`;
        if (targetObs.metadata?.error) {
          reason += ` Error: ${targetObs.metadata.error}`;
        }
      } else if (baseObs.status === 'FAILED' && targetObs.status === 'PASSED') {
        // Base Fail / Target Pass
        classification = 'ENVIRONMENT_SPECIFIC_RECOVERY';
        environmentSpecificRecoveriesCount++;
        reason = `ENVIRONMENT_SPECIFIC_RECOVERY: Defect observed in ${baseEnvironment.environmentName || 'base'} is resolved/absent in ${targetEnvironment.environmentName || 'target'}.`;
      } else if (baseObs.status === 'FAILED' && targetObs.status === 'FAILED') {
        // Both Failed: Check if cross-environment regression
        const wasPreviouslyPassing =
          baseObs.metadata?.previousStatus === 'PASSED' && targetObs.metadata?.previousStatus === 'PASSED';
        if (wasPreviouslyPassing) {
          classification = 'CROSS_ENVIRONMENT_REGRESSION';
          crossEnvironmentRegressionsCount++;
          reason = `CROSS_ENVIRONMENT_REGRESSION: Target failed in both ${baseEnvironment.environmentName || 'base'} and ${targetEnvironment.environmentName || 'target'} after previously passing.`;
        } else {
          classification = 'SAME_BEHAVIOR';
          sameBehaviorCount++;
          reason = `Consistent defect across both environments: Failed in ${baseEnvironment.environmentName || 'base'} and ${targetEnvironment.environmentName || 'target'}.`;
        }
      } else if (baseObs.status === 'PASSED' && targetObs.status === 'PASSED') {
        // Both Passed: Check for drift impact
        if (driftTypes.includes('CONFIGURATION_DRIFT') && configDriftKeys.length > 0) {
          classification = 'CONFIGURATION_DRIFT';
          reason = `Passed in both environments, but configuration drift detected (${configDriftKeys.join(', ')}).`;
        } else if (driftTypes.includes('VERSION_DRIFT')) {
          classification = 'VERSION_DRIFT';
          reason = `Passed in both environments, but code version drift exists between ${baseEnvironment.environmentName || 'base'} and ${targetEnvironment.environmentName || 'target'}.`;
        } else if (driftTypes.includes('DEPLOYMENT_DRIFT')) {
          classification = 'DEPLOYMENT_DRIFT';
          reason = `Passed in both environments with differing deployment IDs.`;
        } else {
          classification = 'SAME_BEHAVIOR';
          sameBehaviorCount++;
          reason = `Identical healthy behavior: Target passed cleanly in both ${baseEnvironment.environmentName || 'base'} and ${targetEnvironment.environmentName || 'target'}.`;
        }
      }

      targetComparisons.push({
        targetIdentifier: targetId,
        targetType,
        domain,
        baseEnvironment,
        targetEnvironment,
        baseObservation: baseObs,
        targetObservation: targetObs,
        classification,
        reason,
        evidenceRefs,
        driftDetails: driftDetailsList.length > 0 ? driftDetailsList[0] : undefined,
      });
    }

    return {
      comparedAt: new Date().toISOString(),
      baseEnvironment,
      targetEnvironment,
      totalTargetsCompared: targetComparisons.length,
      sameBehaviorCount,
      environmentSpecificFailuresCount,
      environmentSpecificRecoveriesCount,
      crossEnvironmentRegressionsCount,
      crossEnvironmentRecoveriesCount,
      configurationDriftCount,
      deploymentDriftCount,
      versionDriftCount,
      inconclusiveCount,
      driftDetected: driftTypes.length > 0,
      driftTypes,
      targets: targetComparisons,
    };
  }
}
